import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bell,
  BellOff,
  Check,
  Layers3,
  LogOut,
  Pencil,
  Send,
  ShieldCheck,
  Trash2,
  UserMinus,
  Volume2,
  VolumeX,
  X,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MessageShortcutHint } from "@/components/chat/MessageShortcutHint";
import {
  SharedBetCard,
  type SharedBetSnapshot,
} from "@/components/shared-bets/SharedBetCard";
import { TailBetDialog } from "@/components/shared-bets/TailBetDialog";
import { DailyCardCard } from "@/components/daily-cards/DailyCardCard";
import { DailyCardDialog } from "@/components/daily-cards/DailyCardDialog";
import type { DailyCard } from "@/lib/social-types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PresenceIndicator, type PresenceStatus } from "@/components/PresenceIndicator";

type Member = {
  userId: number;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  nickname: string | null;
  presenceStatus: PresenceStatus;
  role: string;
  muted: boolean;
  mutedAt: string | null;
};
type Group = {
  id: number;
  name: string;
  description: string | null;
  creatorId: number | null;
  isMember: boolean;
  isOwner: boolean;
  canManage: boolean;
  isPlatformAdmin: boolean;
  postingMuted: boolean;
  notificationsMuted: boolean;
  role: string | null;
  members: Member[];
  invites: { id: number; userId: number; status: string }[];
};
type Message = {
  id: number;
  senderId: number;
  senderUsername: string;
  senderAvatarUrl: string | null;
  senderNickname: string | null;
  senderPresenceStatus: PresenceStatus;
  content: string;
  betShare: SharedBetSnapshot | null;
  dailyCard: DailyCard | null;
  createdAt: string;
  editedAt: string | null;
};
type User = {
  id: number;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  nickname: string | null;
  presenceStatus: PresenceStatus;
};

const memberName = (member: Member) =>
  member.nickname || member.displayName || member.username;

