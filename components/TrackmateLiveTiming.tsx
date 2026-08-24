"use client";

import { useEffect, useRef, useState } from "react";
import { connectToTrackmate, isWebSerialSupported, type TrackmateConnection } from "@/lib/timing/serialConnection";
import type { Participant } from "@/lib/types";

interface Props {
  /** Participants in the current heat that don't have a time recorded yet, in run order. */
  pendingParticipants: Participant[];
  onFinish: (participantId: string, timeMs: number) => void;
}

/**
 * Live timing for a single-lane setup: racers go down the course one at a
 * time, so we only ever need to know who's currently on the course. The
 * hardware may still report a lane number (Trackmate supports multi-lane
 * gates), but we don't care which one — the next finish signal, on
 * whichever lane, belongs to whoever is marked as "up next" here.
 */
export function TrackmateLiveTiming({ pendingParticipants, onFinish }: Props) {
  const [supported] = useState(isWebSerialSupported());
  const [connected, setConnected] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [nextParticipantId, setNextParticipantId] = useState<string>("");
  const [lastEvents, setLastEvents] = useState<string[]>([]);
  const connectionRef = useRef<TrackmateConnection | null>(null);
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
      const conn = await connectToTrackmate((event) => {
        setLastEvents((prev) => [`Bana ${event.lane + 1} · ${event.type === "finish" ? "Mål" : "Reaktion"} · ${event.timeMs} ms`, ...prev].slice(0, 8));
        if (event.type === "finish" && nextParticipantRef.current) {
          onFinish(nextParticipantRef.current, event.timeMs);
          // pendingParticipants will update on the next render and the effect
          // above will move the pointer to whoever's next.
        }
      });
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

  return (
    <div className="mb-4 rounded border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Live-tidtagning (Trackmate)</h2>
        {!connected ? (
          <button onClick={connect} className="rounded bg-cone px-3 py-1.5 text-xs font-semibold text-white hover:bg-cone-dark">
            Anslut tidtagning
          </button>
        ) : (
          <button onClick={disconnect} className="rounded bg-signal-red px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
            Koppla från
          </button>
        )}
      </div>

      {connectError && <p className="mb-3 text-xs text-signal-red">Kunde inte ansluta: {connectError}</p>}

      {connected && (
        <>
          <p className="mb-2 text-xs text-foreground/60">
            Nästa mål-signal från tidtagningen fylls i automatiskt för åkaren nedan. Hoppar vidare till nästa efter varje mål.
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
