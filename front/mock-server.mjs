import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.PORT ?? 4010);
const TIME_ZONE = "Europe/Moscow"; // часовой пояс владельца календаря (IANA)
const WORK_START = 9; // 09:00
const WORK_END = 18; // 18:00
const STEP_MIN = 30; // слот каждые 30 минут

const eventTypes = [
  { id: "evt-15", name: "Встреча 15 минут", description: "Короткий тип события для быстрого слота.", duration: 15 },
  { id: "evt-30", name: "Встреча 30 минут", description: "Базовый тип события для бронирования.", duration: 30 },
];
const bookings = [];

const pad = (n) => String(n).padStart(2, "0");

const now = () => new Date().toISOString();

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

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function availability(eventTypeId, from, to) {
  const type = eventTypes.find((t) => t.id === eventTypeId);
  const durationMs = (type?.duration ?? 15) * 60000;
  const days = [];
  let dateStr = from;

  while (dateStr <= to) {
    const busy = bookings
      .filter((b) => zonedDateStr(b.startAt) === dateStr)
      .map((b) => [Date.parse(b.startAt), Date.parse(b.endAt)]);

    const slots = [];
    for (let h = WORK_START; h < WORK_END; h++) {
      for (let m = 0; m < 60; m += STEP_MIN) {
        const startAt = isoUtc(dateStr, h, m);
        const endAt = new Date(Date.parse(startAt) + durationMs).toISOString();
        const s = Date.parse(startAt);
        const e = Date.parse(endAt);
        const occupied = busy.some(([bs, be]) => s < be && bs < e);
        if (!occupied) slots.push({ startAt, endAt });
      }
    }
    days.push({ date: dateStr, slots });
    dateStr = nextDateStr(dateStr);
  }
  return { eventTypeId, from, to, timeZone: TIME_ZONE, days };
}

async function route(req, res) {
  const { pathname, searchParams } = new URL(req.url, "http://localhost");
  const method = req.method;

  if (pathname === "/bookings" && method === "POST") {
    const b = await readBody(req);
    const type = eventTypes.find((t) => t.id === b.eventTypeId);
    if (!type) return send(res, 404, { code: "NOT_FOUND", message: "Тип события не найден" });
    if (!b.startAt || !b.guestName?.trim())
      return send(res, 400, { code: "VALIDATION_ERROR", message: "Нужны startAt и guestName" });

    const endAt = new Date(Date.parse(b.startAt) + type.duration * 60000).toISOString();
    const a = Date.parse(b.startAt);
    const z = Date.parse(endAt);
    const taken = bookings.some((bk) => a < Date.parse(bk.endAt) && Date.parse(bk.startAt) < z);
    if (taken) return send(res, 409, { code: "SLOT_OCCUPIED", message: "Слот уже занят" });

    const booking = {
      id: randomUUID(),
      eventTypeId: type.id,
      guestName: b.guestName.trim(),
      startAt: b.startAt,
      endAt,
      createdAt: now(),
    };
    bookings.push(booking);
    return send(res, 201, booking);
  }

  const availMatch = pathname.match(/^\/event-types\/([^/]+)\/availability$/);
  if (availMatch && method === "GET") {
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (!from || !to) return send(res, 400, { code: "VALIDATION_ERROR", message: "Нужны from и to" });
    if (!eventTypes.find((t) => t.id === availMatch[1]))
      return send(res, 404, { code: "NOT_FOUND", message: "Тип события не найден" });
    return send(res, 200, availability(availMatch[1], from, to));
  }

  if (pathname === "/event-types" && method === "GET") {
    return send(res, 200, { items: eventTypes });
  }

  if (pathname === "/admin/event-types" && method === "GET") {
    return send(res, 200, { items: eventTypes });
  }

  if (pathname === "/admin/event-types" && method === "POST") {
    const b = await readBody(req);
    if (!b.name?.trim() || !Number.isInteger(b.duration) || b.duration < 1)
      return send(res, 400, { code: "VALIDATION_ERROR", message: "Нужны name и duration >= 1" });
    const type = { id: randomUUID(), name: b.name.trim(), description: b.description ?? "", duration: b.duration };
    eventTypes.push(type);
    return send(res, 201, type);
  }

  if (pathname === "/admin/bookings/upcoming" && method === "GET") {
    const items = bookings
      .filter((b) => Date.parse(b.startAt) >= Date.parse(now()))
      .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
    return send(res, 200, { items });
  }

  send(res, 404, { code: "NOT_FOUND", message: "Неизвестный маршрут" });
}

createServer((req, res) => {
  route(req, res).catch((err) => send(res, 500, { code: "ERROR", message: String((err && err.message) || err) }));
}).listen(PORT, () => {
  console.log(`Calendar mock API running on http://localhost:${PORT}`);
});