/** Parses "mm:ss.xxx", "ss.xxx" or plain seconds into milliseconds. Returns null if unparsable. */
export function parseTimeToMs(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(?:(\d+):)?(\d{1,2})(?:[.,](\d{1,3}))?$/);
  if (!match) return null;

  const minutes = match[1] ? parseInt(match[1], 10) : 0;
  const seconds = parseInt(match[2], 10);
  const fraction = match[3] ? match[3].padEnd(3, "0").slice(0, 3) : "0";

  return minutes * 60_000 + seconds * 1000 + parseInt(fraction, 10);
}

/** Formats to mm:ss.xxx — full millisecond precision (1/1000s), per World Skate's timing accuracy standard (section 3.6). */
export function formatMsToTime(ms: number | null): string {
  if (ms === null || Number.isNaN(ms)) return "—";
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  const milliseconds = Math.floor(ms % 1000);
  const mm = minutes > 0 ? `${minutes}:` : "";
  const ss = minutes > 0 ? String(seconds).padStart(2, "0") : String(seconds);
  return `${mm}${ss}.${String(milliseconds).padStart(3, "0")}`;
}
