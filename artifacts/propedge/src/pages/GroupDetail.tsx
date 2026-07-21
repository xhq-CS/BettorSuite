import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Pencil, Send, Trash2, UserMinus, UserPlus, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageShortcutHint } from "@/components/chat/MessageShortcutHint";

type Member = { userId: number; username: string; role: string };
type Group = { id: number; name: string; description: string | null; isMember: boolean; role: string | null; members: Member[]; invites: { id: number; userId: number; status: string }[] };
type Message = { id: number; senderId: number; senderUsername: string; content: string; createdAt: string; editedAt: string | null };
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

  const group = useQuery({ queryKey: ["group", groupId], queryFn: () => api<Group>(`/groups/${groupId}`) });
  const messages = useQuery({ queryKey: ["group-messages", groupId], queryFn: () => api<Message[]>(`/groups/${groupId}/messages`), enabled: !!group.data?.isMember, refetchInterval: 3000 });
  const users = useQuery({ queryKey: ["group-user-search", search], queryFn: () => api<User[]>(`/users?search=${encodeURIComponent(search)}`), enabled: search.length >= 2 });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["group", groupId] }); qc.invalidateQueries({ queryKey: ["group-messages", groupId] }); };
  const action = useMutation({ mutationFn: ({ path, method = "POST" }: { path: string; method?: string }) => api(path, { method }), onSuccess: refresh });
  const send = useMutation({ mutationFn: () => api(`/groups/${groupId}/messages`, { method: "POST", body: JSON.stringify({ content: message }) }), onSuccess: () => { setMessage(""); refresh(); } });
  const edit = useMutation({ mutationFn: ({ messageId, content }: { messageId: number; content: string }) => api(`/groups/${groupId}/messages/${messageId}`, { method: "PATCH", body: JSON.stringify({ content }) }), onSuccess: () => { setEditingId(null); setEditText(""); refresh(); } });
  const remove = useMutation({ mutationFn: (messageId: number) => api(`/groups/${groupId}/messages/${messageId}`, { method: "DELETE" }), onSuccess: () => { setDeletingId(null); refresh(); } });
  const submit = () => { if (message.trim() && !send.isPending) send.mutate(); };

  if (group.isLoading) return <p>Loading group…</p>;
  if (!group.data) return <p>Group not found.</p>;
  const g = group.data;
  const admin = g.role === "admin";

  return <div className="max-w-6xl mx-auto space-y-4">
    <Button variant="ghost" onClick={() => nav("/groups")}><ArrowLeft className="w-4 h-4 mr-2" />All groups</Button>
    <div><h1 className="text-3xl font-display font-bold">{g.name}</h1><p className="text-muted-foreground mt-1">{g.description}</p></div>
    {!g.isMember ? <Card><CardContent className="p-8 text-center"><p className="mb-4">Join this group to see and send messages.</p><Button onClick={() => action.mutate({ path: `/groups/${groupId}/join` })}>Join group</Button></CardContent></Card> :
      <div className="grid lg:grid-cols-[1fr_300px] gap-4">
        <Card className="min-h-[560px] flex flex-col">
          <CardHeader><CardTitle>Group chat</CardTitle></CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <div className="flex min-h-[320px] max-h-[430px] flex-1 flex-col gap-3 overflow-y-auto px-2 py-3">
              {messages.data?.map(item => {
                const mine = item.senderId === user?.id;
                const isEditing = editingId === item.id;
                const timestamp = new Date(item.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
                return <div key={item.id} className={`group flex w-full ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`flex max-w-[82%] flex-col ${mine ? "items-end" : "items-start"}`}>
                    {!mine && <div className="mb-1 ml-3 text-[11px] font-semibold text-slate-500">@{item.senderUsername}</div>}
                    <div className={`flex items-end gap-1.5 ${mine ? "flex-row-reverse" : ""}`}>
                      <div className={`min-w-0 px-4 py-2.5 shadow-sm ${isEditing ? "w-[min(520px,72vw)] rounded-2xl border border-slate-200 bg-white text-slate-950" : mine ? "rounded-[20px] rounded-br-md bg-[#0A84FF] text-white" : "rounded-[20px] rounded-bl-md bg-[#E9E9EB] text-slate-950"}`}>
                        {isEditing ? <div className="space-y-2">
                          <Textarea value={editText} onChange={event => setEditText(event.target.value)} maxLength={2000} rows={3} className="resize-y border-slate-200 bg-white" autoFocus />
                          <div className="flex justify-end gap-2"><Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="w-4 h-4 mr-1" />Cancel</Button><Button type="button" size="sm" disabled={!editText.trim() || edit.isPending} onClick={() => edit.mutate({ messageId: item.id, content: editText })}><Check className="w-4 h-4 mr-1" />Save</Button></div>
                        </div> : <p className="whitespace-pre-wrap break-words text-[15px] leading-5">{item.content}</p>}
                      </div>
                      {mine && !isEditing && (deletingId === item.id ? <div className="mb-0.5 flex items-center gap-1 rounded-full border border-red-100 bg-white px-1.5 py-1 shadow-sm"><span className="ml-1 text-[11px] text-muted-foreground">Delete?</span><Button type="button" size="sm" variant="ghost" className="h-7 rounded-full px-2" onClick={() => setDeletingId(null)}>Cancel</Button><Button type="button" size="sm" variant="destructive" className="h-7 rounded-full px-2" disabled={remove.isPending} onClick={() => remove.mutate(item.id)}>Delete</Button></div> : <div className="mb-0.5 flex gap-0.5 opacity-70 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7 rounded-full text-slate-500" aria-label="Edit message" title="Edit message" onClick={() => { setDeletingId(null); setEditingId(item.id); setEditText(item.content); }}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7 rounded-full text-destructive hover:text-destructive" aria-label="Delete message" title="Delete message" onClick={() => setDeletingId(item.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>)}
                    </div>
                    <div className={`mt-1 px-2 text-[10px] text-slate-400 ${mine ? "text-right" : "text-left"}`}>{timestamp}{item.editedAt && <span className="ml-1 italic">(edited)</span>}</div>
                  </div>
                </div>;
              })}
              {!messages.data?.length && <p className="m-auto text-sm text-muted-foreground">No messages yet. Start the conversation.</p>}
            </div>
            <form onSubmit={event => { event.preventDefault(); submit(); }} className="flex items-end gap-2 border-t pt-4">
              <Textarea value={message} onChange={event => setMessage(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); } }} placeholder="Message this group…" maxLength={2000} rows={2} className="max-h-40 min-h-[46px] resize-y rounded-2xl border-slate-300 bg-white px-4 py-3" />
              <Button type="submit" size="icon" className="h-10 w-10 shrink-0 rounded-full bg-[#0A84FF] hover:bg-[#0077ED]" aria-label="Send message" disabled={!message.trim() || send.isPending}><Send className="w-4 h-4" /></Button>
            </form>
            <MessageShortcutHint />
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle className="text-base">Members</CardTitle></CardHeader><CardContent className="space-y-3">
          {g.members.map(member => <div key={member.userId} className="flex justify-between items-center text-sm"><span>@{member.username} {member.role === "admin" && <small className="text-primary">Admin</small>}</span>{admin && member.role !== "admin" && <Button size="icon" variant="ghost" aria-label={`Remove @${member.username}`} onClick={() => action.mutate({ path: `/groups/${groupId}/members/${member.userId}`, method: "DELETE" })}><UserMinus className="w-4 h-4" /></Button>}</div>)}
          {admin && <div className="pt-3 border-t"><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find username…" /><div className="mt-2 space-y-2">{users.data?.filter(found => !g.members.some(member => member.userId === found.id)).map(found => { const invited = g.invites?.some(invite => invite.userId === found.id); return <div key={found.id} className="flex justify-between items-center text-sm"><span>@{found.username}</span><div className="flex gap-1"><Button size="sm" variant="outline" disabled={invited} onClick={() => api(`/groups/${groupId}/invite`, { method: "POST", body: JSON.stringify({ userId: found.id }) }).then(refresh)}>{invited ? "Invited" : "Invite"}</Button><Button size="icon" aria-label={`Add @${found.username}`} onClick={() => api(`/groups/${groupId}/members`, { method: "POST", body: JSON.stringify({ userId: found.id }) }).then(refresh)}><UserPlus className="w-4 h-4" /></Button></div></div>; })}</div></div>}
        </CardContent></Card>
      </div>}
  </div>;
}
