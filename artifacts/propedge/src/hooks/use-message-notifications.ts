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

  return {
    count: directUnread + groupUnread + inviteCount,
    directUnread,
    groupUnread,
    inviteCount,
  };
}
