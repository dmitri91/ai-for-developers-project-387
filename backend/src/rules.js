import * as store from "./storage.js";

const WORK_START = 9; // 09:00
const WORK_END = 18; // 18:00
const STEP_MIN = 30; // шаг сетки слотов
const MS_PER_MIN = 60000;
const TIME_ZONE = "Europe/Moscow"; // канонический часовой пояс календаря (владельца)

const zonedFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const zonedParts = (d) =>
  Object.fromEntries(zonedFormatter.formatToParts(d).map(({ type, value }) => [type, value]));

const zonedDateStr = (d) => {
  const { year, month, day } = zonedParts(d);
  return `${year}-${month}-${day}`;
};

const zonedOffsetMin = (d) => {
  const { year, month, day, hour, minute } = zonedParts(d);
  const asUtc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  return Math.round((asUtc - d.getTime()) / MS_PER_MIN);
};

const zonedTimeToUtc = (dateStr, hour, minute = 0) => {
  const guess = Date.UTC(
    Number(dateStr.slice(0, 4)),
    Number(dateStr.slice(5, 7)) - 1,
    Number(dateStr.slice(8, 10)),
    hour,
    minute,
  );
  const first = zonedOffsetMin(new Date(guess));
  const second = zonedOffsetMin(new Date(guess - first * MS_PER_MIN));
  return new Date(guess - second * MS_PER_MIN).toISOString();
};

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

const parseDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const overlaps = ([aStart, aEnd], [bStart, bEnd]) => aStart < bEnd && bStart < aEnd;

const addDays = (dateStr, n) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function availabilityWindow(eventTypeId, fromValue, toValue) {
  const eventType = store.findEventType(eventTypeId);
  if (!eventType) throw notFoundError("Тип события не найден");

  const from = parseDate(fromValue);
  const to = parseDate(toValue);
  if (!from || !to) throw validationError("Параметры from и to должны быть датами вида ГГГГ-ММ-ДД");
  if (from > to) throw validationError("from должно быть не позже to");

  const durationMs = eventType.duration * MS_PER_MIN;
  const bookings = store.listBookings();
  const days = [];

  for (let dateStr = fromValue; dateStr <= toValue; dateStr = addDays(dateStr, 1)) {
    const busy = bookings
      .filter((b) => zonedDateStr(new Date(Date.parse(b.startAt))) === dateStr)
      .map((b) => [Date.parse(b.startAt), Date.parse(b.endAt)]);

    const slots = [];
    for (let h = WORK_START; h < WORK_END; h++) {
      for (let m = 0; m < 60; m += STEP_MIN) {
        const startAt = zonedTimeToUtc(dateStr, h, m);
        const s = Date.parse(startAt);
        const e = s + durationMs;
        const occupied = busy.some((interval) => overlaps([s, e], interval));
        if (!occupied) slots.push({ startAt, endAt: new Date(e).toISOString() });
      }
    }
    days.push({ date: dateStr, slots });
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

  const startDate = new Date(start);
  const { hour, minute } = zonedParts(startDate);
  const h = Number(hour);
  const m = Number(minute);
  const end = start + eventType.duration * MS_PER_MIN;
  const dayEnd = Date.parse(zonedTimeToUtc(zonedDateStr(startDate), WORK_END));

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