import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Redirect, Route, Switch, Router as WouterRouter, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { lazy, Suspense } from "react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

const BetTracker = lazy(() => import("@/pages/BetTracker"));
const Simulator = lazy(() => import("@/pages/Simulator"));
const Community = lazy(() => import("@/pages/Community"));
const Leaderboard = lazy(() => import("@/pages/Leaderboard"));
const DirectMessages = lazy(() => import("@/pages/DirectMessages"));
const GroupDetail = lazy(() => import("@/pages/GroupDetail"));
const AuthPage = lazy(() => import("@/pages/Auth"));
const AdminHome = lazy(() => import("@/pages/Admin"));
const UserProfile = lazy(() => import("@/pages/UserProfile"));
const MyProfile = lazy(() => import("@/pages/MyProfile"));
const NotFound = lazy(() => import("@/pages/not-found"));
const Landing = lazy(() => import("@/pages/Landing"));
const LegalPage = lazy(() => import("@/pages/Legal"));
const PrivacyRequest = lazy(() => import("@/pages/PrivacyRequest"));
const SecurityPage = lazy(() => import("@/pages/Security"));
const ForgotPassword = lazy(() => import("@/pages/AccountRecovery").then((module) => ({ default: module.ForgotPassword })));
const ResetPassword = lazy(() => import("@/pages/AccountRecovery").then((module) => ({ default: module.ResetPassword })));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });

function PrivateRouter() {
  return <AppLayout><Suspense fallback={<PageLoading />}><Switch>
    <Route path="/login"><Redirect to="/tracker" /></Route>
    <Route path="/signup"><Redirect to="/tracker" /></Route>
    <Route path="/" component={BetTracker} />
    <Route path="/tracker" component={BetTracker} />
    <Route path="/mock-betting" component={Simulator} />
    <Route path="/groups/:id" component={GroupDetail} />
    <Route path="/community" component={Community} />
    <Route path="/groups" component={Community} />
    <Route path="/leaderboard" component={Leaderboard} />
    <Route path="/messages" component={DirectMessages} />
    <Route path="/profile/me" component={MyProfile} />
    <Route path="/profile/:id" component={UserProfile} />
    <Route path="/security" component={SecurityPage} />
    <Route path="/admin" component={AdminHome} />
    <Route component={NotFound} />
  </Switch></Suspense></AppLayout>;
}

function PageLoading() { return <div className="min-h-[40vh] flex items-center justify-center text-sm text-muted-foreground" role="status">Loading…</div>; }
function ThemedToaster() { const { theme } = useTheme(); return <Toaster theme={theme} position="bottom-right" duration={3000} closeButton toastOptions={{ classNames: { closeButton: "!border-destructive/30 !bg-destructive/10 !text-destructive hover:!bg-destructive/20" } }} />; }

function App() {
  return <ThemeProvider><QueryClientProvider client={queryClient}><AuthProvider><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}><AuthenticatedApp /></WouterRouter><ThemedToaster /></TooltipProvider><Analytics /><SpeedInsights /></AuthProvider></QueryClientProvider></ThemeProvider>;
}

function AuthenticatedApp() {
  const { user, loading } = useAuth();
  const [location] = useLocation();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Loading…</div>;
  const legalRoutes: Record<string, string> = { "/privacy": "privacy", "/terms": "terms", "/community-guidelines": "community-guidelines", "/responsible-gambling": "responsible-gambling" };
  if (legalRoutes[location]) return <Suspense fallback={<PageLoading />}><LegalPage slug={legalRoutes[location]} /></Suspense>;
  if (location === "/privacy-request") return <Suspense fallback={<PageLoading />}><PrivacyRequest /></Suspense>;
  const adminLoginPath = location === "/admin/login";
  if (!user) return <Suspense fallback={<PageLoading />}><Switch>
    <Route path="/" component={Landing} />
    <Route path="/login"><AuthPage /></Route>
    <Route path="/signup"><AuthPage initialMode="register" /></Route>
    <Route path="/forgot-password" component={ForgotPassword} />
    <Route path="/reset-password" component={ResetPassword} />
    <Route path="/admin/login"><AuthPage admin /></Route>
    <Route><AuthPage /></Route>
  </Switch></Suspense>;
  if (adminLoginPath && user.role !== "admin") return <Suspense fallback={<PageLoading />}><AuthPage admin /></Suspense>;
  if (adminLoginPath) window.history.replaceState(null, "", "/admin");
  return <PrivateRouter />;
}

export default App;
