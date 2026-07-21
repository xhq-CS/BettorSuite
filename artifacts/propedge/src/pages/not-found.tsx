export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center flex-col space-y-4">
      <h1 className="text-6xl font-display font-bold text-primary animate-pulse">404</h1>
      <p className="text-xl font-mono text-muted-foreground uppercase tracking-widest">Signal Lost</p>
      <p className="text-sm text-muted-foreground max-w-md text-center">
        The telemetry you are looking for does not exist in this sector.
      </p>
    </div>
  );
}
