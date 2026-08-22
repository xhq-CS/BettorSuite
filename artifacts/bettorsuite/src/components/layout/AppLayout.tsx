import React from "react";
import { Sidebar } from "./Sidebar";
import { MobileNavigation } from "./MobileNavigation";
import { usePresenceHeartbeat } from "@/hooks/use-presence-heartbeat";

export function AppLayout({ children }: { children: React.ReactNode }) {
  usePresenceHeartbeat();
  React.useEffect(() => {
    document.body.classList.add("authenticated-theme");
    return () => document.body.classList.remove("authenticated-theme");
  }, []);

  return (
    <div className="bettorsuite-app flex min-h-screen flex-col bg-background relative selection:bg-primary/30 md:flex-row">
      {/* Background grid texture */}
      <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      
      <MobileNavigation />
      <Sidebar />
      <main className="flex-1 flex flex-col relative z-0 min-w-0 max-h-screen overflow-y-auto">
        <div className="container mx-auto p-4 pb-24 md:p-8 flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}
