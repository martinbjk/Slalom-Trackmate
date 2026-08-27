"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  connectToTrackmate,
  isWebSerialSupported,
  type TrackmateConnection,
  type TrackmateCommand,
} from "@/lib/timing/serialConnection";
import { TrackmateStreamParser, type TrackmateEvent } from "@/lib/timing/trackmateParser";
import type { Participant } from "@/lib/types";

interface Props {
  /** Participants in the current heat that don't have a time recorded yet, in run order. */
  pendingParticipants: Participant[];
  onFinish: (participantId: string, timeMs: number) => void;
}

/**
 * Live timing for a single-lane setup: racers go down the course one at a
 * time, so we only ever need to know who's currently on the course. The
 * hardware may report multiple lanes (Trackmate supports up to 8), but we
 * don't care which one — the next finish signal, on whichever lane,
 * belongs to whoever is marked as "up next" here.
 */
export function TrackmateLiveTiming({ pendingParticipants, onFinish }: Props) {
  const [supported] = useState(isWebSerialSupported());
  const [connected, setConnected] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [baudRate, setBaudRate] = useState<9600 | 19200>(9600);
  const [nextParticipantId, setNextParticipantId] = useState<string>("");
  const [lastEvents, setLastEvents] = useState<string[]>([]);
  const connectionRef = useRef<TrackmateConnection | null>(null);
  const simulatorParserRef = useRef<TrackmateStreamParser | null>(null);
  const simulatorStartRef = useRef<number>(0);
  const nextParticipantRef = useRef(nextParticipantId);
  nextParticipantRef.current = nextParticipantId;

  // Default to the first not-yet-timed participant, and keep pointing at one
  // of them as results come in (unless the operator has picked one manually).
  useEffect(() => {
    if (!nextParticipantId || !pendingParticipants.some((p) => p.id === nextParticipantId)) {
      setNextParticipantId(pendingParticipants[0]?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingParticipants]);

  // Shared by both the real serial connection and the keyboard simulator,
  // so testing without hardware exercises exactly the same downstream logic.
  const handleEvent = useCallback(
    (event: TrackmateEvent) => {
      setLastEvents((prev) => [`Bana ${event.lane} · ${event.type === "finish" ? "Mål" : "Start"} · ${event.timeMs} ms`, ...prev].slice(0, 8));
      if (event.type === "finish" && nextParticipantRef.current) {
        onFinish(nextParticipantRef.current, event.timeMs);
        // pendingParticipants will update on the next render and the effect
        // above will move the pointer to whoever's next.
      }
    },
    [onFinish]
  );

  // Keyboard simulator: press spacebar to simulate a start/finish signal on
  // lane 1 — the only lane actually wired in this setup — without needing
  // the Trackmate box connected at all. First press = start, second press
  // (same lane) = finish (same stateful behavior as the real hardware).
  useEffect(() => {
    if (!simulating) return;

    const SIMULATED_LANE = 1;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      e.preventDefault();
      const elapsedMs = Math.round(performance.now() - simulatorStartRef.current);
      const hex = elapsedMs.toString(16).padStart(8, "0").toUpperCase();
      const line = `L${SIMULATED_LANE} ${hex}\r\n`;
      simulatorParserRef.current?.feed(line).forEach(handleEvent);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [simulating, handleEvent]);

  if (!supported) {
    return (
      <p className="rounded border border-line bg-black/[0.02] p-3 text-xs text-foreground/60">
        Direktanslutning till tidtagning kräver Chrome eller Edge på dator/Android (stöds inte i Safari, Firefox eller på iPad).
        Du kan fortfarande skriva in tider manuellt nedan.
      </p>
    );
  }

  const connect = async () => {
    setConnectError(null);
    try {
      const conn = await connectToTrackmate(handleEvent, undefined, baudRate);
      connectionRef.current = conn;
      setConnected(true);
    } catch (err) {
      if (err instanceof Error && err.name === "NotFoundError") return; // user cancelled the port picker
      setConnectError(err instanceof Error ? err.message : String(err));
    }
  };

  const disconnect = async () => {
    await connectionRef.current?.disconnect();
    connectionRef.current = null;
    setConnected(false);
  };

  const startSimulator = () => {
    simulatorParserRef.current = new TrackmateStreamParser();
    simulatorStartRef.current = performance.now();
    setLastEvents([]);
    setSimulating(true);
  };

  const stopSimulator = () => {
    simulatorParserRef.current = null;
    setSimulating(false);
  };

  const sendCommand = async (command: TrackmateCommand) => {
    try {
      if (simulating && command === "H") {
        simulatorParserRef.current?.reset();
        simulatorStartRef.current = performance.now();
        setLastEvents((prev) => [`→ Simulerat kommando "H" (nollställd klocka)`, ...prev].slice(0, 8));
        return;
      }
      await connectionRef.current?.sendCommand(command);
      setLastEvents((prev) => [`→ Skickade kommando "${command}" till hårdvaran`, ...prev].slice(0, 8));
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : String(err));
    }
  };

  const active = connected || simulating;

  return (
    <div className="mb-4 rounded border border-line bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Live-tidtagning (Trackmate)</h2>
        <div className="flex items-center gap-2">
          {!active && (
            <select
              value={baudRate}
              onChange={(e) => setBaudRate(Number(e.target.value) as 9600 | 19200)}
              className="rounded border border-line bg-white px-2 py-1.5 text-xs"
              title="Baudrate (beror på hårdvaruversion/firmware)"
            >
              <option value={9600}>9600 baud</option>
              <option value={19200}>19200 baud</option>
            </select>
          )}
          {!active && (
            <button onClick={connect} className="rounded bg-cone px-3 py-1.5 text-xs font-semibold text-white hover:bg-cone-dark">
              Anslut tidtagning
            </button>
          )}
          {!active && (
            <button
              onClick={startSimulator}
              title="Testa hela flödet med tangentbordet, utan att koppla in Trackmate-boxen"
              className="rounded border border-line bg-white px-3 py-1.5 text-xs font-medium hover:bg-black/5"
            >
              Simulera (utan hårdvara)
            </button>
          )}
          {connected && (
            <button onClick={disconnect} className="rounded bg-signal-red px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
              Koppla från
            </button>
          )}
          {simulating && (
            <button onClick={stopSimulator} className="rounded bg-signal-red px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
              Avsluta simulering
            </button>
          )}
        </div>
      </div>

      {connectError && <p className="mb-3 text-xs text-signal-red">Kunde inte ansluta: {connectError}</p>}

      {simulating && (
        <p className="mb-3 rounded bg-cone/10 px-3 py-2 text-xs text-cone-dark">
          Simuleringsläge aktivt — tryck <strong>mellanslag</strong>: första tryck = start, andra tryck = mål. Ingen hårdvara behövs.
        </p>
      )}

      {active && (
        <>
          <p className="mb-2 text-xs text-foreground/60">
            Nästa mål-signal fylls i automatiskt för åkaren nedan. Hoppar vidare till nästa efter varje mål.
          </p>
          <div className="mb-3 max-w-xs">
            <label className="mb-1 block text-xs font-medium text-foreground/70">Nu på banan</label>
            <select
              value={nextParticipantId}
              onChange={(e) => setNextParticipantId(e.target.value)}
              className="w-full rounded border border-line bg-white px-2 py-1.5 text-sm"
            >
              <option value="">— Ingen —</option>
              {pendingParticipants.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.bib_number} {p.first_name} {p.last_name}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-foreground/70">Hårdvarukommandon{simulating && " (simulerade)"}</label>
            <div className="flex gap-2">
              <button
                onClick={() => sendCommand("H")}
                title="Nollställer klockan — skicka inför varje nytt heat"
                className="rounded border border-line bg-white px-3 py-1.5 text-xs font-medium hover:bg-black/5"
              >
                Nollställ klocka (H)
              </button>
              <button
                onClick={() => sendCommand("S")}
                title="Startar hårdvarans automatiska ljus-/pipsekvens"
                disabled={simulating}
                className="rounded border border-line bg-white px-3 py-1.5 text-xs font-medium hover:bg-black/5 disabled:opacity-40"
              >
                Starta sekvens (S)
              </button>
              <button
                onClick={() => sendCommand("G")}
                title="Tvingar igång tidtagningen manuellt (om ingen extern startbrytare finns)"
                disabled={simulating}
                className="rounded border border-line bg-white px-3 py-1.5 text-xs font-medium hover:bg-black/5 disabled:opacity-40"
              >
                Tvinga start (G)
              </button>
            </div>
          </div>

          {lastEvents.length > 0 && (
            <div className="rounded bg-black/[0.03] p-2 font-mono text-[11px] text-foreground/60">
              {lastEvents.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
