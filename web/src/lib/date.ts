/**
 * 日期工具：全系统以印度时区 (Asia/Kolkata) 自然日 YYYY-MM-DD 为准。
 * 陷阱：纯日期字符串不可用 dayjs(str) 解析，否则在非印度时区会按“本地午夜”被算成前一天，导致“今天的数据显示在昨天”。见 .cursorrules / CLAUDE.md 第 3 节。
 */
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

const INDIA_TZ = "Asia/Kolkata";

/**
 * 将输入转为印度时区的自然日 YYYY-MM-DD。
 * - 已是 YYYY-MM-DD 的字符串：按印度时区解析后原样返回，避免被当作“本地午夜”解析导致西区服务器少一天。
 * - Date 或带时间的 ISO 字符串：按该时刻在印度对应的自然日返回。
 */
export function toIndiaDate(input: string | Date): string {
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return dayjs.tz(trimmed, "YYYY-MM-DD", INDIA_TZ).format("YYYY-MM-DD");
    }
  }
  return dayjs(input).tz(INDIA_TZ).format("YYYY-MM-DD");
}

export function parseIndiaDate(dateStr: string): Date {
  return dayjs.tz(dateStr, "YYYY-MM-DD", INDIA_TZ).toDate();
}

export function isValidIndiaDate(dateStr: string): boolean {
  const trimmed = dateStr.trim();
  // 先粗略校验格式必须类似 2026-02-16
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return false;
  }

  try {
    return dayjs.tz(trimmed, "YYYY-MM-DD", INDIA_TZ).isValid();
  } catch {
    return false;
  }
}

const WEEKDAY_ZH = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

/** 格式化为「YYYY年M月D日 星期X」用于展示 */
export function formatDateWithWeekday(dateStr: string): string {
  const d = dayjs.tz(dateStr, "YYYY-MM-DD", INDIA_TZ);
  if (!d.isValid()) return dateStr;
  const w = d.day();
  return `${d.format("YYYY年M月D日")} ${WEEKDAY_ZH[w]}`;
}

export function getIndiaDateRange(startInclusive: string, endInclusive: string): string[] {
  const start = dayjs.tz(startInclusive, "YYYY-MM-DD", INDIA_TZ);
  const end = dayjs.tz(endInclusive, "YYYY-MM-DD", INDIA_TZ);

  if (!start.isValid() || !end.isValid() || end.isBefore(start)) {
    return [];
  }

  const days: string[] = [];
  let current = start;

  while (current.isSame(end) || current.isBefore(end)) {
    days.push(current.format("YYYY-MM-DD"));
    current = current.add(1, "day");
  }

  return days;
}

/** 获取印度时区“今天”的日期字符串 YYYY-MM-DD，仅在客户端调用以保证与用户当前时刻一致 */
export function getTodayInIndia(): string {
  return dayjs().tz(INDIA_TZ).format("YYYY-MM-DD");
}

/** 印度自然日加减若干天，返回 YYYY-MM-DD */
export function addIndiaDays(isoDate: string, deltaDays: number): string {
  return dayjs.tz(isoDate, "YYYY-MM-DD", INDIA_TZ).add(deltaDays, "day").format("YYYY-MM-DD");
}

/** 返回该日期在印度时区下的星期几 0=周日, 1=周一, ..., 6=周六（避免使用 Date#getDay() 的本地时区） */
export function getIndiaWeekday(dateStr: string): number {
  const d = dayjs.tz(dateStr, "YYYY-MM-DD", INDIA_TZ);
  return d.isValid() ? d.day() : 0;
}

/**
 * 将「账户时区下的自然日」转为「印度时区下的自然日」用于存储。
 * Google Ads API 的 segments.date 使用账户时区；若账户在印度以西（如美西），
 * 该日 23:59 在印度可能已是次日，按「该日结束时刻在印度对应的日期」归入印度日，避免“今天的数据显示在昨天”。
 * 若 accountTimezone 已是 Asia/Kolkata，则直接返回原日期。
 */
export function accountDateToIndiaDate(segmentDateStr: string, accountTimezone: string): string {
  const trimmed = (segmentDateStr ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (accountTimezone === INDIA_TZ) return trimmed;
  try {
    const endOfAccountDay = dayjs.tz(`${trimmed} 23:59:59`, "YYYY-MM-DD HH:mm:ss", accountTimezone);
    return endOfAccountDay.tz(INDIA_TZ).format("YYYY-MM-DD");
  } catch {
    return trimmed;
  }
}

export { INDIA_TZ };

