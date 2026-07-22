import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Layers3, MessageCircle, Pencil, Send, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Groups from "@/pages/Groups";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageShortcutHint } from "@/components/chat/MessageShortcutHint";
import {
  SharedBetCard,
  type SharedBetSnapshot,
} from "@/components/shared-bets/SharedBetCard";
import { CommunitySearch } from "@/components/community/CommunitySearch";
import { TailBetDialog } from "@/components/shared-bets/TailBetDialog";
import { DailyCardCard } from "@/components/daily-cards/DailyCardCard";
import { DailyCardDialog } from "@/components/daily-cards/DailyCardDialog";
import type { DailyCard } from "@/lib/social-types";

interface Post {
  id: number;
  userId: number;
  username: string;
  avatarUrl: string | null;
  content: string;
  betShare: SharedBetSnapshot | null;
  dailyCard: DailyCard | null;
  createdAt: string;
  editedAt: string | null;
  likeCount: number;
  liked: boolean;
  authorMuted: boolean;
}

interface Feed {
  posts: Post[];
  hasMore: boolean;
  nextCursor: number | null;
  postingMuted: boolean;
}

export default function Community() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [tailBet, setTailBet] = useState<SharedBetSnapshot | null>(null);
  const [showDailyCard, setShowDailyCard] = useState(false);
  const feed = useQuery({
    queryKey: ["war-room"],
    queryFn: () => api<Feed>("/posts?limit=50"),
    refetchInterval: 2000,
  });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["war-room"] });
  const send = useMutation({
    mutationFn: () =>
      api<Post>("/posts", {
        method: "POST",
        body: JSON.stringify({ content: message }),
      }),
    onSuccess: () => {
      setMessage("");
      refresh();
    },
    onError: (error) => {
      refresh();
      toast.error(
        error instanceof Error
          ? error.message
          : "You do not have permission to send messages in this channel.",
      );
    },
  });
  const edit = useMutation({
    mutationFn: ({ id, content }: { id: number; content: string }) =>
      api(`/posts/${id}`, {
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
    mutationFn: (id: number) => api(`/posts/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setDeletingId(null);
      refresh();
    },
  });
  const muteUser = useMutation({
    mutationFn: ({ userId, muted }: { userId: number; muted: boolean }) =>
      api(`/posts/users/${userId}/mute`, {
        method: "PATCH",
        body: JSON.stringify({ muted }),
      }),
    onSuccess: (_, { muted }) => {
      refresh();
      toast.success(`War Room access ${muted ? "muted" : "restored"}`);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not update user"),
  });
  const submit = () => {
    if (message.trim() && !send.isPending) send.mutate();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold">Community</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Talk with bettors, compare ideas, and build private groups.
        </p>
      </header>

      <CommunitySearch query={search} onQueryChange={setSearch} />

      <section aria-label="Community groups">
        <Groups embedded />
      </section>

      <section className="border-t pt-8" aria-labelledby="war-room-heading">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle
                id="war-room-heading"
                className="flex items-center gap-2"
              >
                <MessageCircle className="h-5 w-5 text-primary" />
                Public War Room
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Messages here are visible to the BettorSuite community.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => setShowDailyCard(true)} disabled={feed.data?.postingMuted}>
              <Layers3 className="mr-2 h-4 w-4 text-blue-600" /> Post Daily Card
            </Button>
          </CardHeader>
          <CardContent>
            <div className="mb-4 max-h-[32rem] space-y-3 overflow-y-auto pr-1">
              {feed.data?.posts.map((post) => {
                const mine = post.userId === user?.id;
                const platformAdmin = user?.role === "admin";
                const canEdit = mine || platformAdmin;
                const canDelete = mine || platformAdmin;
                const isEditing = editingId === post.id;
                return (
                  <div
                    key={post.id}
                    className={`group rounded-2xl p-3 ${
                      mine
                        ? "rounded-tr-sm bg-primary/10"
                        : "rounded-tl-sm bg-muted/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <Link href={`/profile/${post.userId}`}>
                        <span className="cursor-pointer text-xs font-semibold text-primary hover:underline">
                          @{post.username}
                        </span>
                      </Link>
                      {canDelete && !isEditing &&
                        (deletingId === post.id ? (
                          <div className="flex items-center gap-1">
                            <span className="mr-1 text-[11px] text-muted-foreground">
                              Delete?
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2.5"
                              onClick={() => setDeletingId(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              className="h-8 px-2.5"
                              disabled={remove.isPending}
                              onClick={() => remove.mutate(post.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-1 opacity-70 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              aria-label="Edit message"
                              title="Edit message"
                              onClick={() => {
                                setDeletingId(null);
                                setEditingId(post.id);
                                setEditText(post.content);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {platformAdmin && !mine && (
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                                aria-label={`${post.authorMuted ? "Unmute" : "Mute"} @${post.username} in War Room`}
                                title={`${post.authorMuted ? "Unmute" : "Mute"} @${post.username} in War Room`}
                                disabled={muteUser.isPending}
                                onClick={() => muteUser.mutate({ userId: post.userId, muted: !post.authorMuted })}
                              >
                                {post.authorMuted ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              aria-label="Delete message"
                              title="Delete message"
                              onClick={() => setDeletingId(post.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                    </div>
                    {isEditing ? (
                      <div className="mt-2 space-y-2">
                        <Textarea
                          value={editText}
                          onChange={(event) => setEditText(event.target.value)}
                          maxLength={2000}
                          rows={3}
                          className="resize-y bg-background"
                          autoFocus
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="mr-1 h-4 w-4" />
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={!editText.trim() || edit.isPending}
                            onClick={() =>
                              edit.mutate({ id: post.id, content: editText })
                            }
                          >
                            <Check className="mr-1 h-4 w-4" />
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1 space-y-2.5">
                        <p className="whitespace-pre-wrap break-words text-sm">
                          {post.content}
                        </p>
                        {post.betShare && (
                          <SharedBetCard
                            bet={post.betShare}
                            compact
                            onTail={setTailBet}
                          />
                        )}
                        {post.dailyCard && (
                          <DailyCardCard
                            card={post.dailyCard}
                            compact
                            onTail={setTailBet}
                          />
                        )}
                      </div>
                    )}
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {new Date(post.createdAt).toLocaleString()}
                      {post.editedAt && (
                        <span className="ml-1 italic">(edited)</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {!feed.isLoading && !feed.data?.posts.length && (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  No messages yet. Start the public conversation.
                </div>
              )}
            </div>
            {feed.data?.postingMuted && (
              <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
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
                placeholder="Message the War Room..."
                maxLength={2000}
                rows={2}
                className="max-h-40 resize-y"
                disabled={feed.data?.postingMuted}
              />
              <Button
                type="submit"
                size="icon"
                className="shrink-0"
                aria-label="Send message"
                disabled={feed.data?.postingMuted || !message.trim() || send.isPending}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
            <MessageShortcutHint />
          </CardContent>
        </Card>
      </section>
      <TailBetDialog bet={tailBet} onClose={() => setTailBet(null)} />
      {showDailyCard && (
        <DailyCardDialog
          destination="war-room"
          onClose={() => setShowDailyCard(false)}
        />
      )}
    </div>
  );
}
