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
        const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          const context = new AudioContextClass();
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.frequency.value = 880;
          gain.gain.setValueAtTime(0.035, context.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.12);
          oscillator.connect(gain).connect(context.destination);
          oscillator.start();
          oscillator.stop(context.currentTime + 0.12);
          oscillator.addEventListener("ended", () => void context.close());
        }
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
