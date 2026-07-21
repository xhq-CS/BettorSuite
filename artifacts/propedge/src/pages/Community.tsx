import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, MessageCircle, Pencil, Send, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Groups from "@/pages/Groups";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageShortcutHint } from "@/components/chat/MessageShortcutHint";

type Post = { id: number; userId: number; username: string; content: string; createdAt: string; editedAt: string | null; likeCount: number; liked: boolean };
type Feed = { posts: Post[]; hasMore: boolean; nextCursor: number | null };

export default function Community() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const feed = useQuery({ queryKey: ["war-room"], queryFn: () => api<Feed>("/posts?limit=50"), refetchInterval: 5000 });
  const refresh = () => qc.invalidateQueries({ queryKey: ["war-room"] });
  const send = useMutation({ mutationFn: () => api<Post>("/posts", { method: "POST", body: JSON.stringify({ content: message }) }), onSuccess: () => { setMessage(""); refresh(); } });
  const edit = useMutation({ mutationFn: ({ id, content }: { id: number; content: string }) => api(`/posts/${id}`, { method: "PATCH", body: JSON.stringify({ content }) }), onSuccess: () => { setEditingId(null); setEditText(""); refresh(); } });
  const remove = useMutation({ mutationFn: (id: number) => api(`/posts/${id}`, { method: "DELETE" }), onSuccess: () => { setDeletingId(null); refresh(); } });
  const submit = () => { if (message.trim() && !send.isPending) send.mutate(); };

  return <div className="max-w-6xl mx-auto space-y-8">
    <div><h1 className="text-3xl font-display font-bold">Community</h1><p className="text-sm text-muted-foreground mt-1">Talk with bettors, compare ideas, and build private groups.</p></div>
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><MessageCircle className="w-5 h-5 text-primary" />Public War Room</CardTitle><p className="text-sm text-muted-foreground">Messages here are visible to the BettorStats community.</p></CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto mb-4 pr-1">
          {feed.data?.posts.map(post => {
            const mine = post.userId === user?.id;
            const isEditing = editingId === post.id;
            return <div key={post.id} className={`group rounded-2xl ${mine ? "rounded-tr-sm bg-primary/10" : "rounded-tl-sm bg-muted/60"} p-3`}>
              <div className="flex items-start justify-between gap-3">
                <div className="text-xs font-semibold text-primary">@{post.username}</div>
                {mine && !isEditing && (deletingId === post.id ? <div className="flex items-center gap-1"><span className="text-[11px] text-muted-foreground mr-1">Delete?</span><Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => setDeletingId(null)}>Cancel</Button><Button type="button" size="sm" variant="destructive" className="h-7 px-2" disabled={remove.isPending} onClick={() => remove.mutate(post.id)}>Delete</Button></div> : <div className="flex gap-1 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="Edit message" title="Edit message" onClick={() => { setDeletingId(null); setEditingId(post.id); setEditText(post.content); }}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" aria-label="Delete message" title="Delete message" onClick={() => setDeletingId(post.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>)}
              </div>
              {isEditing ? <div className="mt-2 space-y-2">
                <Textarea value={editText} onChange={event => setEditText(event.target.value)} maxLength={2000} rows={3} className="resize-y bg-background" autoFocus />
                <div className="flex justify-end gap-2"><Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="w-4 h-4 mr-1" />Cancel</Button><Button type="button" size="sm" disabled={!editText.trim() || edit.isPending} onClick={() => edit.mutate({ id: post.id, content: editText })}><Check className="w-4 h-4 mr-1" />Save</Button></div>
              </div> : <p className="text-sm mt-1 whitespace-pre-wrap break-words">{post.content}</p>}
              <div className="text-[10px] text-muted-foreground mt-1">{new Date(post.createdAt).toLocaleString()}{post.editedAt && <span className="ml-1 italic">(edited)</span>}</div>
            </div>;
          })}
          {!feed.isLoading && !feed.data?.posts.length && <div className="text-center py-10 text-sm text-muted-foreground">No messages yet. Start the public conversation.</div>}
        </div>
        <form onSubmit={event => { event.preventDefault(); submit(); }} className="flex items-end gap-2 border-t pt-4">
          <Textarea value={message} onChange={event => setMessage(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); } }} placeholder="Message the War Room…" maxLength={2000} rows={2} className="max-h-40 resize-y" />
          <Button type="submit" size="icon" className="shrink-0" aria-label="Send message" disabled={!message.trim() || send.isPending}><Send className="w-4 h-4" /></Button>
        </form>
        <MessageShortcutHint />
      </CardContent>
    </Card>
    <section className="border-t pt-8"><Groups embedded /></section>
  </div>;
}
