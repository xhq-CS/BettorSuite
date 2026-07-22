const keyClass = "inline-flex min-w-6 items-center justify-center rounded border border-slate-200 bg-white px-1.5 py-0.5 font-sans text-[10px] font-semibold leading-none text-slate-600 shadow-[0_1px_1px_rgba(15,23,42,0.08)]";

export function MessageShortcutHint() {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-[11px] text-muted-foreground" aria-label="Enter to send. Shift plus Enter for a new line.">
      <span className="inline-flex items-center gap-1.5"><kbd className={keyClass}>Enter</kbd><span>Send</span></span>
      <span className="h-3 w-px bg-border" aria-hidden="true" />
      <span className="inline-flex items-center gap-1"><kbd className={keyClass}>Shift</kbd><span className="text-[10px]" aria-hidden="true">+</span><kbd className={keyClass}>Enter</kbd><span className="ml-0.5">New line</span></span>
    </div>
  );
}
