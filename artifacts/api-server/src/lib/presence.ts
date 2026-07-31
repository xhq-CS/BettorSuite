export type PresenceStatus = "online" | "idle" | "offline";

const PRESENCE_STALE_AFTER_MS = 150_000;

export function resolvedPresence(
  status: string | null | undefined,
  updatedAt: Date | null | undefined,
  now = Date.now(),
): PresenceStatus {
  if (!updatedAt || now - updatedAt.getTime() > PRESENCE_STALE_AFTER_MS) {
    return "offline";
  }
  return status === "idle" ? "idle" : status === "online" ? "online" : "offline";
}
