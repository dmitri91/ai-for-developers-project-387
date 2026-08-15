import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

/** Часовой пояс владельца календаря (IANA): в нём показываются время и даты. */
export const DEFAULT_TIME_ZONE = "Europe/Moscow";

const isValidTimeZone = (tz: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).resolvedOptions();
    return true;
  } catch {
    return false;
  }
};

/** Возвращает корректную IANA-таймзону или DEFAULT_TIME_ZONE при битом/отсутствующем значении. */
export const resolveTimeZone = (tz: string | null | undefined): string =>
  typeof tz === "string" && isValidTimeZone(tz) ? tz : DEFAULT_TIME_ZONE;

const asTz = (value: string | null | undefined, tz = DEFAULT_TIME_ZONE) =>
  value ? dayjs(value).tz(tz) : dayjs(undefined).tz(tz);

export const formatTime = (iso: string | null | undefined, tz = DEFAULT_TIME_ZONE) =>
  asTz(iso, tz).format("HH:mm");
export const formatDateLabel = (iso: string | null | undefined, tz = DEFAULT_TIME_ZONE) =>
  asTz(iso, tz).format("dddd, D MMMM");
export const formatDateShort = (iso: string | null | undefined, tz = DEFAULT_TIME_ZONE) =>
  asTz(iso, tz).format("ddd, D MMM");
export const formatDayQuery = (iso: string | null | undefined, tz = DEFAULT_TIME_ZONE) =>
  asTz(iso, tz).format("YYYY-MM-DD");