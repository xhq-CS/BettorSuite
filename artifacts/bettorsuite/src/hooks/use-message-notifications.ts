import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Conversation } from "@/lib/social-types";

interface NotificationGroup {
  id: number;
  isMember: boolean;
  notificationsMuted: boolean;
  unreadCount: number;
}

interface PendingInvite {
  id: number;
}

let lastNotificationPlayedAt = 0;

function playNotificationTone() {
  const now = Date.now();
  if (now - lastNotificationPlayedAt < 500) return;

  const AudioContextClass =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextClass) return;

  lastNotificationPlayedAt = now;
  const context = new AudioContextClass();
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-18, context.currentTime);
  compressor.knee.setValueAtTime(18, context.currentTime);
  compressor.ratio.setValueAtTime(4, context.currentTime);
  compressor.attack.setValueAtTime(0.003, context.currentTime);
  compressor.release.setValueAtTime(0.18, context.currentTime);
  compressor.connect(context.destination);

  const notes = [
    { frequency: 659.25, offset: 0, duration: 0.18 },
    { frequency: 987.77, offset: 0.12, duration: 0.22 },
  ];

  notes.forEach(({ frequency, offset, duration }, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const startsAt = context.currentTime + offset;
    const endsAt = startsAt + duration;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, startsAt);
    gain.gain.setValueAtTime(0.0001, startsAt);
    gain.gain.exponentialRampToValueAtTime(0.14, startsAt + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, endsAt);
    oscillator.connect(gain).connect(compressor);
    oscillator.start(startsAt);
    oscillator.stop(endsAt);

    if (index === notes.length - 1) {
      oscillator.addEventListener("ended", () => void context.close());
    }
  });
}

export function useMessageNotifications() {
  const previousCount = useRef<number | null>(null);
  const conversations = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api<Conversation[]>("/conversations"),
    refetchInterval: 4000,
  });
  const groups = useQuery({
    queryKey: ["groups"],
    queryFn: () => api<NotificationGroup[]>("/groups"),
    refetchInterval: 4000,
  });
  const invites = useQuery({
    queryKey: ["group-invites"],
    queryFn: () => api<PendingInvite[]>("/groups/invites/pending"),
    refetchInterval: 4000,
  });

  const directUnread = (conversations.data ?? []).reduce(
    (total, conversation) =>
      total + (conversation.notificationsMuted ? 0 : conversation.unreadCount),
    0,
  );
  const groupUnread = (groups.data ?? []).reduce(
    (total, group) =>
      total +
      (group.isMember && !group.notificationsMuted ? group.unreadCount : 0),
    0,
  );
  const inviteCount = invites.data?.length ?? 0;
  const count = directUnread + groupUnread + inviteCount;

  useEffect(() => {
    if (previousCount.current !== null && count > previousCount.current) {
      try {
        playNotificationTone();
      } catch {
        // Audio may be blocked until the first user interaction.
      }
    }
    previousCount.current = count;
  }, [count]);

  return {
    count,
    directUnread,
    groupUnread,
    inviteCount,
  };
}
