import type { ReactNode } from "react";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";

export function PublicHeader() {
  return <header className="relative z-20 border-b border-white/10 bg-[#07101f]/85 backdrop-blur-xl">
    <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
      <Link href="/" className="flex items-center gap-2.5 text-white">
        <img src="/brand/bettorsuite-mark.webp" className="h-9 w-9 rounded-lg bg-white object-contain p-0.5" alt="BettorSuite" />
        <span className="font-display text-lg font-bold tracking-tight">Bettor<span className="text-blue-400">Suite</span></span>
      </Link>
      <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex" aria-label="Public navigation">
        <a href="/#features" className="transition hover:text-white">Features</a>
        <a href="/#community" className="transition hover:text-white">Community</a>
        <Link href="/responsible-gambling" className="transition hover:text-white">Play responsibly</Link>
      </nav>
      <div className="flex items-center gap-2">
        <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white">Log in</Link>
        <Link href="/signup" className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500 px-3.5 py-2 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400">Sign up <ArrowRight className="h-3.5 w-3.5" /></Link>
      </div>
    </div>
  </header>;
}

export function PublicFooter() {
  return <footer className="border-t border-slate-200 bg-white text-slate-600">
    <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
      <div><div className="flex items-center gap-2"><img src="/brand/bettorsuite-mark.webp" className="h-8 w-8 object-contain" alt="" /><span className="font-display font-bold text-slate-950">BettorSuite</span></div><p className="mt-3 max-w-md text-sm leading-6">A private betting journal, strategy sandbox, and community workspace. BettorSuite is not a sportsbook and does not accept wagers.</p></div>
      <div><p className="text-xs font-bold uppercase tracking-wider text-slate-950">Legal &amp; safety</p><div className="mt-3 grid gap-2 text-sm"><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Use</Link><Link href="/community-guidelines">Community Guidelines</Link><Link href="/responsible-gambling">Responsible Gambling</Link></div></div>
      <div><p className="text-xs font-bold uppercase tracking-wider text-slate-950">Your data</p><div className="mt-3 grid gap-2 text-sm"><Link href="/privacy-request">Privacy request</Link><Link href="/login">Account access</Link><Link href="/forgot-password">Recover account</Link></div></div>
    </div>
    <div className="border-t px-5 py-5 text-center text-xs text-slate-500">© {new Date().getFullYear()} BettorSuite. For recordkeeping and community purposes only. Must be of legal gambling age in your jurisdiction.</div>
  </footer>;
}

export function PublicPage({ children, darkHeader = false }: { children: ReactNode; darkHeader?: boolean }) {
  return <div className={darkHeader ? "min-h-screen bg-[#07101f]" : "min-h-screen bg-slate-50"}><PublicHeader />{children}<PublicFooter /></div>;
}
