import { Link } from "wouter";
import { ArrowRight, Check, Gamepad2, Layers3, LockKeyhole, MessageCircleMore, ShieldCheck, Sparkles, Target, Trophy, Users } from "lucide-react";
import { PublicPage } from "@/components/public/PublicChrome";
import { ProductShowcase } from "@/components/public/ProductShowcase";

export default function Landing() {
  return <PublicPage darkHeader>
    <main className="overflow-hidden bg-[#07101f] text-white">
      <section className="relative border-b border-white/10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(37,99,235,.28),transparent_35%),radial-gradient(circle_at_15%_50%,rgba(16,185,129,.12),transparent_30%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:52px_52px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 py-20 lg:grid-cols-[.92fr_1.08fr] lg:px-8 lg:py-28">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-400/10 px-3 py-1.5 text-xs font-semibold text-blue-200"><Sparkles className="h-3.5 w-3.5" /> Your entire betting workflow, one clean suite</div>
            <h1 className="font-display text-5xl font-black leading-[.98] tracking-[-.05em] sm:text-6xl lg:text-7xl">Track the action.<br/><span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">Prove your edge.</span></h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">Leave the paper slips behind. Log real bets, test strategies with a mock bankroll, and share verified picks with a community built for bettors.</p>
            <div className="mt-8 flex flex-wrap gap-3"><Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-5 py-3 text-sm font-bold shadow-xl shadow-blue-500/20 transition hover:-translate-y-0.5 hover:bg-blue-400">Build your suite <ArrowRight className="h-4 w-4" /></Link><Link href="/login" className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold transition hover:bg-white/10">Log in</Link></div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400"><span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-400" /> Private account data</span><span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-400" /> No sportsbook connection</span><span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-400" /> Free to join</span></div>
          </div>
          <div className="relative">
            <div className="absolute -inset-8 rounded-full bg-blue-500/15 blur-3xl" />
            <ProductShowcase />
          </div>
        </div>
      </section>

      <section id="features" className="bg-white py-20 text-slate-950"><div className="mx-auto max-w-7xl px-5 lg:px-8"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-blue-600">Built for the full ticket lifecycle</p><h2 className="mt-3 text-4xl font-black tracking-tight">Less spreadsheet. More signal.</h2><p className="mt-4 text-slate-600">Every part of the suite stays connected—from the ticket you log to the card you share.</p></div><div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[
        [Target,"Book Keeper","Mirror your sportsbook wallet, reconcile responsibly, track units, boosts, parlays, and true profit."],
        [Gamepad2,"Mock Betting","Pressure-test a strategy with a separate virtual bankroll before real money is involved."],
        [Layers3,"Daily Cards","Package multiple picks into a clean card, post it once, and share it across your circles."],
        [MessageCircleMore,"Social betting","Send picks that friends can tail into their own tracker—without exposing private wallet data."],
        [Trophy,"Transparent profiles","Public pick history and leaderboard stats keep the conversation grounded in tracked results."],
        [ShieldCheck,"Safety controls","Private sessions, account recovery, blocking, reporting, moderation, and account deletion are built in."],
      ].map(([Icon,title,copy])=><article key={String(title)} className="group rounded-2xl border border-slate-200 bg-slate-50 p-6 transition hover:-translate-y-1 hover:border-blue-200 hover:bg-white hover:shadow-xl hover:shadow-blue-950/5"><span className="grid h-11 w-11 place-items-center rounded-xl bg-slate-950 text-blue-300"><Icon className="h-5 w-5" /></span><h3 className="mt-5 text-lg font-bold">{title as string}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{copy as string}</p></article>)}</div></div></section>

      <section id="community" className="border-y border-white/10 bg-[#0a1425] py-20"><div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-2 lg:items-center lg:px-8"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-blue-400">A community with receipts</p><h2 className="mt-3 text-4xl font-black">Talk picks. Share cards. Tail with context.</h2><p className="mt-4 max-w-xl leading-7 text-slate-300">Private groups, the public War Room, direct messages, public pick histories, and profitability-first rankings give every conversation a record behind it.</p><div className="mt-7 grid gap-3 sm:grid-cols-2">{["Public War Room","Private groups","Direct messages","Clickable leaderboards"].map((item)=><div key={item} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.035] px-4 py-3 text-sm font-semibold"><Check className="h-4 w-4 text-emerald-400" />{item}</div>)}</div></div><div className="rounded-2xl border border-white/10 bg-white/[.035] p-5"><div className="flex items-center justify-between border-b border-white/10 pb-4"><div className="flex items-center gap-2"><Users className="h-5 w-5 text-blue-400"/><span className="font-bold">Sharp Circle</span></div><span className="text-xs text-emerald-300">4 online</span></div>{[["Nate","Brewers -1.5 · +110","OPEN"],["Ari","2-leg NBA card","TAIL"],["Maya","Cashed the under. +2.4u","WON"]].map(([name,pick,status],i)=><div key={name} className="mt-4 flex items-center gap-3"><div className={`grid h-9 w-9 place-items-center rounded-full text-xs font-bold ${i===0?"bg-blue-500":i===1?"bg-violet-500":"bg-emerald-500"}`}>{name[0]}</div><div className="min-w-0 flex-1"><p className="text-sm font-bold">{name}</p><p className="truncate text-xs text-slate-400">{pick}</p></div><span className="rounded-md border border-white/10 px-2 py-1 text-[9px] font-bold text-slate-300">{status}</span></div>)}</div></div></section>

      <section className="bg-blue-600 py-16"><div className="mx-auto flex max-w-5xl flex-col items-center px-5 text-center"><LockKeyhole className="h-8 w-8 text-blue-100"/><h2 className="mt-4 text-4xl font-black">Your action belongs to you.</h2><p className="mt-3 max-w-2xl text-blue-100">Account-bound data, private wallet details, session controls, and clear public/private boundaries—ready when you are.</p><Link href="/signup" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-blue-700 shadow-xl">Create your account <ArrowRight className="h-4 w-4" /></Link></div></section>
    </main>
  </PublicPage>;
}
