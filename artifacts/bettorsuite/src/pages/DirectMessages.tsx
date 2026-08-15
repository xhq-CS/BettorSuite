import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  BellOff,
  Check,
  Layers3,
  MessageCircleMore,
  Pencil,
  Search,
  Send,
  TicketCheck,
  Trash2,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MessageShortcutHint } from "@/components/chat/MessageShortcutHint";
import { SharedBetCard, type SharedBetSnapshot } from "@/components/shared-bets/SharedBetCard";
import { TailBetDialog } from "@/components/shared-bets/TailBetDialog";
import { DailyCardCard } from "@/components/daily-cards/DailyCardCard";
import { DailyCardDialog } from "@/components/daily-cards/DailyCardDialog";
import { SendPickDialog } from "@/components/messages/SendPickDialog";
import { GroupInboxList } from "@/components/messages/GroupInboxList";
import type { Conversation, DirectMessage } from "@/lib/social-types";
import { PresenceIndicator, type PresenceStatus } from "@/components/PresenceIndicator";

interface SearchUser {
  id: number;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  isFollowing: boolean;
  nickname: string | null;
  presenceStatus: PresenceStatus;
}

export default function DirectMessages() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const initialConversation = Number(
    new URLSearchParams(window.location.search).get("conversation"),
  );
  const [activeId, setActiveId] = useState<number | null>(
    Number.isInteger(initialConversation) && initialConversation > 0
      ? initialConversation
      : null,
  );
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showPickDialog, setShowPickDialog] = useState(false);
  const [showCardDialog, setShowCardDialog] = useState(false);
  const [tailBet, setTailBet] = useState<SharedBetSnapshot | null>(null);
  const [inboxView, setInboxView] = useState<"direct" | "groups">(() =>
    new URLSearchParams(window.location.search).get("view") === "groups"
      ? "groups"
      : "direct",
  );

  const conversations = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api<Conversation[]>("/conversations"),
    refetchInterval: 5000,
  });
  const activeConversation = conversations.data?.find(
    (conversation) => conversation.id === activeId,
  );
  const messages = useQuery({
    queryKey: ["messages", activeId],
    queryFn: () => api<DirectMessage[]>(`/conversations/${activeId}/messages`),
    enabled: Boolean(activeId),
    refetchInterval: activeId ? 3000 : false,
  });
  const latestOwnMessageId = [...(messages.data ?? [])]
    .reverse()
    .find((item) => item.senderId === user?.id)?.id;
  const people = useQuery({
    queryKey: ["dm-people-search", search],
    queryFn: () =>
      api<SearchUser[]>(`/users?search=${encodeURIComponent(search)}`),
    enabled: search.trim().length >= 2,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    queryClient.invalidateQueries({ queryKey: ["messages", activeId] });
  };
  const startConversation = useMutation({
    mutationFn: (participantId: number) =>
      api<{ id: number }>("/conversations", {
        method: "POST",
        body: JSON.stringify({ participantId }),
      }),
    onSuccess: (conversation) => {
      setActiveId(conversation.id);
      setSearch("");
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Unable to start chat"),
  });
  const follow = useMutation({
    mutationFn: (person: SearchUser) =>
      api(`/users/${person.id}/follow`, {
        method: person.isFollowing ? "DELETE" : "POST",
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["dm-people-search", search] }),
  });
  const toggleNotifications = useMutation({
    mutationFn: (muted: boolean) =>
      api<{ notificationsMuted: boolean }>(
        `/conversations/${activeId}/notifications`,
        {
          method: "PATCH",
          body: JSON.stringify({ muted }),
        },
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast.success(
        result.notificationsMuted
          ? "DM notifications muted"
          : "DM notifications unmuted",
      );
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update DM notifications",
      ),
  });
  const sendMessage = useMutation({
    mutationFn: () =>
      api(`/conversations/${activeId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: message }),
      }),
    onSuccess: () => {
      setMessage("");
      refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Unable to send message"),
  });
  const editMessage = useMutation({
    mutationFn: ({ id, content }: { id: number; content: string }) =>
      api(`/conversations/${activeId}/messages/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ content }),
      }),
    onSuccess: () => {
      setEditingId(null);
      setEditText("");
      refresh();
    },
  });
  const deleteMessage = useMutation({
    mutationFn: (id: number) =>
      api(`/conversations/${activeId}/messages/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setDeletingId(null);
      refresh();
    },
  });

  const submit = () => {
    if (activeId && message.trim() && !sendMessage.isPending) sendMessage.mutate();
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
          <MessageCircleMore className="h-4 w-4" /> Private Network
        </div>
        <h1 className="mt-1 font-display text-3xl font-bold">Messages</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Keep up with private conversations and every group you have joined.
        </p>
      </header>

      <div className="grid min-h-[650px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[330px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 lg:border-b-0 lg:border-r">
          <div className="border-b border-slate-200 p-4">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setInboxView("direct")}
                aria-pressed={inboxView === "direct"}
                className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${inboxView === "direct" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                <MessageCircleMore className="h-3.5 w-3.5" /> Direct
              </button>
              <button
                type="button"
                onClick={() => setInboxView("groups")}
                aria-pressed={inboxView === "groups"}
                className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${inboxView === "groups" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                <UsersRound className="h-3.5 w-3.5" /> Groups
              </button>
            </div>
            {inboxView === "direct" ? (
              <div className="mt-4">
                <label htmlFor="dm-search" className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Find Bettors
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input id="dm-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search username…" className="pl-9" />
                </div>
                {search.trim().length >= 2 && (
                  <div className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-1.5">
                    {people.data?.map((person) => (
                      <div key={person.id} className="flex items-center gap-2 rounded-lg p-2 hover:bg-slate-50">
                        <span className="relative inline-flex"><Avatar className="h-8 w-8"><AvatarImage src={person.avatarUrl ?? undefined} alt="" /><AvatarFallback className="text-[9px]">{person.username.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar><PresenceIndicator status={person.presenceStatus} size="sm" /></span>
                        <button type="button" onClick={() => startConversation.mutate(person.id)} className="min-w-0 flex-1 text-left">
                          <div className="truncate text-sm font-semibold">{person.nickname || person.displayName || person.username}</div>
                          <div className="truncate text-[10px] text-slate-500">@{person.username}</div>
                        </button>
                        <Button type="button" size="sm" variant={person.isFollowing ? "secondary" : "default"} className="h-8 shrink-0 rounded-full px-3 text-[11px]" aria-label={person.isFollowing ? `Unfollow @${person.username}` : `Follow @${person.username}`} onClick={() => follow.mutate(person)}>
                          {person.isFollowing ? <Check className="mr-1 h-3.5 w-3.5" /> : <UserPlus className="mr-1 h-3.5 w-3.5" />}
                          {person.isFollowing ? "Following" : "Follow"}
                        </Button>
                      </div>
                    ))}
                    {!people.isLoading && !people.data?.length && <p className="p-3 text-center text-xs text-slate-500">No bettors found.</p>}
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-4 text-xs leading-5 text-slate-500">
                Groups joined through Community stay available here as group chats.
              </p>
            )}
          </div>

          <div className="max-h-[430px] overflow-y-auto p-2 lg:max-h-[550px]">
            {inboxView === "direct" ? (
              <>
                {(conversations.data ?? []).map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => setActiveId(conversation.id)}
                    className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors ${activeId === conversation.id ? "bg-blue-50 ring-1 ring-blue-100" : "hover:bg-slate-50"}`}
                  >
                    <span className="relative inline-flex">
                      <Avatar className="h-11 w-11 border border-slate-200">
                        <AvatarImage src={conversation.participantAvatarUrl ?? undefined} alt="" />
                        <AvatarFallback className="text-xs font-bold">{conversation.participantUsername.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <PresenceIndicator status={conversation.participantPresenceStatus} size="md" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-bold text-slate-900">{conversation.participantNickname || conversation.participantDisplayName || conversation.participantUsername}</span>
                        {conversation.notificationsMuted ? (
                          <BellOff className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-label="DM notifications muted" />
                        ) : conversation.unreadCount > 0 ? (
                          <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 px-1.5 font-mono text-[9px] font-bold leading-none text-white">
                            {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">{conversation.lastMessage || "Start the conversation"}</span>
                    </span>
                  </button>
                ))}
                {!conversations.isLoading && !conversations.data?.length && (
                  <div className="px-4 py-10 text-center text-sm text-slate-500">Search for a bettor to start your first private conversation.</div>
                )}
              </>
            ) : (
              <GroupInboxList />
            )}
          </div>
        </aside>

        {inboxView === "direct" && activeId ? (
          <section className="flex min-h-[650px] min-w-0 flex-col">
            <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <Link href={activeConversation ? `/profile/${activeConversation.participantId}` : "/messages"}>
                <div className="flex cursor-pointer items-center gap-3">
                  <span className="relative inline-flex"><Avatar className="h-9 w-9"><AvatarImage src={activeConversation?.participantAvatarUrl ?? undefined} alt="" /><AvatarFallback className="text-[10px]">{activeConversation?.participantUsername.slice(0, 2).toUpperCase() || "DM"}</AvatarFallback></Avatar><PresenceIndicator status={activeConversation?.participantPresenceStatus} size="md" /></span>
                  <div><div className="text-sm font-bold">{activeConversation?.participantNickname || activeConversation?.participantDisplayName || activeConversation?.participantUsername || "Conversation"}</div><div className="text-[10px] text-slate-500">Private · 1 on 1</div></div>
                </div>
              </Link>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!activeConversation || toggleNotifications.isPending}
                  onClick={() =>
                    toggleNotifications.mutate(
                      !activeConversation?.notificationsMuted,
                    )
                  }
                >
                  {activeConversation?.notificationsMuted ? (
                    <Bell className="mr-1.5 h-4 w-4" />
                  ) : (
                    <BellOff className="mr-1.5 h-4 w-4" />
                  )}
                  {activeConversation?.notificationsMuted
                    ? "Unmute Chat"
                    : "Mute Chat"}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowPickDialog(true)}><TicketCheck className="mr-1.5 h-4 w-4" />Send Pick</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowCardDialog(true)}><Layers3 className="mr-1.5 h-4 w-4" />Daily Card</Button>
              </div>
            </header>

            <div className="flex max-h-[510px] min-h-[420px] flex-1 flex-col gap-3 overflow-y-auto bg-slate-50/40 p-4">
              {messages.data?.map((item) => {
                const mine = item.senderId === user?.id;
                const editing = editingId === item.id;
                const hasAttachment = Boolean(item.betShare || item.dailyCard);
                return (
                  <div key={item.id} className={`group flex w-full ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`flex max-w-[88%] flex-col ${mine ? "items-end" : "items-start"}`}>
                      <div className={`flex items-end gap-1.5 ${mine ? "flex-row-reverse" : ""}`}>
                        <div className={`min-w-0 ${editing ? "w-[min(520px,75vw)] rounded-2xl border bg-white p-3" : hasAttachment ? "w-[min(600px,80vw)] space-y-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm" : mine ? "rounded-[20px] rounded-br-md bg-[#0A84FF] px-4 py-2.5 text-white" : "rounded-[20px] rounded-bl-md bg-[#E9E9EB] px-4 py-2.5 text-slate-950"}`}>
                          {editing ? (
                            <div className="space-y-2">
                              <Textarea value={editText} onChange={(event) => setEditText(event.target.value)} rows={3} maxLength={2000} autoFocus />
                              <div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="mr-1 h-3.5 w-3.5" />Cancel</Button><Button size="sm" disabled={!editText.trim()} onClick={() => editMessage.mutate({ id: item.id, content: editText })}><Check className="mr-1 h-3.5 w-3.5" />Save</Button></div>
                            </div>
                          ) : (
                            <>
                              {item.content && <p className={`whitespace-pre-wrap break-words text-[15px] leading-5 ${hasAttachment ? "px-2 pt-1 text-slate-700" : ""}`}>{item.content}</p>}
                              {item.betShare && <SharedBetCard bet={item.betShare} compact onTail={setTailBet} />}
                              {item.dailyCard && <DailyCardCard card={item.dailyCard} compact onTail={setTailBet} />}
                            </>
                          )}
                        </div>
                        {mine && !editing && (
                          deletingId === item.id ? (
                            <div className="flex items-center gap-1 rounded-full border bg-white p-1 shadow-sm"><Button size="sm" variant="ghost" className="h-7 rounded-full px-2" onClick={() => setDeletingId(null)}>Cancel</Button><Button size="sm" variant="destructive" className="h-7 rounded-full px-2" onClick={() => deleteMessage.mutate(item.id)}>Delete</Button></div>
                          ) : (
                            <div className="flex gap-0.5 opacity-60 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                              <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Edit message" onClick={() => { setEditingId(item.id); setEditText(item.content); }}><Pencil className="h-3.5 w-3.5" /></Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" aria-label="Delete message" onClick={() => setDeletingId(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          )
                        )}
                      </div>
                      <div className="mt-1 px-2 text-[10px] text-slate-400">{new Date(item.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}{item.editedAt && <span className="ml-1 italic">(edited)</span>}{mine && item.id === latestOwnMessageId && item.deliveryStatus && <span className={`ml-1.5 font-semibold ${item.deliveryStatus === "read" ? "text-blue-500" : "text-slate-400"}`}>· {item.deliveryStatus === "read" ? "Read" : "Delivered"}</span>}</div>
                    </div>
                  </div>
                );
              })}
              {!messages.isLoading && !messages.data?.length && <div className="m-auto text-center text-sm text-slate-500">Send a message, a pick to tail, or your daily card.</div>}
            </div>

            <form onSubmit={(event) => { event.preventDefault(); submit(); }} className="border-t border-slate-200 p-4">
              <div className="flex items-end gap-2">
                <Textarea value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); } }} rows={2} maxLength={2000} placeholder="Message privately…" className="max-h-32 min-h-[46px] resize-y rounded-2xl" />
                <Button type="submit" size="icon" className="h-10 w-10 shrink-0 rounded-full" disabled={!message.trim() || sendMessage.isPending} aria-label="Send direct message"><Send className="h-4 w-4" /></Button>
              </div>
              <MessageShortcutHint />
            </form>
          </section>
        ) : inboxView === "groups" ? (
          <section className="flex min-h-[650px] items-center justify-center bg-slate-50/40 p-8 text-center">
            <div>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <UsersRound className="h-7 w-7" />
              </div>
              <h2 className="mt-4 text-xl font-bold">Your group chats</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                Open any joined group from the list. You can enter the same chat from Messages or Community.
              </p>
              <Link href="/community">
                <span className="mt-5 inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50">
                  Find More Groups
                </span>
              </Link>
            </div>
          </section>
        ) : (
          <section className="flex min-h-[650px] items-center justify-center p-8 text-center">
            <div><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><MessageCircleMore className="h-7 w-7" /></div><h2 className="mt-4 text-xl font-bold">Your private betting network</h2><p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">Choose a conversation or search for someone to discuss picks and cards one-on-one.</p></div>
          </section>
        )}
      </div>

      {activeId && showPickDialog && <SendPickDialog conversationId={activeId} onClose={() => setShowPickDialog(false)} />}
      {activeId && showCardDialog && <DailyCardDialog destination="dm" conversationId={activeId} onClose={() => setShowCardDialog(false)} />}
      <TailBetDialog bet={tailBet} onClose={() => setTailBet(null)} />
    </div>
  );
}
