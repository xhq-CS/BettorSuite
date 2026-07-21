import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { AppLayout } from '@/components/layout/AppLayout';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';

import Dashboard    from '@/pages/Dashboard';
import StatsHub     from '@/pages/StatsHub';
import StatsExplorer from '@/pages/StatsExplorer';
import PlayerDetail from '@/pages/PlayerDetail';
import TeamDetail   from '@/pages/TeamDetail';
import PropTrends   from '@/pages/PropTrends';
import Analytics    from '@/pages/Analytics';
import BetTracker   from '@/pages/BetTracker';
import Simulator    from '@/pages/Simulator';
import Community    from '@/pages/Community';
import Groups       from '@/pages/Groups';
import GroupDetail  from '@/pages/GroupDetail';
import Leaderboard  from '@/pages/Leaderboard';
import Messages     from '@/pages/Messages';
import UserProfile  from '@/pages/UserProfile';
import MyProfile    from '@/pages/MyProfile';
import NotFound     from '@/pages/not-found';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/"                    component={Dashboard}    />
        <Route path="/stats"               component={StatsHub}     />
        <Route path="/stats/explore"       component={StatsExplorer} />
        <Route path="/stats/players/:id"   component={PlayerDetail} />
        <Route path="/stats/teams/:id"     component={TeamDetail}   />
        <Route path="/trends"              component={PropTrends}   />
        <Route path="/analytics"           component={Analytics}    />
        <Route path="/tracker"             component={BetTracker}   />
        <Route path="/simulator"           component={Simulator}    />
        <Route path="/community"           component={Community}    />
        <Route path="/groups"              component={Groups}       />
        <Route path="/groups/:id"          component={GroupDetail}  />
        <Route path="/leaderboard"         component={Leaderboard}  />
        <Route path="/messages"            component={Messages}     />
        <Route path="/profile/me"          component={MyProfile}    />
        <Route path="/profile/:id"         component={UserProfile}  />
        <Route                             component={NotFound}     />
      </Switch>
    </AppLayout>
  );
}

function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster theme={theme} position="bottom-right" />;
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <ThemedToaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
