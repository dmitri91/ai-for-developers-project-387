import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.PORT ?? 4010);
const WORK_START = 9; // 09:00
const WORK_END = 18; // 18:00
const STEP_MIN = 30; // слот каждые 30 минут
const TIME_ZONE = "Europe/Moscow"; // канонический часовой пояс календаря (владельца)
const MS_PER_MIN = 60000;

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

const eventTypes = [
  { id: "evt-15", name: "Встреча 15 минут", description: "Короткий тип события для быстрого слота.", duration: 15 },
  { id: "evt-30", name: "Встреча 30 минут", description: "Базовый тип события для бронирования.", duration: 30 },
];
const bookings = [];

const now = () => new Date().toISOString();

const addDays = (dateStr, n) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
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

  for (let dateStr = from; dateStr <= to; dateStr = addDays(dateStr, 1)) {
    const busy = bookings
      .filter((b) => zonedDateStr(new Date(Date.parse(b.startAt))) === dateStr)
      .map((b) => [Date.parse(b.startAt), Date.parse(b.endAt)]);

    const slots = [];
    for (let h = WORK_START; h < WORK_END; h++) {
      for (let m = 0; m < 60; m += STEP_MIN) {
        const startAt = zonedTimeToUtc(dateStr, h, m);
        const endAt = new Date(Date.parse(startAt) + durationMs).toISOString();
        const s = Date.parse(startAt);
        const e = Date.parse(endAt);
        const occupied = busy.some(([bs, be]) => s < be && bs < e);
        if (!occupied) slots.push({ startAt, endAt });
      }
    }
    days.push({ date: dateStr, slots });
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