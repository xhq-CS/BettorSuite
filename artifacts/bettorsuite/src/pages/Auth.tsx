import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AuthPage({ admin = false, initialMode = "login" }: { admin?: boolean; initialMode?: "login" | "register" }) {
  const { login, adminLogin, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [email, setEmail] = useState(""); const [username, setUsername] = useState(""); const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState(""); const [acceptedTerms,setAcceptedTerms]=useState(false); const [ageConfirmed,setAgeConfirmed]=useState(false);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setError(""); if (!admin && mode === "register" && password !== confirmPassword) { setError("Passwords do not match."); return; } setBusy(true); try { admin ? await adminLogin(email, password) : mode === "login" ? await login(email, password) : await register(email, username, password, acceptedTerms, ageConfirmed); } catch (e) { setError(e instanceof Error ? e.message : "Unable to continue"); } finally { setBusy(false); } };
  return <main className="relative min-h-screen overflow-hidden bg-[#07101f] p-6">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_10%,rgba(37,99,235,.28),transparent_35%),radial-gradient(circle_at_80%_80%,rgba(16,185,129,.10),transparent_30%)]" />
    <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md flex-col justify-center">
      {!admin&&<Link href="/" className="mb-6 inline-flex w-fit items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white"><ArrowLeft className="h-4 w-4"/>Back to BettorSuite</Link>}
      <div className="mb-6 flex items-center justify-center gap-3"><img src="/brand/bettorsuite-mark.webp" className="h-11 w-11 rounded-xl bg-white object-contain p-0.5" alt="" /><span className="font-display text-2xl font-bold text-white">Bettor<span className="text-blue-400">Suite</span></span></div>
      <Card className="border-white/10 bg-white shadow-2xl shadow-black/30"><CardHeader><div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><LockKeyhole className="h-5 w-5"/></div><CardTitle>{admin ? "Administrator login" : mode === "login" ? "Welcome Back!" : "Create your account"}</CardTitle><p className="text-sm leading-relaxed text-muted-foreground">{admin ? "Authorized BettorSuite administrators only." : mode === "login" ? "Ditch the paper slips. Track sportsbook bets, test your edge with mock betting, and talk shop with the community—all in one place." : "One private account for your journal, mock bankroll, profile, and conversations."}</p></CardHeader><CardContent>
        <form onSubmit={submit} className="space-y-4">
          <Input type="email" autoComplete="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          {mode === "register" && <Input autoComplete="username" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} minLength={3} required />}
          <Input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} minLength={10} required />
          {!admin && mode === "register" && <><Input type="password" autoComplete="new-password" placeholder="Confirm password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} minLength={10} required /><p className="text-xs text-muted-foreground">Use 10–128 characters with at least one letter and number.</p><div className="space-y-2 rounded-xl border bg-slate-50 p-3 text-xs leading-5 text-slate-600"><label className="flex items-start gap-2"><input className="mt-1" type="checkbox" checked={acceptedTerms} onChange={e=>setAcceptedTerms(e.target.checked)} required/><span>I agree to the <Link href="/terms" className="font-semibold text-blue-600 underline">Terms of Use</Link> and acknowledge the <Link href="/privacy" className="font-semibold text-blue-600 underline">Privacy Policy</Link>.</span></label><label className="flex items-start gap-2"><input className="mt-1" type="checkbox" checked={ageConfirmed} onChange={e=>setAgeConfirmed(e.target.checked)} required/><span>I confirm I meet the legal gambling age where I live.</span></label></div></>}
          {error && <p className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">{error}</p>}
          {!admin&&mode==="login"&&<div className="text-right"><Link href="/forgot-password" className="text-xs font-semibold text-blue-600 hover:underline">Forgot password?</Link></div>}
          <Button className="w-full" disabled={busy}>{busy ? "Please wait…" : admin ? "Log in as administrator" : mode === "login" ? "Log in" : "Create account"}</Button>
        </form>
        {!admin && <button className="mt-5 w-full text-sm font-semibold text-primary" onClick={() => { const next=mode === "login" ? "register" : "login"; setMode(next); window.history.replaceState(null,"",next==="register"?"/signup":"/login"); setError(""); setConfirmPassword(""); }}>{mode === "login" ? "New here? Create an account" : "Already have an account? Log in"}</button>}
      </CardContent></Card>
      <p className="mt-5 text-center text-xs text-slate-500">BettorSuite is not a sportsbook and does not accept wagers.</p>
    </div>
  </main>;
}
