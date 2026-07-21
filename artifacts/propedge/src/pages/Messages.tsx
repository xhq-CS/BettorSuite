import { useState, useEffect } from "react";
import { useListConversations, useListMessages, useSendMessage, getListMessagesQueryKey, getListConversationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, MessageSquare, Plus, Search, UserPlus } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";

export default function Messages() {
  const queryClient = useQueryClient();
  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
  
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const { data: conversations, isLoading: convsLoading } = useListConversations();
  const { data: messages, isLoading: msgsLoading } = useListMessages(activeConvId || 0, {
    query: { enabled: !!activeConvId, queryKey: getListMessagesQueryKey(activeConvId || 0) }
  });

  const sendMessage = useSendMessage();

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    
    const timeout = setTimeout(() => {
      fetch(`${BASE}/api/users`)
        .then(r => r.json())
        .then(users => {
          const results = users.filter((u: any) => 
            u.username.toLowerCase().includes(searchQuery.toLowerCase()) && 
            u.id !== 1 // assuming 1 is current user
          );
          setSearchResults(results);
        })
        .catch(console.error);
    }, 300);
    
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !activeConvId) return;

    sendMessage.mutate({
      id: activeConvId,
      data: { content: message }
    }, {
      onSuccess: () => {
        setMessage("");
        queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(activeConvId) });
        queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
      }
    });
  };

  const handleStartConvo = (userId: number) => {
    fetch(`${BASE}/api/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId: userId })
    })
    .then(r => r.json())
    .then(convo => {
      setActiveConvId(convo.id);
      setShowSearch(false);
      setSearchQuery("");
      queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
    })
    .catch(() => toast.error("Failed to start conversation"));
  };

  const handleFollow = (userId: number) => {
    fetch(`${BASE}/api/users/${userId}/follow`, { method: 'POST' })
      .then(() => toast.success("User followed"))
      .catch(() => toast.error("Failed to follow user"));
  };

  const activeConv = conversations?.find(c => c.id === activeConvId);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col animate-in fade-in duration-500 max-w-6xl mx-auto">
      <div className="mb-4 shrink-0">
        <h1 className="text-3xl font-display font-bold tracking-tighter mb-2">MESSAGES</h1>
        <p className="text-muted-foreground text-sm font-mono uppercase tracking-wider">Direct Messages</p>
      </div>

      <Card className="flex-1 flex overflow-hidden border-border bg-card/40 shadow-xl">
        {/* Sidebar */}
        <div className="w-80 border-r border-border flex flex-col bg-card/60 shrink-0">
          <div className="p-4 border-b border-border space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display uppercase tracking-wider text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                Active Channels
              </h2>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => setShowSearch(!showSearch)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            
            {showSearch && (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input 
                  placeholder="Search users..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-8 bg-background h-8 text-xs font-mono"
                  autoFocus
                />
              </div>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto relative">
            {showSearch && searchQuery.trim() ? (
              <div className="absolute inset-0 bg-card/95 backdrop-blur-sm z-10 p-2 overflow-y-auto">
                <div className="text-[10px] font-mono uppercase text-muted-foreground mb-2 px-2">Search Results</div>
                {searchResults.length ? (
                  <div className="space-y-1">
                    {searchResults.map(user => (
                      <button 
                        key={user.id}
                        onClick={() => handleStartConvo(user.id)}
                        className="w-full flex items-center gap-3 p-2 rounded hover:bg-primary/10 transition-colors text-left"
                      >
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={user.avatarUrl} />
                          <AvatarFallback>{user.username.substring(0,2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="font-display text-sm font-medium">{user.username}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-xs font-mono text-muted-foreground">No users found</div>
                )}
              </div>
            ) : null}

            {convsLoading ? (
              <div className="p-4 space-y-4">
                {[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />)}
              </div>
            ) : conversations?.length ? (
              <div className="divide-y divide-border">
                {conversations.map(conv => (
                  <div 
                    key={conv.id}
                    onClick={() => setActiveConvId(conv.id)}
                    className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors flex items-center gap-3 ${activeConvId === conv.id ? 'bg-primary/10 border-l-2 border-l-primary' : 'border-l-2 border-l-transparent'}`}
                  >
                    <Avatar className="w-10 h-10 border border-border">
                      <AvatarImage src={conv.participantAvatarUrl || undefined} />
                      <AvatarFallback>{conv.participantUsername.substring(0,2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="font-display font-medium truncate">{conv.participantUsername}</span>
                        {conv.lastMessageAt && (
                          <span className="text-[10px] font-mono text-muted-foreground shrink-0 ml-2">
                            {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true }).replace('about ', '')}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate font-sans">{conv.lastMessage || 'No messages yet'}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground font-mono text-sm">
                No active conversations.
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-background/50">
          {activeConvId ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-border bg-card/60 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <Avatar className="w-9 h-9">
                    <AvatarImage src={activeConv?.participantAvatarUrl || undefined} />
                    <AvatarFallback>{activeConv?.participantUsername.substring(0,2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-display font-medium text-lg leading-none">{activeConv?.participantUsername}</div>
                    <div className="text-[10px] font-mono text-primary uppercase mt-1">Secure Channel</div>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 gap-1.5 text-xs font-mono uppercase tracking-wider hidden sm:flex"
                  onClick={() => handleFollow(activeConv?.participantId || 0)}
                >
                  <UserPlus className="w-3.5 h-3.5" /> Follow
                </Button>
              </div>
              
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {msgsLoading ? (
                  <div className="flex justify-center"><span className="font-mono text-sm text-muted-foreground animate-pulse">Decrypting messages...</span></div>
                ) : messages?.length ? (
                  messages.map((msg, i) => {
                    const isMe = msg.senderUsername !== activeConv?.participantUsername;
                    const showAvatar = !isMe && (i === 0 || messages[i-1].senderUsername === activeConv?.participantUsername);
                    
                    return (
                      <div key={msg.id} className={`flex gap-3 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        {!isMe && (
                          <div className="w-8 shrink-0">
                            {showAvatar && (
                              <Avatar className="w-8 h-8">
                                <AvatarImage src={activeConv?.participantAvatarUrl || undefined} />
                                <AvatarFallback>{activeConv?.participantUsername.substring(0,2).toUpperCase()}</AvatarFallback>
                              </Avatar>
                            )}
                          </div>
                        )}
                        <div className={`max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          <div className={`rounded-2xl px-4 py-2 ${isMe ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-card border border-border rounded-tl-sm'}`}>
                            <div className="text-sm font-sans whitespace-pre-wrap break-words">{msg.content}</div>
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground mt-1 mx-1">
                            {format(new Date(msg.createdAt), 'h:mm a')}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground font-mono text-sm">
                    <MessageSquare className="w-8 h-8 mb-3 opacity-20" />
                    Channel open. Send a message to start.
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="p-4 border-t border-border bg-card/60 shrink-0">
                <form onSubmit={handleSend} className="flex gap-2">
                  <Input 
                    placeholder={`Message @${activeConv?.participantUsername}...`}
                    value={message} 
                    onChange={e => setMessage(e.target.value)}
                    className="flex-1 bg-background"
                  />
                  <Button type="submit" size="icon" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={!message.trim() || sendMessage.isPending}>
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-center p-6">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <h3 className="font-display text-lg font-bold mb-2 text-foreground">Your Messages</h3>
              <p className="font-mono text-sm max-w-sm">
                Select a channel from the sidebar or start a new conversation to begin secure comms.
              </p>
              <Button className="mt-6 gap-2" onClick={() => setShowSearch(true)}>
                <Plus className="w-4 h-4" /> Start Conversation
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
