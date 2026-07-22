import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AuthPage({ admin = false }: { admin?: boolean }) {
  const { login, adminLogin, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState(""); const [username, setUsername] = useState(""); const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setError(""); if (!admin && mode === "register" && password !== confirmPassword) { setError("Passwords do not match."); return; } setBusy(true); try { admin ? await adminLogin(email, password) : mode === "login" ? await login(email, password) : await register(email, username, password); } catch (e) { setError(e instanceof Error ? e.message : "Unable to continue"); } finally { setBusy(false); } };
  return <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
    <div className="w-full max-w-md">
      <div className="flex justify-center items-center gap-3 mb-8"><img src="/brand/bettorsuite-mark.webp" className="w-12 h-12 object-contain" alt="" /><span className="font-display font-bold text-2xl">Bettor<span className="text-primary">Suite</span></span></div>
      <Card><CardHeader><CardTitle>{admin ? "Administrator login" : mode === "login" ? "Welcome Back!" : "Create your account"}</CardTitle><p className="text-sm leading-relaxed text-muted-foreground">{admin ? "Authorized BettorSuite administrators only." : mode === "login" ? "Ditch the paper slips. Track sportsbook bets, test your edge with mock betting, and talk shop with the community—all in one place." : "Your bets, mock bankroll, and community activity stay securely tied to your account."}</p></CardHeader><CardContent>
        <form onSubmit={submit} className="space-y-4">
          <Input type="email" autoComplete="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          {mode === "register" && <Input autoComplete="username" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} minLength={3} required />}
          <Input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} minLength={10} required />
          {!admin && mode === "register" && <><Input type="password" autoComplete="new-password" placeholder="Confirm password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} minLength={10} required /><p className="text-xs text-muted-foreground">Use 10–128 characters with at least one letter and number.</p></>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" disabled={busy}>{busy ? "Please wait…" : admin ? "Log in as administrator" : mode === "login" ? "Log in" : "Create account"}</Button>
        </form>
        {!admin && <button className="text-sm text-primary mt-5 w-full" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setConfirmPassword(""); }}>{mode === "login" ? "New here? Create an account" : "Already have an account? Log in"}</button>}
      </CardContent></Card>
    </div>
  </main>;
}