const sortMembers = (members: Member[], creatorId: number | null) =>
  [...members].sort((a, b) => {
    const ownerOrder =
      Number(b.userId === creatorId) - Number(a.userId === creatorId);
    return ownerOrder || memberName(a).localeCompare(memberName(b));
  });

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const groupId = Number(id);
  const { user } = useAuth();
  const [, nav] = useLocation();
  const source = new URLSearchParams(window.location.search).get("from");
  const returnTo = source === "messages" ? "/messages?view=groups" : "/community";
  const returnLabel = source === "messages" ? "Back to Messages" : "Back to Community";
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [tailBet, setTailBet] = useState<SharedBetSnapshot | null>(null);
  const [showDailyCard, setShowDailyCard] = useState(false);
  const [showEditGroup, setShowEditGroup] = useState(false);
  const [showDeleteGroup, setShowDeleteGroup] = useState(false);
  const [showLeaveGroup, setShowLeaveGroup] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);

  const group = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => api<Group>(`/groups/${groupId}`),
    refetchInterval: 2000,
  });
  const messages = useQuery({
    queryKey: ["group-messages", groupId],
    queryFn: () => api<Message[]>(`/groups/${groupId}/messages`),
    enabled: !!group.data?.isMember,
    refetchInterval: 3000,
  });
  const users = useQuery({
    queryKey: ["group-user-search", search],
    queryFn: () => api<User[]>(`/users?search=${encodeURIComponent(search)}`),
    enabled: search.length >= 2,
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["group", groupId] });
    qc.invalidateQueries({ queryKey: ["group-messages", groupId] });
  };
  const action = useMutation({
    mutationFn: ({
      path,
      method = "POST",
    }: {
      path: string;
      method?: string;
    }) => api(path, { method }),
    onSuccess: refresh,
  });
  const send = useMutation({
    mutationFn: () =>
      api(`/groups/${groupId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: message }),
      }),
    onSuccess: () => {
      setMessage("");
      refresh();
    },
    onError: (error) => {
      group.refetch();
      toast.error(
        error instanceof Error
          ? error.message
          : "You do not have permission to send messages in this channel.",
      );
    },
  });
  const edit = useMutation({
    mutationFn: ({
      messageId,
      content,
    }: {
      messageId: number;
      content: string;
    }) =>
      api(`/groups/${groupId}/messages/${messageId}`, {
        method: "PATCH",
        body: JSON.stringify({ content }),
      }),
    onSuccess: () => {
      setEditingId(null);
      setEditText("");
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (messageId: number) =>
      api(`/groups/${groupId}/messages/${messageId}`, { method: "DELETE" }),
    onSuccess: () => {
      setDeletingId(null);
      refresh();
    },
  });
  const updateGroup = useMutation({
    mutationFn: () =>
      api<Group>(`/groups/${groupId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: groupName,
          description: groupDescription,
        }),
      }),
    onSuccess: () => {
      setShowEditGroup(false);
      qc.invalidateQueries({ queryKey: ["group", groupId] });
      qc.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Group updated");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not update group",
      ),
  });
  const deleteGroup = useMutation({
    mutationFn: () => api(`/groups/${groupId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.removeQueries({ queryKey: ["group", groupId] });
      qc.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Group deleted");
      nav(returnTo);
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not delete group",
      ),
  });
  const toggleNotifications = useMutation({
    mutationFn: (muted: boolean) =>
      api(`/groups/${groupId}/notifications`, {
        method: "PATCH",
        body: JSON.stringify({ muted }),
      }),
    onSuccess: (_, muted) => {
      refresh();
      qc.invalidateQueries({ queryKey: ["groups"] });
      toast.success(muted ? "Group chat muted" : "Group chat unmuted");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not update notifications",
      ),
  });
  const leaveGroup = useMutation({
    mutationFn: () => api(`/groups/${groupId}/leave`, { method: "POST" }),
    onSuccess: () => {
      setShowLeaveGroup(false);
      qc.removeQueries({ queryKey: ["group", groupId] });
      qc.removeQueries({ queryKey: ["group-messages", groupId] });
      qc.invalidateQueries({ queryKey: ["groups"] });
      toast.success("You left the group");
      nav(returnTo);
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not leave group",
      ),
  });
  const removeMember = useMutation({
    mutationFn: (member: Member) =>
      api(`/groups/${groupId}/members/${member.userId}`, { method: "DELETE" }),
    onSuccess: (_, member) => {
      setMemberToRemove(null);
      refresh();
      qc.invalidateQueries({ queryKey: ["groups"] });
      toast.success(`@${member.username} removed`);
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not remove member",
      ),
  });
  const muteMember = useMutation({
    mutationFn: ({ member, muted }: { member: Member; muted: boolean }) =>
      api(`/groups/${groupId}/members/${member.userId}/mute`, {
        method: "PATCH",
        body: JSON.stringify({ muted }),
      }),
    onSuccess: (_, { member, muted }) => {
      refresh();
      toast.success(`@${member.username} ${muted ? "muted" : "unmuted"}`);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not update member"),
  });
  const submit = () => {
    if (message.trim() && !send.isPending) send.mutate();
  };

  if (group.isLoading) return <p>Loading group…</p>;
  if (!group.data) return <p>Group not found.</p>;
  const g = group.data;
  const owner =
    g.isOwner ||
    g.creatorId === user?.id ||
    (g.creatorId == null && g.role === "admin");
  const manager = g.canManage || owner;
  const memberSections = [
    {
      label: "Online",
      members: sortMembers(
        g.members.filter((member) => member.presenceStatus !== "offline"),
        g.creatorId,
      ),
    },
    {
      label: "Offline",
      members: sortMembers(
        g.members.filter((member) => member.presenceStatus === "offline"),
        g.creatorId,
      ),
    },
  ].filter((section) => section.members.length > 0);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <Button variant="ghost" onClick={() => nav(returnTo)}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        {returnLabel}
      </Button>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-display font-bold">{g.name}</h1>
            {owner && (
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-700">
                Owner
              </span>
            )}
            {g.isPlatformAdmin && !owner && (
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-700">
                <ShieldCheck className="h-3 w-3" /> Platform Admin
              </span>
            )}
          </div>
          <p className="mt-1 text-muted-foreground">
            {g.description || "No description yet."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {g.isMember && <Button type="button" variant="outline" onClick={() => setShowGroupSettings(true)}><Settings className="mr-2 h-4 w-4" />Group Settings</Button>}
          {g.isMember && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDailyCard(true)}
              disabled={g.postingMuted}
            >
              <Layers3 className="mr-2 h-4 w-4 text-blue-600" />
              Post Daily Card
            </Button>
          )}
        </div>
      </div>
      {!g.isMember ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="mb-4">Join this group to see and send messages.</p>
            <Button
              onClick={() => action.mutate({ path: `/groups/${groupId}/join` })}
            >
              Join group
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-[1fr_300px] gap-4">
          <Card className="min-h-[560px] flex flex-col">
            <CardHeader>
              <CardTitle>Group chat</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="flex min-h-[320px] max-h-[430px] flex-1 flex-col gap-3 overflow-y-auto px-2 py-3">
                {messages.data?.map((item) => {
                  const mine = item.senderId === user?.id;
                  const canEdit = mine || g.isPlatformAdmin;
                  const canDelete = mine || manager;
                  const isEditing = editingId === item.id;
                  const hasAttachment = Boolean(
                    item.betShare || item.dailyCard,
                  );
                  const timestamp = new Date(item.createdAt).toLocaleString(
                    [],
                    {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    },
                  );
                  return (
                    <div
                      key={item.id}
                      className={`group flex w-full ${mine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`flex max-w-[82%] flex-col ${mine ? "items-end" : "items-start"}`}
                      >
                        {!mine && (
                          <button
                            type="button"
                            onClick={() => nav(`/profile/${item.senderId}`)}
                            className="mb-1 ml-3 text-[11px] font-semibold text-slate-500 hover:text-blue-600 hover:underline"
                          >
                            {item.senderNickname || `@${item.senderUsername}`}
                          </button>
                        )}
                        <div
                          className={`flex items-end gap-1.5 ${mine ? "flex-row-reverse" : ""}`}
                        >
                          <div
                            className={`min-w-0 shadow-sm ${isEditing ? "w-[min(520px,72vw)] rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-slate-950" : hasAttachment ? "w-[min(600px,80vw)] rounded-2xl border border-slate-200 bg-slate-50 p-2 text-slate-950" : mine ? "rounded-[20px] rounded-br-md bg-[#0A84FF] px-4 py-2.5 text-white" : "rounded-[20px] rounded-bl-md bg-[#E9E9EB] px-4 py-2.5 text-slate-950"}`}
                          >
                            {isEditing ? (
                              <div className="space-y-2">
                                <Textarea
                                  value={editText}
                                  onChange={(event) =>
                                    setEditText(event.target.value)
                                  }
                                  maxLength={2000}
                                  rows={3}
                                  className="resize-y border-slate-200 bg-white"
                                  autoFocus
                                />
                                <div className="flex justify-end gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setEditingId(null)}
                                  >
                                    <X className="w-4 h-4 mr-1" />
                                    Cancel
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={
                                      !editText.trim() || edit.isPending
                                    }
                                    onClick={() =>
                                      edit.mutate({
                                        messageId: item.id,
                                        content: editText,
                                      })
                                    }
                                  >
                                    <Check className="w-4 h-4 mr-1" />
                                    Save
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2.5">
                                {item.content && (
                                  <p
                                    className={`whitespace-pre-wrap break-words text-[15px] leading-5 ${hasAttachment ? "px-2 pt-1" : ""}`}
                                  >
                                    {item.content}
                                  </p>
                                )}
                                {item.betShare && (
                                  <SharedBetCard
                                    bet={item.betShare}
                                    onTail={setTailBet}
                                  />
                                )}
                                {item.dailyCard && (
                                  <DailyCardCard
                                    card={item.dailyCard}
                                    compact
                                    onTail={setTailBet}
                                  />
                                )}
                              </div>
                            )}
                          </div>
                          {canDelete &&
                            !isEditing &&
                            (deletingId === item.id ? (
                              <div className="mb-0.5 flex items-center gap-1 rounded-full border border-red-100 bg-white px-1.5 py-1 shadow-sm">
                                <span className="ml-1 text-[11px] text-muted-foreground">
                                  Delete?
                                </span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 rounded-full px-2"
                                  onClick={() => setDeletingId(null)}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 rounded-full px-2"
                                  disabled={remove.isPending}
                                  onClick={() => remove.mutate(item.id)}
                                >
                                  Delete
                                </Button>
                              </div>
                            ) : (
                              <div className="mb-0.5 flex gap-0.5 opacity-70 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                                {canEdit && (
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 rounded-full text-slate-500"
                                    aria-label="Edit message"
                                    title="Edit message"
                                    onClick={() => {
                                      setDeletingId(null);
                                      setEditingId(item.id);
                                      setEditText(item.content);
                                    }}
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 rounded-full text-destructive hover:text-destructive"
                                  aria-label={
                                    mine
                                      ? "Delete message"
                                      : "Delete message as admin"
                                  }
                                  title={
                                    mine
                                      ? "Delete message"
                                      : "Delete message as admin"
                                  }
                                  onClick={() => setDeletingId(item.id)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            ))}
                        </div>
                        <div
                          className={`mt-1 px-2 text-[10px] text-slate-400 ${mine ? "text-right" : "text-left"}`}
                        >
                          {timestamp}
                          {item.editedAt && (
                            <span className="ml-1 italic">(edited)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {!messages.data?.length && (
                  <p className="m-auto text-sm text-muted-foreground">
                    No messages yet. Start the conversation.
                  </p>
                )}
              </div>
              {g.postingMuted && (
                <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                  You do not have permission to send messages in this channel.
                </div>
              )}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  submit();
                }}
                className="flex items-end gap-2 border-t pt-4"
              >
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-10 w-10 shrink-0 rounded-full"
                  aria-label="Post daily card"
                  title="Post daily card"
                  onClick={() => setShowDailyCard(true)}
                  disabled={g.postingMuted}
                >
                  <Layers3 className="h-4 w-4" />
                </Button>
                <Textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      submit();
                    }
                  }}
                  placeholder="Message this group…"
                  maxLength={2000}
                  rows={2}
                  className="max-h-40 min-h-[46px] resize-y rounded-2xl border-slate-300 bg-white px-4 py-3"
                  disabled={g.postingMuted}
                />
                <Button
                  type="submit"
                  size="icon"
                  className="h-10 w-10 shrink-0 rounded-full bg-[#0A84FF] hover:bg-[#0077ED]"
                  aria-label="Send message"
                  disabled={g.postingMuted || !message.trim() || send.isPending}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
              <MessageShortcutHint />
            </CardContent>
          </Card>
          <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Members</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {memberSections.map((section) => (
                <section key={section.label} aria-label={`${section.label} members`}>
                  <div className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    {section.label} — {section.members.length}
                  </div>
                  <div className="space-y-1">
                    {section.members.map((member) => (
                      <div
                        key={member.userId}
                        className="flex items-center justify-between gap-2 rounded-lg px-1 py-1.5 text-sm"
                      >
                        <button
                          type="button"
                          onClick={() => nav(`/profile/${member.userId}`)}
                          className={`flex min-w-0 items-center gap-2 truncate text-left hover:text-blue-600 hover:underline ${section.label === "Offline" ? "text-slate-500" : ""}`}
                        >
                          <span className={`relative inline-flex ${section.label === "Offline" ? "opacity-75" : ""}`}><Avatar className="h-8 w-8"><AvatarImage src={member.avatarUrl ?? undefined} alt="" /><AvatarFallback className="text-[8px]">{member.username.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar><PresenceIndicator status={member.presenceStatus} size="sm" /></span>
                          <span className="truncate">{member.nickname || member.displayName || `@${member.username}`}</span>{" "}
                          {member.userId === g.creatorId && (
                            <small className="ml-1 rounded-full bg-blue-50 px-1.5 py-0.5 font-semibold text-blue-700">
                              Owner
                            </small>
                          )}
                        </button>
                        {manager && member.muted && (
                          <small className="rounded-full bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-700">
                            Muted
                          </small>
                        )}
                        {manager && member.userId !== user?.id && (
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                              aria-label={`${member.muted ? "Unmute" : "Mute"} @${member.username}`}
                              title={`${member.muted ? "Unmute" : "Mute"} @${member.username}`}
                              disabled={muteMember.isPending}
                              onClick={() =>
                                muteMember.mutate({ member, muted: !member.muted })
                              }
                            >
                              {member.muted ? (
                                <Volume2 className="h-4 w-4" />
                              ) : (
                                <VolumeX className="h-4 w-4" />
                              )}
                            </Button>
                            {member.userId !== g.creatorId && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                                aria-label={`Remove @${member.username}`}
                                title={`Remove @${member.username}`}
                                onClick={() => setMemberToRemove(member)}
                              >
                                <UserMinus className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </CardContent>
          </Card>
              {manager && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Invite Bettors</CardTitle>
                    <p className="text-xs leading-5 text-muted-foreground">
                      Search and send an invitation. Users join only after accepting it.
                    </p>
                  </CardHeader>
                  <CardContent>
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search username…"
                  />
                  <div className="mt-2 space-y-2">
                    {users.data
                      ?.filter(
                        (found) =>
                          !g.members.some(
                            (member) => member.userId === found.id,
                          ),
                      )
                      .map((found) => {
                        const invited = g.invites?.some(
                          (invite) => invite.userId === found.id,
                        );
                        return (
                          <div
                            key={found.id}
                            className="flex justify-between items-center text-sm"
                          >
                            <span className="flex min-w-0 items-center gap-2"><span className="relative inline-flex"><Avatar className="h-7 w-7"><AvatarImage src={found.avatarUrl ?? undefined} alt="" /><AvatarFallback className="text-[7px]">{found.username.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar><PresenceIndicator status={found.presenceStatus} size="xs" /></span><span className="truncate">{found.nickname || found.displayName || `@${found.username}`}</span></span>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={invited}
                                onClick={() =>
                                  api(`/groups/${groupId}/invite`, {
                                    method: "POST",
                                    body: JSON.stringify({ userId: found.id }),
                                  })
                                    .then(() => {
                                      refresh();
                                      toast.success(
                                        `@${found.username} invited`,
                                      );
                                    })
                                    .catch((error) =>
                                      toast.error(
                                        error instanceof Error
                                          ? error.message
                                          : "Could not invite user",
                                      ),
                                    )
                                }
                              >
                                {invited ? "Invited" : "Send Invite"}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                  </CardContent>
                </Card>
              )}
          </div>
        </div>
      )}
      <TailBetDialog bet={tailBet} onClose={() => setTailBet(null)} />
      {showDailyCard && (
        <DailyCardDialog
          destination="group"
          groupId={groupId}
          onClose={() => setShowDailyCard(false)}
        />
      )}
      <Dialog open={showGroupSettings} onOpenChange={setShowGroupSettings}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Group Settings</DialogTitle><DialogDescription>Manage this chat and, if authorized, the group itself.</DialogDescription></DialogHeader>
          <div className="space-y-2">
            <Button type="button" variant="outline" className="w-full justify-start" disabled={toggleNotifications.isPending} onClick={() => toggleNotifications.mutate(!g.notificationsMuted)}>
              {g.notificationsMuted ? <Bell className="mr-2 h-4 w-4" /> : <BellOff className="mr-2 h-4 w-4" />}{g.notificationsMuted ? "Unmute Chat Notifications" : "Mute Chat Notifications"}
            </Button>
            {manager && <Button type="button" variant="outline" className="w-full justify-start" onClick={() => { setGroupName(g.name); setGroupDescription(g.description ?? ""); setShowGroupSettings(false); setShowEditGroup(true); }}><Pencil className="mr-2 h-4 w-4" />Edit Group</Button>}
            {!owner && <Button type="button" variant="outline" className="w-full justify-start border-red-200 text-red-600" onClick={() => { setShowGroupSettings(false); setShowLeaveGroup(true); }}><LogOut className="mr-2 h-4 w-4" />Leave Group</Button>}
            {manager && <Button type="button" variant="destructive" className="w-full justify-start" onClick={() => { setShowGroupSettings(false); setShowDeleteGroup(true); }}><Trash2 className="mr-2 h-4 w-4" />Delete Group</Button>}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showEditGroup} onOpenChange={setShowEditGroup}>
        <DialogContent className="sm:max-w-md">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!updateGroup.isPending) updateGroup.mutate();
            }}
            className="space-y-5"
          >
            <DialogHeader>
              <DialogTitle>Edit Group</DialogTitle>
              <DialogDescription>
                Update how this group appears in Community and Messages.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <label
                htmlFor="group-name"
                className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
              >
                Group Name
              </label>
              <Input
                id="group-name"
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                maxLength={60}
                aria-invalid={groupName.trim().length < 2}
                className={
                  groupName.trim().length < 2
                    ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-200"
                    : undefined
                }
                autoFocus
              />
              <div className="text-right text-[11px] text-muted-foreground">
                {groupName.length}/60
              </div>
            </div>
            <div className="space-y-2">
              <label
                htmlFor="group-description"
                className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
              >
                Description
              </label>
              <Textarea
                id="group-description"
                value={groupDescription}
                onChange={(event) => setGroupDescription(event.target.value)}
                maxLength={240}
                rows={4}
                className="resize-y"
              />
              <div className="text-right text-[11px] text-muted-foreground">
                {groupDescription.length}/240
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditGroup(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  groupName.trim().length < 2 ||
                  groupDescription.length > 240 ||
                  updateGroup.isPending
                }
              >
                {updateGroup.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={showDeleteGroup} onOpenChange={setShowDeleteGroup}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {g.name}?</DialogTitle>
            <DialogDescription>
              This permanently removes the group, its chat history, invites, and
              membership list. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDeleteGroup(false)}
            >
              Keep Group
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteGroup.isPending}
              onClick={() => deleteGroup.mutate()}
            >
              {deleteGroup.isPending ? "Deleting…" : "Delete Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showLeaveGroup} onOpenChange={setShowLeaveGroup}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Leave {g.name}?</DialogTitle>
            <DialogDescription>
              This group will disappear from Messages. You can join it again later
              if the group remains available.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowLeaveGroup(false)}
            >
              Stay in Group
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={leaveGroup.isPending}
              onClick={() => leaveGroup.mutate()}
            >
              {leaveGroup.isPending ? "Leaving…" : "Leave Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(memberToRemove)}
        onOpenChange={(open) => {
          if (!open) setMemberToRemove(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove @{memberToRemove?.username}?</DialogTitle>
            <DialogDescription>
              They will immediately lose access to this group and its chat. They
              can join again later unless invited access rules change.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setMemberToRemove(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!memberToRemove || removeMember.isPending}
              onClick={() => {
                if (memberToRemove) removeMember.mutate(memberToRemove);
              }}
            >
              {removeMember.isPending ? "Removing…" : "Remove Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
