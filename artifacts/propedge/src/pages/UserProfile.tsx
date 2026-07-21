import { useRoute } from "wouter";
import { useGetUser, useFollowUser, useUnfollowUser, getGetUserQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Users, Trophy } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function UserProfile() {
  const [, params] = useRoute("/profile/:id");
  const userId = parseInt(params?.id || "0");
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useGetUser(userId, {
    query: { enabled: !!userId, queryKey: getGetUserQueryKey(userId) }
  });

  const followUser = useFollowUser();
  const unfollowUser = useUnfollowUser();

  const handleFollowToggle = () => {
    if (!user) return;
    
    if (user.isFollowing) {
      unfollowUser.mutate({ id: userId }, {
        onSuccess: () => {
          toast.success(`Unfollowed ${user.username}`);
          queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(userId) });
        }
      });
    } else {
      followUser.mutate({ id: userId }, {
        onSuccess: () => {
          toast.success(`Following ${user.username}`);
          queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(userId) });
        }
      });
    }
  };

  if (isLoading) return <div className="p-8 animate-pulse"><div className="h-64 bg-muted rounded-lg" /></div>;
  if (!user) return <div className="p-8 text-center text-muted-foreground font-mono">User not found</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <Card className="overflow-hidden border-border bg-card/50 relative">
        {/* Banner area */}
        <div className="h-32 bg-gradient-to-r from-primary/20 via-muted to-secondary/10 w-full relative">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')]"></div>
        </div>
        
        <CardContent className="pt-0 relative">
          <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-end -mt-12 sm:-mt-16 mb-6">
            <Avatar className="w-24 h-24 sm:w-32 sm:h-32 border-4 border-card bg-muted shadow-xl">
              <AvatarImage src={user.avatarUrl || undefined} />
              <AvatarFallback className="text-4xl">{user.username.substring(0,2).toUpperCase()}</AvatarFallback>
            </Avatar>
            
            <div className="flex-1 text-center sm:text-left mb-2">
              <h1 className="text-3xl font-display font-bold tracking-tight">
                {user.displayName || user.username}
              </h1>
              <div className="text-primary font-mono text-sm mt-1">@{user.username}</div>
            </div>
            
            <div className="mb-2">
              <Button 
                variant={user.isFollowing ? "outline" : "default"} 
                className="w-32"
                onClick={handleFollowToggle}
                disabled={followUser.isPending || unfollowUser.isPending}
              >
                {user.isFollowing ? "Unfollow" : "Follow"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-border">
            <div className="md:col-span-2 space-y-6">
              {user.bio && (
                <div>
                  <h3 className="text-xs font-mono uppercase text-muted-foreground mb-2">About</h3>
                  <p className="text-sm leading-relaxed">{user.bio}</p>
                </div>
              )}
              
              <div className="flex flex-wrap gap-4 text-sm font-mono text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4" />
                  Joined {format(new Date(user.createdAt), 'MMM yyyy')}
                </div>
                {user.favoriteSport && (
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4" />
                    Fav: {user.favoriteSport}
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/30 p-4 rounded-md text-center border border-border">
                  <div className="text-2xl font-mono font-bold text-foreground">{user.followersCount}</div>
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wider mt-1">Followers</div>
                </div>
                <div className="bg-muted/30 p-4 rounded-md text-center border border-border">
                  <div className="text-2xl font-mono font-bold text-foreground">{user.followingCount}</div>
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wider mt-1">Following</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="text-center py-12 text-muted-foreground font-mono text-sm border border-dashed border-border rounded-lg bg-card/30">
        User's public picks will appear here
      </div>
    </div>
  );
}
