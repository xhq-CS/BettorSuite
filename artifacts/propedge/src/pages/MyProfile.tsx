import { useState } from "react";
import { useRoute } from "wouter";
import { useGetMe, useUpdateMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Settings, Save } from "lucide-react";

export default function MyProfile() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useGetMe();
  const updateMe = useUpdateMe();

  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [favoriteSport, setFavoriteSport] = useState(user?.favoriteSport || "");

  // Update local state when user data loads
  useState(() => {
    if (user) {
      setDisplayName(user.displayName || "");
      setBio(user.bio || "");
      setFavoriteSport(user.favoriteSport || "");
    }
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateMe.mutate({
      data: { displayName, bio, favoriteSport }
    }, {
      onSuccess: () => {
        toast.success("Profile updated");
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      }
    });
  };

  if (isLoading) return <div className="p-8 animate-pulse"><div className="h-64 bg-muted rounded-lg" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-display font-bold tracking-tighter mb-2">SETTINGS</h1>
        <p className="text-muted-foreground text-sm font-mono uppercase tracking-wider">Configure your profile</p>
      </div>

      <Card>
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-lg font-display uppercase tracking-wider flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Profile Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex items-center gap-6 mb-8 pb-8 border-b border-border">
            <Avatar className="w-24 h-24 border-2 border-primary/20">
              <AvatarImage src={user?.avatarUrl || undefined} />
              <AvatarFallback className="text-3xl bg-muted">{user?.username.substring(0,2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-mono text-sm text-muted-foreground mb-1 uppercase tracking-wider">Username</div>
              <div className="text-2xl font-display font-bold">@{user?.username}</div>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-mono uppercase text-muted-foreground">Display Name</label>
              <Input 
                value={displayName} 
                onChange={e => setDisplayName(e.target.value)} 
                placeholder="How you want to be known"
                className="max-w-md bg-muted/30"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-mono uppercase text-muted-foreground">Bio</label>
              <textarea 
                value={bio} 
                onChange={e => setBio(e.target.value)} 
                className="w-full h-32 rounded-md border border-input bg-muted/30 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring focus:border-primary resize-none"
                placeholder="Share your betting strategy or favorite teams..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-mono uppercase text-muted-foreground">Favorite Sport</label>
              <Input 
                value={favoriteSport} 
                onChange={e => setFavoriteSport(e.target.value)} 
                placeholder="e.g. NBA"
                className="max-w-xs bg-muted/30"
              />
            </div>

            <Button type="submit" className="gap-2" disabled={updateMe.isPending}>
              <Save className="w-4 h-4" /> 
              {updateMe.isPending ? "Saving..." : "Save Configuration"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
