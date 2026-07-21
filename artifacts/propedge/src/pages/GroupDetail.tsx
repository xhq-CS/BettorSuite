import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Send, UsersRound, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function GroupDetail() {
  const [, params] = useRoute("/groups/:id");
  const [, setLocation] = useLocation();
  const groupId = params?.id;
  
  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
  
  const [group, setGroup] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageInput, setMessageInput] = useState("");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchGroup = () => {
    fetch(`${BASE}/api/groups/${groupId}`)
      .then(r => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(data => setGroup(data))
      .catch(() => {
        toast.error("Group not found");
        setLocation("/groups");
      });
  };

  const fetchMessages = () => {
    fetch(`${BASE}/api/groups/${groupId}/messages`)
      .then(r => r.json())
      .then(data => setMessages(data))
      .catch(console.error);
  };

  useEffect(() => {
    if (!groupId) return;
    
    setLoading(true);
    fetchGroup();
    fetchMessages();
    setLoading(false);
    
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [groupId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim()) return;
    
    const content = messageInput;
    setMessageInput("");
    
    fetch(`${BASE}/api/groups/${groupId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    })
    .then(() => fetchMessages())
    .catch(() => toast.error("Failed to send message"));
  };

  const handleToggleJoin = () => {
    if (!group) return;
    const endpoint = group.isMember ? 'leave' : 'join';
    fetch(`${BASE}/api/groups/${groupId}/${endpoint}`, { method: 'POST' })
      .then(r => r.json())
      .then(() => fetchGroup())
      .catch(() => toast.error("Action failed"));
  };

  if (loading || !group) {
    return <div className="animate-pulse h-[calc(100vh-4rem)] bg-card/40 rounded-xl" />;
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col animate-in fade-in duration-500">
      <div className="flex items-center gap-4 mb-4 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/groups")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-display font-bold tracking-tighter">{group.name}</h1>
            {group.sport && <Badge variant="secondary" className="text-[10px] h-5">{group.sport}</Badge>}
          </div>
          <p className="text-muted-foreground text-xs font-mono uppercase mt-0.5 tracking-wider">
            {group.members?.length || 0} Members
          </p>
        </div>
        <Button 
          variant={group.isMember ? "outline" : "default"}
          onClick={handleToggleJoin}
          className={`font-display uppercase tracking-wider h-9 ${group.isMember ? 'hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50' : ''}`}
        >
          {group.isMember ? "Leave Group" : "Join Group"}
        </Button>
      </div>

      <Card className="flex-1 flex overflow-hidden border-border bg-card/40">
        {/* Left Panel: Members */}
        <div className="w-1/3 max-w-[280px] border-r border-border flex flex-col bg-card/60 hidden md:flex">
          <div className="p-4 border-b border-border">
            <h2 className="font-display uppercase tracking-wider text-sm font-semibold flex items-center gap-2">
              <UsersRound className="w-4 h-4 text-primary" />
              Members
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {group.members?.map((member: any) => (
              <div key={member.id} className="flex items-center gap-3">
                <Avatar className="w-8 h-8 border border-border/50">
                  <AvatarImage src={member.user?.avatarUrl} />
                  <AvatarFallback>{(member.user?.username || "U").substring(0,2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-medium text-sm truncate">{member.user?.username || "User"}</div>
                  <div className="text-[10px] font-mono text-muted-foreground uppercase">{member.role}</div>
                </div>
              </div>
            ))}
            {(!group.members || group.members.length === 0) && (
              <div className="text-xs font-mono text-muted-foreground text-center py-4">No members</div>
            )}
          </div>
        </div>

        {/* Right Panel: Chat */}
        <div className="flex-1 flex flex-col bg-background/50 relative">
          {!group.isMember && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-6 text-center">
              <UsersRound className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
              <h3 className="font-display text-xl font-bold mb-2">Join Group to Chat</h3>
              <p className="text-sm font-mono text-muted-foreground max-w-md mb-6">
                You need to be a member of {group.name} to view and send messages.
              </p>
              <Button onClick={handleToggleJoin} className="font-display uppercase tracking-wider">
                Join Group
              </Button>
            </div>
          )}
          
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
            {messages.length ? (
              messages.map((msg, i) => {
                const isMe = msg.userId === 1; // Assuming userId 1 is current user for demo
                const showHeader = i === 0 || messages[i-1].userId !== msg.userId || new Date(msg.createdAt).getTime() - new Date(messages[i-1].createdAt).getTime() > 300000;
                
                return (
                  <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    {showHeader && !isMe ? (
                      <Avatar className="w-8 h-8 shrink-0 mt-1">
                        <AvatarImage src={msg.user?.avatarUrl} />
                        <AvatarFallback>{(msg.user?.username || "U").substring(0,2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="w-8 shrink-0" />
                    )}
                    
                    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[75%]`}>
                      {showHeader && !isMe && (
                        <div className="flex items-baseline gap-2 mb-1 pl-1">
                          <span className="font-display text-sm font-medium">{msg.user?.username || "User"}</span>
                          <span className="text-[10px] font-mono text-muted-foreground">{format(new Date(msg.createdAt), 'h:mm a')}</span>
                        </div>
                      )}
                      
                      <div className={`rounded-2xl px-4 py-2 ${isMe ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted border border-border rounded-tl-sm'}`}>
                        <div className="text-sm font-sans whitespace-pre-wrap break-words leading-relaxed">{msg.content}</div>
                      </div>
                      
                      {showHeader && isMe && (
                        <span className="text-[10px] font-mono text-muted-foreground mt-1 pr-1">
                          {format(new Date(msg.createdAt), 'h:mm a')}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground font-mono text-sm">
                No messages yet. Say hello.
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-border bg-card/60 shrink-0">
            <form onSubmit={handleSend} className="flex gap-2">
              <Input 
                placeholder="Type message..." 
                value={messageInput} 
                onChange={e => setMessageInput(e.target.value)}
                className="flex-1 bg-background"
                disabled={!group.isMember}
              />
              <Button type="submit" size="icon" disabled={!messageInput.trim() || !group.isMember}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </div>
      </Card>
    </div>
  );
}
