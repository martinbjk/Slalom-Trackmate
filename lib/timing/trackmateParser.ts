// Trackmate slalom timer serial protocol.
//
// Messages look like: @00L0T195  or  @01L0T11795
//   @{EE}L{lane}T{ms}
//   EE   = event type: "00" = reaction (start), "01" = finish
//   lane = 0-indexed lane number (0 = Lane 1, 1 = Lane 2, ...)
//   ms   = time in milliseconds. For a finish event this is the full
//          elapsed race time from the start signal — ready to use
//          directly as a result time, no further math needed.
//
// Messages arrive back-to-back over the serial line, not necessarily one
// per read chunk, so the caller should feed raw text through
// parseTrackmateStream and keep the returned `remainder` for the next chunk.

export interface TrackmateEvent {
  type: "reaction" | "finish";
  lane: number; // 0-indexed
  timeMs: number;
}

const MESSAGE_RE = /@(\d{2})L(\d+)T(\d+)/g;

/**
 * Parses as many complete messages as it can find in `chunk`, prepending any
 * leftover partial text from a previous call. Returns the parsed events plus
 * whatever trailing partial text should be carried over to the next chunk.
 *
 * We don't know whether the protocol terminates messages with a newline or
 * sends them back-to-back with no separator, so we can't safely assume
 * either. Instead: if the *last* match found touches the very end of the
 * buffered text, its number might be truncated (more digits could arrive in
 * the next read) — so we hold that one back and only emit the matches
 * before it. The held-back message gets parsed on the next call once more
 * data (even just one more byte) confirms where it actually ends.
 */
export function parseTrackmateStream(
  chunk: string,
  carry: string
): { events: TrackmateEvent[]; remainder: string } {
  const text = carry + chunk;
  const matches = [...text.matchAll(MESSAGE_RE)];
  if (matches.length === 0) {
    return { events: [], remainder: text.slice(-64) };
  }

  const last = matches[matches.length - 1];
  const lastEnd = (last.index ?? 0) + last[0].length;
  const lastTouchesEnd = lastEnd === text.length;
  const emitMatches = lastTouchesEnd ? matches.slice(0, -1) : matches;

  const events: TrackmateEvent[] = emitMatches.map((m) => ({
    type: m[1] === "01" ? "finish" : "reaction",
    lane: parseInt(m[2], 10),
    timeMs: parseInt(m[3], 10),
  }));

  const remainder = lastTouchesEnd ? text.slice(last.index ?? 0) : text.slice(lastEnd);
  return { events, remainder: remainder.slice(-64) }; // cap to avoid unbounded growth on garbage input
}
