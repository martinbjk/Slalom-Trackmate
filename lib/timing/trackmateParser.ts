// Trackmate serial protocol, per the official "Racing Tidtagning" technical
// specification (not the earlier @00L0T195-style example, which turned out
// to describe a different/incorrect format).
//
// Each line looks like: L5 000300A2\r\n
//   [Prefix][Lane] [Hex timestamp]
//   Lane      = 1-8 (L1..L8)
//   Timestamp = the hardware's internal clock, in milliseconds, as a
//               HEX string (not decimal).
//
// Critically: Trackmate reuses the SAME prefix for both the start and the
// finish of a run on a given lane — there is no event-type code in the
// message. The receiving software must track each lane's state itself:
//   - "waiting": the next timestamp for this lane is a START. Store it,
//     move the lane to "active".
//   - "active": the next timestamp for this lane is a FINISH. Elapsed time
//     = finish - start. Move the lane back to "waiting" for the next racer.
//
// This parser is stateful (per lane) and stream-safe (buffers partial
// lines across chunks) — construct one instance per connection and call
// feed() with each raw decoded chunk.

export interface TrackmateEvent {
  type: "start" | "finish";
  lane: number; // 1-indexed (L1 = lane 1), matching the hardware's own numbering
  /** For "finish": elapsed run time in ms (finish timestamp − start timestamp). For "start": the raw hardware clock timestamp in ms. */
  timeMs: number;
}

const LINE_RE = /^L([1-8])\s+([0-9A-Fa-f]+)$/;

type LaneState = "waiting" | "active";

export class TrackmateStreamParser {
  private carry = "";
  private laneState = new Map<number, LaneState>();
  private laneStartMs = new Map<number, number>();

  /** Feed a raw decoded chunk of serial data. Returns any complete events found. */
  feed(chunk: string): TrackmateEvent[] {
    const text = this.carry + chunk;
    const lines = text.split(/\r\n|\r|\n/);
    // Hold back a trailing partial line (one with no terminator yet).
    this.carry = lines.pop() ?? "";

    const events: TrackmateEvent[] = [];
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      const match = LINE_RE.exec(line);
      if (!match) continue; // ignore anything that isn't a recognized L{n} {hex} line

      const lane = parseInt(match[1], 10);
      const timestampMs = parseInt(match[2], 16);

      const state = this.laneState.get(lane) ?? "waiting";
      if (state === "waiting") {
        this.laneStartMs.set(lane, timestampMs);
        this.laneState.set(lane, "active");
        events.push({ type: "start", lane, timeMs: timestampMs });
      } else {
        const startMs = this.laneStartMs.get(lane) ?? timestampMs;
        const elapsed = timestampMs - startMs;
        this.laneState.set(lane, "waiting");
        events.push({ type: "finish", lane, timeMs: elapsed });
      }
    }
    return events;
  }

  /** Resets tracked lane state — call if you send an "H" reset command to the hardware, so software and hardware clocks agree. */
  reset(): void {
    this.laneState.clear();
    this.laneStartMs.clear();
    this.carry = "";
  }
}
