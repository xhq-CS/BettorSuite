import { useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  CircleDollarSign,
  Flame,
  Gamepad2,
  MessageCircleMore,
  MoreHorizontal,
  ReceiptText,
  Send,
  ShieldCheck,
  Target,
  TrendingUp,
  Trophy,
  Users,
  WalletCards,
} from "lucide-react";

const tabs = [
  { id: "keeper", label: "Book Keeper", icon: Target },
  { id: "mock", label: "Mock Betting", icon: Gamepad2 },
  { id: "community", label: "Community", icon: Users },
] as const;

type TabId = (typeof tabs)[number]["id"];

function PreviewShell({ children, tone }: { children: ReactNode; tone: "blue" | "amber" | "violet" }) {
  const glow = tone === "amber" ? "from-amber-400/20 via-orange-400/5" : tone === "violet" ? "from-violet-400/20 via-cyan-400/5" : "from-blue-400/20 via-emerald-400/5";
  return <div className="relative min-h-[420px] overflow-hidden p-5 sm:p-6">
    <div className={`pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b ${glow} to-transparent`} />
    <div className="relative">{children}</div>
  </div>;
}

function BookKeeperPreview() {
  const bets = [
    ["Knicks -3.5", "NBA · -110", "+2.75u", "Won"],
    ["NYY moneyline", "MLB · +120", "+1.20u", "Won"],
    ["Oilers o6.5", "NHL · -105", "-1.00u", "Lost"],
  ];
  return <PreviewShell tone="blue">
    <div className="flex items-start justify-between gap-4">
      <div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-blue-300">Sportsbook journal</p><h2 className="mt-1 text-xl font-bold">Book Keeper</h2></div>
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[9px] font-bold text-emerald-300"><ShieldCheck className="h-3 w-3" /> PRIVATE</span>
    </div>
    <div className="mt-5 grid gap-3 sm:grid-cols-[1.25fr_.75fr]">
      <div className="rounded-2xl border border-blue-300/15 bg-[#081323]/80 p-4">
        <div className="flex items-center justify-between"><span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400"><WalletCards className="h-4 w-4 text-blue-300" /> Tracked wallet</span><span className="text-[10px] text-slate-500">30 days</span></div>
        <p className="mt-3 font-mono text-3xl font-black tracking-tight">$1,841.32</p>
        <div className="mt-2 flex items-center gap-2 text-xs"><span className="rounded-md bg-emerald-400/10 px-2 py-1 font-mono font-bold text-emerald-300">+$304.50</span><span className="text-slate-500">net profit</span></div>
        <svg viewBox="0 0 360 82" className="mt-3 h-20 w-full" aria-label="Wallet profit trend">
          <defs><linearGradient id="keeper-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3b82f6" stopOpacity=".42"/><stop offset="1" stopColor="#3b82f6" stopOpacity="0"/></linearGradient></defs>
          <path d="M0 68 C35 62 58 73 91 51 S145 58 176 35 S225 48 260 22 S322 35 360 8 L360 82 L0 82 Z" fill="url(#keeper-fill)"/>
          <path d="M0 68 C35 62 58 73 91 51 S145 58 176 35 S225 48 260 22 S322 35 360 8" fill="none" stroke="#60a5fa" strokeWidth="3" strokeLinecap="round"/>
        </svg>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
        <div className="rounded-2xl border border-white/10 bg-white/[.035] p-4"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Win rate</p><p className="mt-2 font-mono text-xl font-black">62.5%</p><p className="mt-1 text-[10px] text-emerald-300">15 of 24 settled</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[.035] p-4"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Units</p><p className="mt-2 font-mono text-xl font-black text-blue-300">+12.8u</p><p className="mt-1 text-[10px] text-slate-500">All books combined</p></div>
      </div>
    </div>
    <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[.025]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5"><span className="inline-flex items-center gap-2 text-xs font-bold"><ReceiptText className="h-3.5 w-3.5 text-blue-300" /> Recent ledger</span><span className="text-[9px] font-bold text-blue-300">VIEW ALL</span></div>
      {bets.map(([pick, meta, amount, status]) => <div key={pick} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-white/[.06] px-4 py-2.5 last:border-0"><div><p className="truncate text-xs font-semibold">{pick}</p><p className="text-[9px] text-slate-500">{meta}</p></div><span className={`font-mono text-xs font-bold ${amount.startsWith("+") ? "text-emerald-300" : "text-red-300"}`}>{amount}</span><span className={`rounded-md px-2 py-1 text-[8px] font-bold uppercase ${status === "Won" ? "bg-emerald-400/10 text-emerald-300" : "bg-red-400/10 text-red-300"}`}>{status}</span></div>)}
    </div>
  </PreviewShell>;
}

function MockBettingPreview() {
  const games = [
    ["Celtics", "-4.5", "-110"],
    ["Warriors", "+4.5", "+105"],
    ["Over 228.5", "O/U", "-108"],
  ];
  return <PreviewShell tone="amber">
    <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-amber-300">Strategy sandbox</p><h2 className="mt-1 text-xl font-bold">Mock Betting</h2></div><span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[9px] font-bold text-amber-200">PLAY MONEY</span></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-[1.08fr_.92fr]">
      <div className="rounded-2xl border border-white/10 bg-[#091221]/90 p-4">
        <div className="flex items-center justify-between"><div><p className="text-[9px] uppercase tracking-wider text-slate-500">Tonight · NBA</p><p className="mt-1 text-sm font-bold">BOS at GSW</p></div><span className="rounded-lg bg-white/5 px-2 py-1 font-mono text-[10px] text-slate-400">8:30 PM</span></div>
        <div className="mt-4 grid gap-2">{games.map(([team, line, odds], index) => <button key={team} type="button" className={`flex items-center justify-between rounded-xl border px-3 py-3 text-left transition ${index === 0 ? "border-amber-300/40 bg-amber-300/10" : "border-white/10 bg-white/[.025] hover:border-white/20"}`}><span><span className="block text-xs font-semibold">{team}</span><span className="mt-0.5 block text-[9px] text-slate-500">{line}</span></span><span className={`font-mono text-xs font-bold ${index === 0 ? "text-amber-200" : "text-slate-300"}`}>{odds}</span></button>)}</div>
      </div>
      <div className="rounded-2xl border border-amber-300/20 bg-gradient-to-b from-amber-300/[.08] to-white/[.025] p-4">
        <div className="flex items-center justify-between"><span className="inline-flex items-center gap-2 text-xs font-bold"><Gamepad2 className="h-4 w-4 text-amber-300" /> Virtual slip</span><MoreHorizontal className="h-4 w-4 text-slate-500" /></div>
        <div className="mt-4 rounded-xl border border-white/10 bg-[#07101f]/70 p-3"><p className="text-xs font-bold">Celtics -4.5</p><div className="mt-1 flex justify-between font-mono text-[10px] text-slate-400"><span>Spread</span><span>-110</span></div></div>
        <div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-lg border border-white/10 p-2.5"><p className="text-[8px] uppercase text-slate-500">Stake</p><p className="mt-1 font-mono text-sm font-bold">25.0u</p></div><div className="rounded-lg border border-white/10 p-2.5"><p className="text-[8px] uppercase text-slate-500">To win</p><p className="mt-1 font-mono text-sm font-bold text-emerald-300">22.7u</p></div></div>
        <button type="button" className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-300 px-3 py-3 text-xs font-black text-slate-950 transition hover:bg-amber-200"><CircleDollarSign className="h-4 w-4" /> Place mock bet</button>
        <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-[10px]"><span className="text-slate-500">Virtual bankroll</span><span className="font-mono font-bold">$5,000.00</span></div>
      </div>
    </div>
    <div className="mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.025] p-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300"><TrendingUp className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="flex justify-between text-[10px]"><span className="font-bold">Strategy performance</span><span className="font-mono text-emerald-300">+18.4u</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[68%] rounded-full bg-gradient-to-r from-amber-300 to-emerald-300" /></div></div><span className="font-mono text-xs font-bold">58.1%</span></div>
  </PreviewShell>;
}

function CommunityPreview() {
  return <PreviewShell tone="violet">
    <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-violet-300">Social betting</p><h2 className="mt-1 text-xl font-bold">Community War Room</h2></div><span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[9px] font-bold text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> 7 ONLINE</span></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-[1.25fr_.75fr]">
      <div className="rounded-2xl border border-violet-300/15 bg-[#091221]/90 p-4">
        <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-xs font-black">AQ</div><div className="min-w-0 flex-1"><p className="text-xs font-bold">Andy Q. <span className="font-normal text-slate-500">· 3m</span></p><p className="text-[9px] text-slate-500">Shared a verified pick</p></div><span className="rounded-md bg-blue-400/10 px-2 py-1 text-[8px] font-bold text-blue-300">NBA</span></div>
        <div className="mt-3 rounded-xl border border-white/10 bg-gradient-to-br from-blue-500/10 to-violet-500/10 p-3"><div className="flex items-center justify-between"><p className="text-sm font-black">Knicks -3.5</p><span className="font-mono text-xs font-bold text-blue-300">-110</span></div><p className="mt-1 text-[10px] text-slate-400">2.5u · Madison Square Garden</p><div className="mt-3 flex gap-2"><span className="rounded-md bg-white/5 px-2 py-1 text-[9px] text-slate-300">61% win rate</span><span className="rounded-md bg-white/5 px-2 py-1 text-[9px] text-slate-300">+8.4u / 30d</span></div></div>
        <p className="mt-3 text-xs leading-5 text-slate-300">The matchup pace is the signal here. Tracking this one in the Keeper.</p>
        <div className="mt-3 flex items-center gap-4 border-t border-white/10 pt-3 text-[10px] text-slate-400"><button type="button" className="inline-flex items-center gap-1.5 hover:text-white"><Flame className="h-3.5 w-3.5 text-orange-300" /> 18</button><button type="button" className="inline-flex items-center gap-1.5 hover:text-white"><MessageCircleMore className="h-3.5 w-3.5" /> 6</button><button type="button" className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-blue-500 px-2.5 py-1.5 font-bold text-white"><ArrowUpRight className="h-3.5 w-3.5" /> Tail pick</button></div>
      </div>
      <div className="grid gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/[.035] p-4"><div className="flex items-center justify-between"><span className="inline-flex items-center gap-2 text-xs font-bold"><Trophy className="h-3.5 w-3.5 text-amber-300" /> Hot board</span><span className="text-[8px] font-bold text-violet-300">THIS WEEK</span></div>{[["1","Maya","+14.2u"],["2","Nate","+11.6u"],["3","Ari","+9.8u"]].map(([rank,name,value])=><div key={name} className="mt-3 grid grid-cols-[18px_1fr_auto] items-center gap-2 text-[10px]"><span className="font-mono text-slate-500">{rank}</span><span className="font-semibold">{name}</span><span className="font-mono font-bold text-emerald-300">{value}</span></div>)}</div>
        <div className="rounded-2xl border border-white/10 bg-white/[.035] p-4"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Your circles</p><div className="mt-3 flex -space-x-2">{["bg-blue-500","bg-violet-500","bg-emerald-500","bg-amber-500"].map((color,index)=><span key={color} className={`grid h-8 w-8 place-items-center rounded-full border-2 border-[#0d1728] text-[9px] font-bold ${color}`}>{["AQ","M","N","+9"][index]}</span>)}</div><p className="mt-3 text-[10px] text-slate-400">12 private groups · 24 picks shared</p></div>
      </div>
    </div>
    <div className="mt-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[.025] p-2.5"><span className="flex-1 px-2 text-[10px] text-slate-500">Share a read with the War Room…</span><button type="button" aria-label="Send message" className="grid h-8 w-8 place-items-center rounded-lg bg-violet-500 text-white"><Send className="h-3.5 w-3.5" /></button></div>
  </PreviewShell>;
}

export function ProductShowcase() {
  const [active, setActive] = useState<TabId>("keeper");
  return <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-[#0d1728]/95 shadow-2xl shadow-black/40">
    <div className="grid grid-cols-3 border-b border-white/10 bg-white/[.025] p-2" role="tablist" aria-label="BettorSuite product previews">{tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" aria-selected={active === id} aria-controls={`${id}-preview`} onClick={() => setActive(id)} className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-[10px] font-bold transition sm:text-xs ${active === id ? id === "mock" ? "bg-amber-300 text-slate-950" : id === "community" ? "bg-violet-500 text-white" : "bg-blue-500 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}><Icon className="h-3.5 w-3.5" />{label}</button>)}</div>
    <div id={`${active}-preview`} role="tabpanel">
      {active === "keeper" ? <BookKeeperPreview /> : active === "mock" ? <MockBettingPreview /> : <CommunityPreview />}
    </div>
  </div>;
}
