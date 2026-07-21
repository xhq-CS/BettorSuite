import { useState, useEffect } from "react";
import { useListPosts, useCreatePost, useLikePost, getListPostsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Heart, MessageSquare, Share2, Send, UsersRound, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

export default function Community() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"feed" | "groups">("feed");
  
  // Feed state
  const [content, setContent] = useState("");
  const [sport, setSport] = useState("NBA");
  const { data: feed, isLoading } = useListPosts({ limit: 50 });
  const createPost = useCreatePost();
  const likePost = useLikePost();
  const [followedIds, setFollowedIds] = useState<Set<number>>(new Set());

  // Groups state
  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
  const [groups, setGroups] = useState<any[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [groupSport, setGroupSport] = useState("");

  const fetchGroups = () => {
    setGroupsLoading(true);
    fetch(`${BASE}/api/groups`)
      .then(r => r.json())
      .then(data => setGroups(data))
      .catch(() => toast.error("Failed to load groups"))
      .finally(() => setGroupsLoading(false));
  };

  useEffect(() => {
    if (activeTab === "groups") {
      fetchGroups();
    }
  }, [activeTab]);

  const handlePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    createPost.mutate({
      data: { content, sport }
    }, {
      onSuccess: () => {
        setContent("");
        toast.success("Shared with the community");
        queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
      }
    });
  };

  const handleLike = (id: number) => {
    likePost.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() })
    });
  };

  const handleFollow = (userId: number) => {
    fetch(`${BASE}/api/users/${userId}/follow`, { method: 'POST' })
      .then(() => {
        setFollowedIds(prev => new Set([...prev, userId]));
        toast.success("User followed");
      })
      .catch(() => toast.error("Failed to follow user"));
  };

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName) return;
    
    fetch(`${BASE}/api/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: groupName, description: groupDesc, sport: groupSport })
    })
    .then(r => r.json())
    .then(() => {
      toast.success("Group created");
      setGroupName(""); setGroupDesc(""); setGroupSport("");
      setShowGroupForm(false);
      fetchGroups();
    })
    .catch(() => toast.error("Failed to create group"));
  };

  const handleToggleJoin = (groupId: number, currentlyJoined: boolean) => {
    const endpoint = currentlyJoined ? 'leave' : 'join';
    fetch(`${BASE}/api/groups/${groupId}/${endpoint}`, { method: 'POST' })
      .then(r => r.json())
      .then(() => fetchGroups())
      .catch(() => toast.error("Action failed"));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-display font-bold tracking-tighter mb-2">COMMUNITY</h1>
        <p className="text-muted-foreground text-sm font-mono uppercase tracking-wider">Intel, Discussion & Crews</p>
      </div>

      <div className="flex gap-4 border-b border-border pb-2">
        <button
          onClick={() => setActiveTab("feed")}
          className={`pb-2 px-1 text-sm font-display uppercase tracking-wider transition-colors ${activeTab === "feed" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          Feed
        </button>
        <button
          onClick={() => setActiveTab("groups")}
          className={`pb-2 px-1 text-sm font-display uppercase tracking-wider transition-colors ${activeTab === "groups" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          Groups
        </button>
      </div>

      {activeTab === "feed" && (
        <div className="space-y-6">
          <Card className="border-border">
            <CardContent className="p-4">
              <form onSubmit={handlePost}>
                <textarea 
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Share a read, spot a trend, or post a slip..." 
                  className="w-full bg-transparent border-0 focus:ring-0 resize-none font-sans text-base min-h-[80px] placeholder:text-muted-foreground/60 focus-visible:outline-none"
                />
                <div className="flex items-center justify-between mt-2 pt-3 border-t border-border">
                  <div className="flex gap-2">
                    {['NBA', 'WNBA', 'MLB', 'NFL'].map(s => (
                      <button 
                        key={s} 
                        type="button"
                        onClick={() => setSport(s)}
                        className={`text-[10px] font-mono uppercase px-2 py-1 rounded transition-colors ${sport === s ? 'bg-primary/20 text-primary border border-primary/50' : 'bg-muted text-muted-foreground border border-transparent hover:bg-muted/80'}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <Button type="submit" size="sm" className="gap-2 rounded-full px-6" disabled={!content.trim() || createPost.isPending}>
                    <Send className="w-4 h-4" /> Share
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {isLoading ? (
              [1,2,3].map(i => <Card key={i} className="h-32 bg-muted animate-pulse border-border" />)
            ) : feed?.posts?.length ? (
              feed.posts.map(post => (
                <Card key={post.id} className="bg-card/60 hover:bg-card transition-colors border-border">
                  <CardContent className="p-5">
                    <div className="flex gap-4">
                      <Link href={`/profile/${post.userId}`}>
                        <Avatar className="w-10 h-10 cursor-pointer border-primary/20">
                          <AvatarImage src={post.avatarUrl || undefined} />
                          <AvatarFallback>{post.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      </Link>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <Link href={`/profile/${post.userId}`}>
                              <span className="font-display font-semibold hover:text-primary transition-colors cursor-pointer">{post.username}</span>
                            </Link>
                            <span className="text-xs font-mono text-muted-foreground">{formatDistanceToNow(new Date(post.createdAt))} ago</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {post.sport && <Badge variant="outline" className="text-[10px] py-0 h-5">{post.sport}</Badge>}
                            {post.userId !== 1 && (
                              <button
                                onClick={() => handleFollow(post.userId)}
                                className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border transition-colors ${followedIds.has(post.userId) ? 'border-primary/50 text-primary bg-primary/10' : 'border-border text-muted-foreground hover:bg-muted'}`}
                              >
                                {followedIds.has(post.userId) ? "Following" : "Follow"}
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap font-sans mt-2">{post.content}</p>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="px-5 py-3 border-t border-border/50 flex gap-6 text-muted-foreground">
                    <button 
                      onClick={() => handleLike(post.id)}
                      className={`flex items-center gap-1.5 text-xs font-mono hover:text-green-400 transition-colors ${post.liked ? 'text-green-400' : ''}`}
                    >
                      <Heart className={`w-4 h-4 ${post.liked ? 'fill-green-400' : ''}`} /> {post.likeCount > 0 ? post.likeCount : 'Like'}
                    </button>
                    <button className="flex items-center gap-1.5 text-xs font-mono hover:text-primary transition-colors">
                      <MessageSquare className="w-4 h-4" /> Reply
                    </button>
                    <button className="flex items-center gap-1.5 text-xs font-mono hover:text-foreground transition-colors ml-auto">
                      <Share2 className="w-4 h-4" /> Share
                    </button>
                  </CardFooter>
                </Card>
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground font-mono text-sm border border-dashed border-border rounded-lg">
                No intel shared yet. Be the first.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "groups" && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <Button onClick={() => setShowGroupForm(!showGroupForm)} variant="outline" className="gap-2 font-display uppercase tracking-wider text-xs h-8">
              <Plus className="w-4 h-4" /> Create Group
            </Button>
          </div>

          {showGroupForm && (
            <Card className="border-border bg-card">
              <CardContent className="p-4">
                <form onSubmit={handleCreateGroup} className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Group Name"
                      value={groupName}
                      onChange={e => setGroupName(e.target.value)}
                      className="w-full bg-background/50 border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary"
                    />
                    <select
                      value={groupSport}
                      onChange={e => setGroupSport(e.target.value)}
                      className="w-full bg-background/50 border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary"
                    >
                      <option value="">Any Sport</option>
                      <option value="NBA">NBA</option>
                      <option value="WNBA">WNBA</option>
                      <option value="MLB">MLB</option>
                      <option value="NFL">NFL</option>
                    </select>
                  </div>
                  <textarea
                    placeholder="Description..."
                    value={groupDesc}
                    onChange={e => setGroupDesc(e.target.value)}
                    className="w-full bg-background/50 border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary resize-none h-16"
                  />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowGroupForm(false)}>Cancel</Button>
                    <Button type="submit" size="sm" className="font-display uppercase tracking-wider text-xs">Create</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {groupsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3].map(i => <Card key={i} className="h-32 bg-muted animate-pulse" />)}
            </div>
          ) : groups.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map((g: any) => (
                <Card key={g.id} className="bg-card/40 border-border hover:border-primary/30 transition-colors flex flex-col">
                  <CardContent className="p-4 flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-display font-bold text-lg truncate pr-2">{g.name}</h3>
                      {g.sport && <Badge variant="secondary" className="text-[9px] h-4 py-0 shrink-0">{g.sport}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 h-8">{g.description || "No description"}</p>
                    <div className="flex items-center gap-1.5 mt-3 text-xs font-mono text-muted-foreground">
                      <UsersRound className="w-3.5 h-3.5" />
                      <span>{g.members?.length || g._count?.members || 0} Members</span>
                    </div>
                  </CardContent>
                  <CardFooter className="p-4 pt-0 border-t border-border/50 mt-auto flex gap-2">
                    <Button 
                      variant={g.isMember ? "outline" : "default"} 
                      size="sm" 
                      className={`flex-1 text-xs h-8 ${g.isMember ? 'hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50' : ''}`}
                      onClick={() => handleToggleJoin(g.id, g.isMember)}
                    >
                      {g.isMember ? "Leave" : "Join"}
                    </Button>
                    {g.isMember && (
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="flex-1 text-xs h-8 gap-1 bg-primary/10 text-primary hover:bg-primary/20"
                        onClick={() => setLocation(`/groups/${g.id}`)}
                      >
                        Chat <MessageSquare className="w-3 h-3" />
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground font-mono text-sm border border-dashed border-border rounded-lg">
              No groups found. Create one.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
