import React from "react";
import { Sidebar } from "./Sidebar";
import { MobileNavigation } from "./MobileNavigation";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-background relative selection:bg-primary/30">
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
