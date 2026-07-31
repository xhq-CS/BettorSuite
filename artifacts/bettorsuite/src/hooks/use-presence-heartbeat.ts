import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import type { PresenceStatus } from "@/components/PresenceIndicator";

const HEARTBEAT_INTERVAL_MS = 60_000;
const IDLE_AFTER_MS = 25 * 60_000;

export function usePresenceHeartbeat() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    let lastActivityAt = Date.now();
    let currentStatus: PresenceStatus = "offline";

    const sendPresence = (status: PresenceStatus, force = false) => {
      if (!force && currentStatus === status) return;
      currentStatus = status;
      void api("/presence", {
        method: "POST",
        body: JSON.stringify({ status }),
      }).catch(() => undefined);
    };

    const sendOfflineBeacon = () => {
      currentStatus = "offline";
      const payload = new Blob([JSON.stringify({ status: "offline" })], {
        type: "application/json",
      });
      navigator.sendBeacon("/api/presence", payload);
    };

    const recordActivity = () => {
      lastActivityAt = Date.now();
      if (currentStatus !== "online") sendPresence("online");
    };

    const refreshPresence = () => {
      const status: PresenceStatus =
        Date.now() - lastActivityAt >= IDLE_AFTER_MS ? "idle" : "online";
      sendPresence(status, true);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") recordActivity();
    };
    const handleOnline = () => {
      recordActivity();
      sendPresence("online", true);
    };

    const activityEvents = [
      "keydown",
      "pointerdown",
      "pointermove",
      "scroll",
      "touchstart",
    ] as const;
    activityEvents.forEach((eventName) =>
      window.addEventListener(eventName, recordActivity, { passive: true }),
    );
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", sendOfflineBeacon);
    window.addEventListener("pagehide", sendOfflineBeacon);

    sendPresence("online", true);
    const heartbeat = window.setInterval(
      refreshPresence,
      HEARTBEAT_INTERVAL_MS,
    );

    return () => {
      window.clearInterval(heartbeat);
      activityEvents.forEach((eventName) =>
        window.removeEventListener(eventName, recordActivity),
      );
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", sendOfflineBeacon);
      window.removeEventListener("pagehide", sendOfflineBeacon);
      sendOfflineBeacon();
    };
  }, [user]);
}
