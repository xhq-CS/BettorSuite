import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import {
  Target, Gamepad2, Users, Trophy, UserRound, LogOut,
} from "lucide-react";

const navItems = [
  { href: "/tracker",    label: "Bet Tracker", icon: Target          },
  { href: "/mock-betting", label: "Mock Betting", icon: Gamepad2      },
  { href: "/community",    label: "Community",    icon: Users         },
  { href: "/leaderboard",  label: "Leaderboard",  icon: Trophy        },
  { href: "/profile/me", label: "Profile",     icon: UserRound       },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  return (
    <div className="hidden md:flex w-60 border-r border-border bg-sidebar flex-col h-screen overflow-y-auto z-10 sticky top-0 shrink-0">
      {/* Logo */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-2.5">
          <img
            src="/brand/bettorstats-mark.webp"
            alt=""
            aria-hidden="true"
            className="w-8 h-8 object-contain shrink-0"
          />
          <span className="font-display font-bold text-[17px] tracking-tight text-foreground leading-none">
            Bettor<span className="text-primary">Stats</span>
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5 pb-4">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === "/tracker" ? location === "/" || location.startsWith(href) : location.startsWith(href);
          return (
            <Link key={href} href={href}>
              <div className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-100 cursor-pointer group",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}>
                <Icon className={cn("w-4 h-4 shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                <span className="font-display font-medium">{label}</span>
                {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom row */}
      <div className="px-3 pb-5 space-y-1 border-t border-border pt-3">
        <div className="px-3 pb-2"><p className="text-xs font-medium truncate">@{user?.username}</p></div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-all"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span className="font-display font-medium">Log out</span>
        </button>

      </div>
    </div>
  );
}
