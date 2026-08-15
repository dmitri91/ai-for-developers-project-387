import * as store from "./storage.js";

const TIME_ZONE = "Europe/Moscow"; // часовой пояс владельца календаря (IANA)
const WORK_START = 9; // 09:00
const WORK_END = 18; // 18:00
const STEP_MIN = 30; // шаг сетки слотов
const MS_PER_MIN = 60000;
const MS_DAY = 86400000;

const pad = (n) => String(n).padStart(2, "0");

const tzParts = (date) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type) => Number(parts.find((p) => p.type === type).value);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute") };
};

// Время «на стене» (dateStr + hour:minute) в поясе владельца -> UTC-инстант.
// Fixed-point итерация: ищем utc такой, что tzParts(utc), прочитанный «наивно»
// (Date.UTC), совпадает с желаемым wall-временем. Для Москвы смещение фиксировано
// (UTC+3, DST отменён с 2014), поэтому преобразование — чистая константа и сходится
// за одну итерацию; цикл из трёх — страховка на случай, когда начальное приближение
// (wall как UTC) пересекает границу суток. Fold (неоднозначность локального времени
// в час перевода стрелок) для Москвы невозможен именно из-за отсутствия DST.
const toUtcMs = (dateStr, hour, minute = 0) => {
  const year = Number(dateStr.slice(0, 4));
  const month = Number(dateStr.slice(5, 7));
  const day = Number(dateStr.slice(8, 10));
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  let utc = wall;
  for (let i = 0; i < 3; i++) {
    const p = tzParts(new Date(utc));
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    utc = wall - (asUtc - utc);
  }
  return utc;
};

const isoUtc = (dateStr, hour, minute = 0) => new Date(toUtcMs(dateStr, hour, minute)).toISOString();

// Локальная дата пояса владельца для абсолютного инстанта (ключ дня).
const zonedDateStr = (iso) => {
  const p = tzParts(new Date(iso));
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
};

const nextDateStr = (dateStr) => {
  const d = new Date(
    Date.UTC(Number(dateStr.slice(0, 4)), Number(dateStr.slice(5, 7)) - 1, Number(dateStr.slice(8, 10)) + 1),
  );
  return d.toISOString().slice(0, 10);
};

const isDateStr = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

class ApiError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export { ApiError };

export const validationError = (message) => new ApiError(400, "VALIDATION_ERROR", message);
export const notFoundError = (message) => new ApiError(404, "NOT_FOUND", message);
export const conflictError = (message) => new ApiError(409, "SLOT_OCCUPIED", message);

const overlaps = ([aStart, aEnd], [bStart, bEnd]) => aStart < bEnd && bStart < aEnd;

export function availabilityWindow(eventTypeId, fromValue, toValue) {
  const eventType = store.findEventType(eventTypeId);
  if (!eventType) throw notFoundError("Тип события не найден");

  if (!isDateStr(fromValue) || !isDateStr(toValue))
    throw validationError("Параметры from и to должны быть датами вида ГГГГ-ММ-ДД");
  if (fromValue > toValue) throw validationError("from должно быть не позже to");

  const durationMs = eventType.duration * MS_PER_MIN;
  const bookings = store.listBookings();
  const days = [];
  let dateStr = fromValue;

  while (dateStr <= toValue) {
    const busy = bookings
      .filter((b) => zonedDateStr(b.startAt) === dateStr)
      .map((b) => [Date.parse(b.startAt), Date.parse(b.endAt)]);

    const slots = [];
    for (let h = WORK_START; h < WORK_END; h++) {
      for (let m = 0; m < 60; m += STEP_MIN) {
        const startAt = isoUtc(dateStr, h, m);
        const s = Date.parse(startAt);
        const e = s + durationMs;
        const occupied = busy.some((interval) => overlaps([s, e], interval));
        if (!occupied) slots.push({ startAt, endAt: new Date(e).toISOString() });
      }
    }
    days.push({ date: dateStr, slots });
    dateStr = nextDateStr(dateStr);
  }

  return { eventTypeId, from: fromValue, to: toValue, timeZone: TIME_ZONE, days };
}

export function createBooking({ eventTypeId, guestName, startAt }) {
  const eventType = store.findEventType(eventTypeId);
  if (!eventType) throw notFoundError("Тип события не найден");

  if (typeof guestName !== "string" || !guestName.trim())
    throw validationError("guestName обязателен");

  const start = Date.parse(startAt);
  if (!Number.isFinite(start)) throw validationError("Некорректный startAt");

  const p = tzParts(new Date(start));
  const h = p.hour;
  const m = p.minute;
  const end = start + eventType.duration * MS_PER_MIN;
  const dayEnd = toUtcMs(`${p.year}-${pad(p.month)}-${pad(p.day)}`, WORK_END);

  if (h < WORK_START || h >= WORK_END) throw validationError("Слот вне рабочего времени");
  if (m % STEP_MIN !== 0) throw validationError("Слот должен быть кратен 30 минутам");
  if (end > dayEnd) throw validationError("Слот выходит за пределы рабочего дня");

  const taken = store
    .listBookings()
    .some((b) => overlaps([start, end], [Date.parse(b.startAt), Date.parse(b.endAt)]));

  if (taken) throw conflictError("Слот уже занят");

  return store.createBooking({ eventTypeId, guestName: guestName.trim(), startAt, endAt: new Date(end).toISOString() });
}

export function pendingBookings() {
  const now = Date.now();
  return store
    .listBookings()
    .filter((b) => Date.parse(b.startAt) >= now)
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
}

export const eventTypes = () => store.listEventTypes();

export function createEventType({ name, description, duration }) {
  if (typeof name !== "string" || !name.trim()) throw validationError("name обязателен");
  if (!Number.isInteger(duration) || duration < 1)
    throw validationError("duration должно быть целым числом >= 1");
  return store.createEventType({
    name: name.trim(),
    description: typeof description === "string" ? description : "",
    duration,
  });
}