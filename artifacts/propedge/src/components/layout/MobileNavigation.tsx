import { Link, useLocation } from "wouter";
import { Gamepad2, LogOut, Target, Trophy, UserRound, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

const items = [
  { href: "/tracker", label: "Tracker", icon: Target },
  { href: "/mock-betting", label: "Mock", icon: Gamepad2 },
  { href: "/community", label: "Community", icon: Users },
  { href: "/leaderboard", label: "Ranks", icon: Trophy },
  { href: "/profile/me", label: "Profile", icon: UserRound },
];

export function MobileNavigation() {
  const [location] = useLocation();
  const { logout } = useAuth();
  return <>
    <header className="md:hidden h-16 px-4 border-b bg-background flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-2"><img src="/brand/bettorstats-mark.webp" alt="" className="w-8 h-8 object-contain"/><span className="font-display font-bold">Bettor<span className="text-primary">Stats</span></span></div>
      <button onClick={logout} aria-label="Log out" className="w-9 h-9 rounded-md border flex items-center justify-center text-muted-foreground"><LogOut className="w-4 h-4"/></button>
    </header>
    <nav aria-label="Mobile navigation" className="md:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-background/95 backdrop-blur border-t grid grid-cols-5">
      {items.map(({href,label,icon:Icon})=>{const active=href==="/tracker"?(location==="/"||location.startsWith(href)):location.startsWith(href);return <Link key={href} href={href}><div className={cn("h-full flex flex-col items-center justify-center gap-1 text-[10px] font-medium",active?"text-primary":"text-muted-foreground")}><Icon className="w-4 h-4"/><span>{label}</span></div></Link>})}
    </nav>
  </>;
}
