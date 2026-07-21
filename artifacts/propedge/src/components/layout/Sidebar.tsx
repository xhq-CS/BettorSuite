import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Signal, Target, Gamepad2, Users, UsersRound, Medal, MessageSquare, Settings } from "lucide-react";

export function Sidebar() {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/stats", label: "Live Stats", icon: Signal },
    { href: "/tracker", label: "Bet Tracker", icon: Target },
    { href: "/simulator", label: "Simulator", icon: Gamepad2 },
    { href: "/community", label: "Community", icon: Users },
    { href: "/groups", label: "Groups", icon: UsersRound },
    { href: "/leaderboard", label: "Leaderboard", icon: Medal },
    { href: "/messages", label: "Messages", icon: MessageSquare },
  ];

  return (
    <div className="w-64 border-r border-border bg-sidebar flex flex-col h-screen overflow-y-auto z-10 sticky top-0 shrink-0">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-display font-bold text-sm">
            BT
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-foreground">
            Bettor<span className="text-primary">Tracker</span>
          </span>
        </div>

        <nav className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} className="block">
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150 group cursor-pointer",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  <item.icon className={cn("w-4 h-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                  <span className="font-display font-medium">{item.label}</span>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                </div>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto p-6">
        <Link href="/profile/me" className="block">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-all cursor-pointer">
            <Settings className="w-4 h-4" />
            <span className="font-display font-medium">Settings</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
