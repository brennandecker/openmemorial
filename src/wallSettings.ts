// Posting dates follow the memorial's home time zone, independently of a visitor's device.
export const wallTimeZone = "America/New_York";
export function postedDay(timestamp: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: wallTimeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(timestamp));
}
/** Convert local midnight to an instant, including daylight-saving transitions. */
export function midnightInstant(day: string): string {
  const target = Date.parse(`${day}T00:00:00Z`);
  let guess = target;
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: wallTimeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map(part => [part.type, part.value]));
    const actual = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
    guess += target - actual;
  }
  return new Date(guess).toISOString();
}
export function nextDay(day: string): string { const value = new Date(`${day}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + 1); return value.toISOString().slice(0, 10); }
