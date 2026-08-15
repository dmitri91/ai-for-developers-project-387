import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

export const CALENDAR_TIME_ZONE = "Europe/Moscow"; // канонический пояс календаря (владельца)

const asTz = (value: string | null | undefined, tz: string) => (value ? dayjs(value) : dayjs()).tz(tz);

export const formatTime = (iso: string | null | undefined, tz = CALENDAR_TIME_ZONE) => asTz(iso, tz).format("HH:mm");
export const formatDateLabel = (iso: string | null | undefined, tz = CALENDAR_TIME_ZONE) =>
  asTz(iso, tz).format("dddd, D MMMM");
export const formatDateShort = (iso: string | null | undefined, tz = CALENDAR_TIME_ZONE) =>
  asTz(iso, tz).format("ddd, D MMM");
export const formatDayQuery = (iso: string | null | undefined, tz = CALENDAR_TIME_ZONE) =>
  asTz(iso, tz).format("YYYY-MM-DD");