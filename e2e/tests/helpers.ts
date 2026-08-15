import type { APIRequestContext, Page } from "@playwright/test";

const SEEDED_TYPES = {
  "evt-15": { name: "Встреча 15 минут", duration: 15 },
  "evt-30": { name: "Встреча 30 минут", duration: 30 },
} as const;

export function seededType(key: keyof typeof SEEDED_TYPES): { name: string; duration: number } {
  return { ...SEEDED_TYPES[key] };
}

// Календарь ведётся в часовом поясе владельца (совпадает с backend/src/rules.js и front/src/datetime.ts).
export const CALENDAR_TIME_ZONE = "Europe/Moscow";

export const calendarTodayISO = (): string => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: CALENDAR_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export async function freeSlotCount(page: Page): Promise<number> {
  return page.getByRole("button", { name: /Свободно/ }).count();
}

export async function openBookingOnToday(page: Page, eventTypeId: string): Promise<void> {
  await page.goto(`/book/${eventTypeId}?date=${calendarTodayISO()}`);
  await expectFreeSlot(page);
}

export async function expectFreeSlot(page: Page): Promise<void> {
  await page.getByRole("button", { name: /Свободно/ }).first().waitFor();
}

export async function pickFirstFreeSlot(page: Page): Promise<string> {
  await page.getByRole("button", { name: /Свободно/ }).first().click();
  return new URL(page.url()).searchParams.get("ts") ?? "";
}

export async function bookSlotViaApi(
  request: APIRequestContext,
  eventTypeId: string,
  guestName: string,
  startAt: string,
): Promise<number> {
  const res = await request.post("http://localhost:4010/bookings", {
    data: { eventTypeId, guestName, startAt },
  });
  return res.status();
}

export async function openAdminBookings(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("link", { name: "Админка" }).click();
  await page.getByRole("link", { name: "Предстоящие встречи" }).click();
}