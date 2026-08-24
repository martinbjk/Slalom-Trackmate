"use client";

import { parseTrackmateStream, TrackmateEvent } from "./trackmateParser";

// The Web Serial API isn't in TypeScript's default DOM lib yet, so we
// declare just the bits we use rather than pull in a whole @types package.
interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
}
interface NavigatorSerial {
  requestPort(): Promise<SerialPortLike>;
}

export function isWebSerialSupported(): boolean {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

export interface TrackmateConnection {
  disconnect: () => Promise<void>;
}

/**
 * Opens a serial connection to a Trackmate timer and calls onEvent for every
 * parsed reaction/finish message. onRawLine (optional) receives raw decoded
 * text for a debug/troubleshooting view. Requires a user gesture (button
 * click) to call this, per the Web Serial API's permission model.
 *
 * Baud rate defaults to 9600 (common for Trackmate's serial/USB-serial
 * interface) — if a specific unit needs a different rate, adjust here.
 */
export async function connectToTrackmate(
  onEvent: (event: TrackmateEvent) => void,
  onRawLine?: (line: string) => void,
  baudRate = 9600
): Promise<TrackmateConnection> {
  const nav = navigator as unknown as { serial: NavigatorSerial };
  const port = await nav.serial.requestPort();
  await port.open({ baudRate });

  let carry = "";
  let cancelled = false;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  const decoder = new TextDecoder();
  const reader = port.readable?.getReader();

  const processChunk = (text: string) => {
    onRawLine?.(text);
    const { events, remainder } = parseTrackmateStream(text, carry);
    carry = remainder;
    events.forEach(onEvent);

    if (flushTimer) clearTimeout(flushTimer);
    if (carry) {
      // If nothing more arrives shortly, treat the held-back tail as complete
      // anyway — better to parse a message a little late than to lose it.
      flushTimer = setTimeout(() => {
        const { events: flushed } = parseTrackmateStream("", carry);
        // Force-emit even the trailing match this time, since we're giving up on more data.
        const forced = [...carry.matchAll(/@(\d{2})L(\d+)T(\d+)/g)].map((m) => ({
          type: (m[1] === "01" ? "finish" : "reaction") as "finish" | "reaction",
          lane: parseInt(m[2], 10),
          timeMs: parseInt(m[3], 10),
        }));
        (flushed.length ? flushed : forced).forEach(onEvent);
        carry = "";
      }, 200);
    }
  };

  (async () => {
    if (!reader) return;
    while (!cancelled) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) processChunk(decoder.decode(value));
    }
  })();

  return {
    disconnect: async () => {
      cancelled = true;
      try {
        reader?.releaseLock();
        await port.close();
      } catch {
        // Best-effort cleanup — the port may already be gone.
      }
    },
  };
}
