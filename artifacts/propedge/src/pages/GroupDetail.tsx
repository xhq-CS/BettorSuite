import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  Layers3,
  Pencil,
  Send,
  Trash2,
  UserMinus,
  UserPlus,
  X,
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

type Member = { userId: number; username: string; role: string };
type Group = {
  id: number;
  name: string;
  description: string | null;
  creatorId: number;
  isMember: boolean;
  isOwner: boolean;
  role: string | null;
  members: Member[];
  invites: { id: number; userId: number; status: string }[];
};
type Message = {
  id: number;
  senderId: number;
  senderUsername: string;
  content: string;
  betShare: SharedBetSnapshot | null;
  dailyCard: DailyCard | null;
  createdAt: string;
  editedAt: string | null;
};
type User = { id: number; username: string };

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const groupId = Number(id);
  const { user } = useAuth();
  const [, nav] = useLocation();
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
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);

  const group = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => api<Group>(`/groups/${groupId}`),
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
      nav("/community");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not delete group",
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
  const submit = () => {
    if (message.trim() && !send.isPending) send.mutate();
  };

  if (group.isLoading) return <p>Loading group…</p>;
  if (!group.data) return <p>Group not found.</p>;
  const g = group.data;
  const owner = g.isOwner || g.creatorId === user?.id;

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <Button variant="ghost" onClick={() => nav("/groups")}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        All groups
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
          </div>
          <p className="mt-1 text-muted-foreground">
            {g.description || "No description yet."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {owner && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setGroupName(g.name);
                  setGroupDescription(g.description ?? "");
                  setShowEditGroup(true);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit Group
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => setShowDeleteGroup(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </>
          )}
          {g.isMember && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDailyCard(true)}
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
                            @{item.senderUsername}
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
                          {mine &&
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
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 rounded-full text-destructive hover:text-destructive"
                                  aria-label="Delete message"
                                  title="Delete message"
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
                />
                <Button
                  type="submit"
                  size="icon"
                  className="h-10 w-10 shrink-0 rounded-full bg-[#0A84FF] hover:bg-[#0077ED]"
                  aria-label="Send message"
                  disabled={!message.trim() || send.isPending}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
              <MessageShortcutHint />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Members</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {g.members.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center justify-between gap-2 rounded-lg px-1 py-1.5 text-sm"
                >
                  <button
                    type="button"
                    onClick={() => nav(`/profile/${member.userId}`)}
                    className="min-w-0 truncate hover:text-blue-600 hover:underline"
                  >
                    @{member.username}{" "}
                    {member.userId === g.creatorId && (
                      <small className="ml-1 rounded-full bg-blue-50 px-1.5 py-0.5 font-semibold text-blue-700">
                        Owner
                      </small>
                    )}
                  </button>
                  {owner && member.userId !== g.creatorId && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0 text-red-500 hover:bg-red-50 hover:text-red-600"
                      aria-label={`Remove @${member.username}`}
                      title={`Remove @${member.username}`}
                      onClick={() => setMemberToRemove(member)}
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {owner && (
                <div className="pt-3 border-t">
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Find username…"
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
                            <span>@{found.username}</span>
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
                                {invited ? "Invited" : "Invite"}
                              </Button>
                              <Button
                                size="icon"
                                aria-label={`Add @${found.username}`}
                                onClick={() =>
                                  api(`/groups/${groupId}/members`, {
                                    method: "POST",
                                    body: JSON.stringify({ userId: found.id }),
                                  })
                                    .then(() => {
                                      refresh();
                                      toast.success(`@${found.username} added`);
                                    })
                                    .catch((error) =>
                                      toast.error(
                                        error instanceof Error
                                          ? error.message
                                          : "Could not add user",
                                      ),
                                    )
                                }
                              >
                                <UserPlus className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
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
