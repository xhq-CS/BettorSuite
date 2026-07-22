import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";

export default function AdminHome() {
  const { user, logout } = useAuth();
  return <main className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
    <Card className="w-full max-w-lg">
      <CardHeader><div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center mb-3"><ShieldCheck className="w-6 h-6 text-primary" /></div><CardTitle>Administrator access confirmed</CardTitle></CardHeader>
      <CardContent><p className="text-sm text-muted-foreground">Signed in as @{user?.username}. This account can be used for future moderation and account-management tools.</p><div className="flex gap-3 mt-6"><Button onClick={() => { window.location.href = "/"; }}>Open BettorSuite</Button><Button variant="outline" onClick={logout}>Log out</Button></div></CardContent>
    </Card>
  </main>;
}
