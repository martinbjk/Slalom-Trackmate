"use client";

import { useRef, useState } from "react";
import { connectToTrackmate, isWebSerialSupported, type TrackmateConnection } from "@/lib/timing/serialConnection";
import type { Participant } from "@/lib/types";

interface Props {
  /** Participants in the current heat that don't have a time recorded yet. */
  pendingParticipants: Participant[];
  onFinish: (participantId: string, timeMs: number) => void;
}

const LANE_COUNT = 2; // Trackmate protocol supports more, but 2 covers the common dual-lane setup.

export function TrackmateLiveTiming({ pendingParticipants, onFinish }: Props) {
  const [supported] = useState(isWebSerialSupported());
  const [connected, setConnected] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [laneAssignment, setLaneAssignment] = useState<Record<number, string>>({});
  const [lastEvents, setLastEvents] = useState<string[]>([]);
  const connectionRef = useRef<TrackmateConnection | null>(null);

  if (!supported) {
    return (
      <p className="rounded border border-line bg-black/[0.02] p-3 text-xs text-foreground/60">
        Direktanslutning till tidtagning kräver Chrome eller Edge på dator/Android (stöds inte i Safari, Firefox eller på iPad).
        Du kan fortfarande skriva in tider manuellt ovan.
      </p>
    );
  }

  const connect = async () => {
    setConnectError(null);
    try {
      const conn = await connectToTrackmate(
        (event) => {
          setLastEvents((prev) => [`Bana ${event.lane + 1} · ${event.type === "finish" ? "Mål" : "Reaktion"} · ${event.timeMs} ms`, ...prev].slice(0, 8));
          if (event.type === "finish") {
            setLaneAssignment((prev) => {
              const participantId = prev[event.lane];
              if (participantId) {
                onFinish(participantId, event.timeMs);
                const next = { ...prev };
                delete next[event.lane];
                return next;
              }
              return prev;
            });
          }
        }
      );
      connectionRef.current = conn;
      setConnected(true);
    } catch (err) {
      // The user cancelling the port picker also lands here — that's not a real error.
      if (err instanceof Error && err.name === "NotFoundError") return;
      setConnectError(err instanceof Error ? err.message : String(err));
    }
  };

  const disconnect = async () => {
    await connectionRef.current?.disconnect();
    connectionRef.current = null;
    setConnected(false);
    setLaneAssignment({});
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
            Välj vem som ska köra i respektive bana — tiden fylls i automatiskt när mål-signalen kommer.
          </p>
          <div className="mb-3 grid grid-cols-2 gap-3">
            {Array.from({ length: LANE_COUNT }).map((_, lane) => (
              <div key={lane}>
                <label className="mb-1 block text-xs font-medium text-foreground/70">Bana {lane + 1}</label>
                <select
                  value={laneAssignment[lane] ?? ""}
                  onChange={(e) => setLaneAssignment((prev) => ({ ...prev, [lane]: e.target.value }))}
                  className="w-full rounded border border-line bg-white px-2 py-1.5 text-sm"
                >
                  <option value="">— Välj åkare —</option>
                  {pendingParticipants.map((p) => (
                    <option key={p.id} value={p.id}>
                      #{p.bib_number} {p.first_name} {p.last_name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
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
