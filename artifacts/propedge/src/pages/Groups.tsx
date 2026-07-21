import { useState, useEffect } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { UsersRound, Plus, MessageSquare, Search } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function Groups() {
  const [, setLocation] = useLocation();
  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
  const [groups, setGroups] = useState<any[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [groupSport, setGroupSport] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchGroups = () => {
    setGroupsLoading(true);
    fetch(`${BASE}/api/groups`)
      .then(r => r.json())
      .then(data => setGroups(data))
      .catch(() => toast.error("Failed to load groups"))
      .finally(() => setGroupsLoading(false));
  };

  useEffect(() => {
    fetchGroups();
  }, []);

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

  const filteredGroups = groups.filter(g => 
    !searchQuery || 
    g.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (g.description && g.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tighter mb-2">GROUPS</h1>
          <p className="text-muted-foreground text-sm font-mono uppercase tracking-wider">Find your crew</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search groups..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 bg-card/50"
            />
          </div>
          <Button onClick={() => setShowGroupForm(!showGroupForm)} className="gap-2 font-display uppercase tracking-wider h-10 shrink-0">
            <Plus className="w-4 h-4" /> Create Group
          </Button>
        </div>
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
                  className="w-full bg-background/50 border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary text-muted-foreground"
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
                <Button type="submit" size="sm" className="font-display uppercase tracking-wider text-xs bg-primary text-primary-foreground hover:bg-primary/90">Create</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {groupsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4,5,6,7,8].map(i => <Card key={i} className="h-36 bg-muted animate-pulse" />)}
        </div>
      ) : filteredGroups.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredGroups.map((g: any) => (
            <Card key={g.id} className="bg-card/40 border-border hover:border-primary/30 transition-colors flex flex-col">
              <CardContent className="p-4 flex-1">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-display font-bold text-lg truncate pr-2" title={g.name}>{g.name}</h3>
                  {g.sport && <Badge variant="secondary" className="text-[9px] h-4 py-0 shrink-0 bg-foreground">{g.sport}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 h-8">{g.description || "No description"}</p>
                <div className="flex items-center gap-1.5 mt-4 text-xs font-mono text-muted-foreground">
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
        <div className="text-center py-16 text-muted-foreground font-mono text-sm border border-dashed border-border rounded-lg bg-card/20">
          {searchQuery ? "No groups found matching your search." : "No groups found. Create the first one."}
        </div>
      )}
    </div>
  );
}
