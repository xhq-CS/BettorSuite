import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { AppLayout } from '@/components/layout/AppLayout';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { lazy, Suspense } from 'react';

const BetTracker = lazy(() => import('@/pages/BetTracker'));
const Simulator = lazy(() => import('@/pages/Simulator'));
const Community = lazy(() => import('@/pages/Community'));
const Leaderboard = lazy(() => import('@/pages/Leaderboard'));
const GroupDetail = lazy(() => import('@/pages/GroupDetail'));
const AuthPage = lazy(() => import('@/pages/Auth'));
const AdminHome = lazy(() => import('@/pages/Admin'));
const UserProfile = lazy(() => import('@/pages/UserProfile'));
const MyProfile = lazy(() => import('@/pages/MyProfile'));
const NotFound = lazy(() => import('@/pages/not-found'));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

function Router() {
  return (
    <AppLayout>
      <Suspense fallback={<PageLoading />}><Switch>
        <Route path="/"                    component={BetTracker}   />
        <Route path="/tracker"             component={BetTracker}   />
        <Route path="/mock-betting"        component={Simulator}    />
        <Route path="/groups/:id"          component={GroupDetail}  />
        <Route path="/community"           component={Community}    />
        <Route path="/groups"              component={Community}    />
        <Route path="/leaderboard"         component={Leaderboard}  />
        <Route path="/profile/me"          component={MyProfile}    />
        <Route path="/profile/:id"         component={UserProfile}  />
        <Route                             component={NotFound}     />
      </Switch></Suspense>
    </AppLayout>
  );
}

function PageLoading() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center text-sm text-muted-foreground" role="status">
      Loading&hellip;
    </div>
  );
}

function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster theme={theme} position="bottom-right" duration={3000} closeButton toastOptions={{ classNames: { closeButton: "!border-red-200 !bg-red-50 !text-red-600 hover:!bg-red-100" } }} />;
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}><AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <AuthenticatedApp />
          </WouterRouter>
          <ThemedToaster />
        </TooltipProvider>
      </AuthProvider></QueryClientProvider>
    </ThemeProvider>
  );
}

function AuthenticatedApp() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-muted-foreground">Loading…</div>;
  const adminPath = window.location.pathname === '/admin/login';
  if (!user) return <Suspense fallback={<PageLoading />}><AuthPage admin={adminPath} /></Suspense>;
  if (adminPath && user.role !== 'admin') return <Suspense fallback={<PageLoading />}><AuthPage admin /></Suspense>;
  if (adminPath) return <Suspense fallback={<PageLoading />}><AdminHome /></Suspense>;
  return <Router />;
}

export default App;
