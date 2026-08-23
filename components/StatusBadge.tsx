import type { ParticipantStatus } from "@/lib/types";

const STYLES: Record<ParticipantStatus, string> = {
  active: "bg-signal-green/10 text-signal-green",
  DNS: "bg-signal-gray/10 text-signal-gray",
  DSQ: "bg-signal-red/10 text-signal-red",
  DNF: "bg-signal-gray/10 text-signal-gray",
};

export function StatusBadge({ status }: { status: ParticipantStatus }) {
  const label = status === "active" ? "OK" : status;
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${STYLES[status]}`}>{label}</span>
  );
}
