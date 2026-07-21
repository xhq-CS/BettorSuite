import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useTheme } from "@/context/ThemeContext";
import {
  LayoutDashboard, TrendingUp, Signal, Target, Gamepad2,
  BarChart2, Users, UsersRound, Medal, MessageSquare, Settings,
  Sun, Moon,
} from "lucide-react";

const navItems = [
  { href: "/",           label: "Dashboard",   icon: LayoutDashboard },
  { href: "/trends",     label: "Prop Trends", icon: TrendingUp      },
  { href: "/stats",      label: "Browse",      icon: Signal          },
  { href: "/tracker",    label: "Bet Tracker", icon: Target          },
  { href: "/simulator",  label: "Simulator",   icon: Gamepad2        },
  { href: "/analytics",  label: "Analytics",   icon: BarChart2       },
  { href: "/community",  label: "Community",   icon: Users           },
  { href: "/groups",     label: "Groups",      icon: UsersRound      },
  { href: "/leaderboard",label: "Leaderboard", icon: Medal           },
  { href: "/messages",   label: "Messages",    icon: MessageSquare   },
];

export function Sidebar() {
  const [location] = useLocation();
  const { theme, toggle } = useTheme();

  return (
    <div className="w-60 border-r border-border bg-sidebar flex flex-col h-screen overflow-y-auto z-10 sticky top-0 shrink-0">
      {/* Logo */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-primary flex items-center justify-center text-primary-foreground font-display font-bold text-xs shrink-0">
            BS
          </div>
          <span className="font-display font-bold text-[17px] tracking-tight text-foreground leading-none">
            Bettor<span className="text-primary">Stats</span>
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5 pb-4">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? location === "/" : location.startsWith(href);
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
        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-all"
        >
          {theme === 'dark'
            ? <Sun  className="w-4 h-4 shrink-0" />
            : <Moon className="w-4 h-4 shrink-0" />}
          <span className="font-display font-medium">
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </span>
        </button>

        <Link href="/profile/me">
          <div className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-all cursor-pointer">
            <Settings className="w-4 h-4 shrink-0" />
            <span className="font-display font-medium">Settings</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
