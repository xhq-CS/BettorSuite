import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Check, Gamepad2, LockKeyhole, ShieldCheck, Sparkles, Target, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AuthMode = "login" | "register";

const suiteBenefits = [
  { icon: Target, title: "Track the action", copy: "A private ledger for your real sportsbook bets." },
  { icon: Gamepad2, title: "Test your edge", copy: "Pressure-test picks with a separate mock bankroll." },
  { icon: Users, title: "Share with context", copy: "Post verified picks without exposing wallet data." },
] as const;

export default function AuthPage({ admin = false, initialMode = "login" }: { admin?: boolean; initialMode?: AuthMode }) {
  const { login, adminLogin, register } = useAuth();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!admin && mode === "register" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      if (admin) await adminLogin(email, password);
      else if (mode === "login") await login(email, password);
      else await register(email, username, password, acceptedTerms, ageConfirmed);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to continue");
    } finally {
      setBusy(false);
    }
  };

  const changeMode = () => {
    const next = mode === "login" ? "register" : "login";
    setMode(next);
    window.history.replaceState(null, "", next === "register" ? "/signup" : "/login");
    setError("");
    setConfirmPassword("");
  };

  const title = admin ? "Administrator login" : mode === "login" ? "Welcome back" : "Build your suite";
  const description = admin
    ? "Use your authorized BettorSuite administrator account."
    : mode === "login"
      ? "Pick up where you left off—your ledger, mock bankroll, and circles are ready."
      : "Create one private account for every part of your betting workflow.";

  return <main className="relative min-h-screen overflow-hidden bg-[#07101f] px-5 py-6 text-white sm:px-8">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_15%,rgba(37,99,235,.26),transparent_32%),radial-gradient(circle_at_12%_80%,rgba(16,185,129,.10),transparent_28%)]" />
    <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.07)_1px,transparent_1px)] [background-size:52px_52px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
    <div className="relative mx-auto max-w-6xl">
      <div className="flex min-h-12 items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 text-white">
          <img src="/brand/bettorsuite-mark.webp" className="h-10 w-10 rounded-xl bg-white object-contain p-0.5" alt="BettorSuite" />
          <span className="font-display text-xl font-bold tracking-tight">Bettor<span className="text-blue-400">Suite</span></span>
        </Link>
        {!admin && <Link href="/" className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white"><ArrowLeft className="h-4 w-4" /> Back home</Link>}
      </div>

      <div className="grid min-h-[calc(100vh-7rem)] items-center gap-12 py-10 lg:grid-cols-[1fr_460px] lg:py-14">
        <section className="hidden lg:block">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-400/10 px-3 py-1.5 text-xs font-semibold text-blue-200"><Sparkles className="h-3.5 w-3.5" /> {admin ? "Secure operations portal" : "Your entire betting workflow"}</div>
          <h1 className="mt-6 max-w-xl font-display text-5xl font-black leading-[1.02] tracking-[-.045em]">{admin ? "Manage BettorSuite with confidence." : <>Track. Test. Connect.<br /><span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">Keep your edge together.</span></>}</h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">{admin ? "Restricted access for moderation, safety, and platform operations." : "A focused workspace for the full lifecycle of a pick—from the first read to the final result and the conversation around it."}</p>
          {!admin && <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">{suiteBenefits.map(({ icon: Icon, title: benefitTitle, copy }) => <article key={benefitTitle} className="rounded-2xl border border-white/10 bg-white/[.035] p-4 backdrop-blur-sm"><span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-400/10 text-blue-300"><Icon className="h-4 w-4" /></span><h2 className="mt-4 text-sm font-bold">{benefitTitle}</h2><p className="mt-1 text-xs leading-5 text-slate-400">{copy}</p></article>)}</div>}
          <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400"><span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-400" /> Private account data</span><span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-400" /> No sportsbook connection</span></div>
        </section>

        <Card className="border-white/10 bg-[#0d1728]/95 text-white shadow-2xl shadow-black/40 backdrop-blur-xl">
          <CardHeader className="p-6 pb-5 sm:p-8 sm:pb-5">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-blue-300/20 bg-blue-400/10 text-blue-300"><LockKeyhole className="h-5 w-5" /></div>
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-blue-300">{admin ? "Restricted access" : mode === "login" ? "Account access" : "Free to join"}</p>
            <CardTitle className="mt-1 text-3xl text-white">{title}</CardTitle>
            <p className="pt-1 text-sm leading-6 text-slate-400">{description}</p>
          </CardHeader>
          <CardContent className="px-6 pb-7 sm:px-8 sm:pb-8">
            <form onSubmit={submit} className="space-y-4">
              <label className="grid gap-1.5 text-xs font-semibold text-slate-300"><span>Email</span><Input className="h-11 border-white/10 bg-[#07101f]/80 text-white placeholder:text-slate-600 focus-visible:border-blue-400" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
              {mode === "register" && <label className="grid gap-1.5 text-xs font-semibold text-slate-300"><span>Username</span><Input className="h-11 border-white/10 bg-[#07101f]/80 text-white placeholder:text-slate-600 focus-visible:border-blue-400" autoComplete="username" placeholder="your_handle" value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} required /></label>}
              <label className="grid gap-1.5 text-xs font-semibold text-slate-300"><span>Password</span><Input className="h-11 border-white/10 bg-[#07101f]/80 text-white placeholder:text-slate-600 focus-visible:border-blue-400" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder={mode === "login" ? "Enter your password" : "10+ characters"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={10} required /></label>
              {!admin && mode === "register" && <>
                <label className="grid gap-1.5 text-xs font-semibold text-slate-300"><span>Confirm password</span><Input className="h-11 border-white/10 bg-[#07101f]/80 text-white placeholder:text-slate-600 focus-visible:border-blue-400" type="password" autoComplete="new-password" placeholder="Repeat your password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={10} required /></label>
                <p className="text-xs text-slate-500">Use 10–128 characters with at least one letter and number.</p>
                <div className="space-y-3 rounded-xl border border-white/10 bg-white/[.035] p-3.5 text-xs leading-5 text-slate-400">
                  <label className="flex items-start gap-2.5"><input className="mt-1 accent-blue-500" type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} required /><span>I agree to the <Link href="/terms" className="font-semibold text-blue-300 underline">Terms of Use</Link> and acknowledge the <Link href="/privacy" className="font-semibold text-blue-300 underline">Privacy Policy</Link>.</span></label>
                  <label className="flex items-start gap-2.5"><input className="mt-1 accent-blue-500" type="checkbox" checked={ageConfirmed} onChange={(event) => setAgeConfirmed(event.target.checked)} required /><span>I confirm I meet the legal gambling age where I live.</span></label>
                </div>
              </>}
              {error && <p role="alert" className="rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
              {!admin && mode === "login" && <div className="text-right"><Link href="/forgot-password" className="text-xs font-semibold text-blue-300 hover:text-blue-200 hover:underline">Forgot password?</Link></div>}
              <Button className="h-11 w-full rounded-lg bg-blue-500 font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-400" disabled={busy}>{busy ? "Please wait…" : admin ? "Log in as administrator" : mode === "login" ? "Log in" : "Create account"}</Button>
            </form>
            {!admin && <button type="button" className="mt-5 w-full text-sm font-semibold text-blue-300 transition hover:text-blue-200" onClick={changeMode}>{mode === "login" ? "New here? Create an account" : "Already have an account? Log in"}</button>}
            <div className="mt-6 flex items-center justify-center gap-2 border-t border-white/10 pt-5 text-[10px] text-slate-500"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Encrypted session · Private by default</div>
          </CardContent>
        </Card>
      </div>
      <p className="pb-2 text-center text-xs text-slate-600">BettorSuite is not a sportsbook and does not accept wagers.</p>
    </div>
  </main>;
}
