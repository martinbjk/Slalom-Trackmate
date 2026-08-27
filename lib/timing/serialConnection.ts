"use client";

import { TrackmateStreamParser, TrackmateEvent } from "./trackmateParser";

// The Web Serial API isn't in TypeScript's default DOM lib yet, so we
// declare just the bits we use rather than pull in a whole @types package.
interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
}
interface NavigatorSerial {
  requestPort(): Promise<SerialPortLike>;
}

export function isWebSerialSupported(): boolean {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

/** Single-byte control commands the hardware accepts, per the Racing Tidtagning spec section 4. */
export type TrackmateCommand = "H" | "S" | "G";

export interface TrackmateConnection {
  disconnect: () => Promise<void>;
  /** Sends a control byte to the hardware: H = reset clock, S = start light/beep sequence, G = force start. */
  sendCommand: (command: TrackmateCommand) => Promise<void>;
}

/**
 * Opens a serial connection to a Trackmate timer and calls onEvent for every
 * parsed start/finish message. onRawLine (optional) receives raw decoded
 * text for a debug/troubleshooting view. Requires a user gesture (button
 * click) to call this, per the Web Serial API's permission model.
 *
 * Baud rate: the hardware uses 9600 or 19200 depending on firmware version —
 * defaults to 9600; pass 19200 if your unit needs it.
 */
export async function connectToTrackmate(
  onEvent: (event: TrackmateEvent) => void,
  onRawLine?: (line: string) => void,
  baudRate: 9600 | 19200 = 9600
): Promise<TrackmateConnection> {
  const nav = navigator as unknown as { serial: NavigatorSerial };
  const port = await nav.serial.requestPort();
  await port.open({ baudRate });

  let cancelled = false;
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const parser = new TrackmateStreamParser();
  const reader = port.readable?.getReader();
  const writer = port.writable?.getWriter();

  (async () => {
    if (!reader) return;
    while (!cancelled) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        const text = decoder.decode(value);
        onRawLine?.(text);
        parser.feed(text).forEach(onEvent);
      }
    }
  })();

  return {
    disconnect: async () => {
      cancelled = true;
      try {
        writer?.releaseLock();
        reader?.releaseLock();
        await port.close();
      } catch {
        // Best-effort cleanup — the port may already be gone.
      }
    },
    sendCommand: async (command: TrackmateCommand) => {
      if (!writer) throw new Error("Serial port is not writable — cannot send command.");
      await writer.write(encoder.encode(command));
      if (command === "H") parser.reset(); // hardware clock zeroed — our lane tracking must follow
    },
  };
}
