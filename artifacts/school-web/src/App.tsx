import { Switch, Route, Redirect, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

import NotFound from '@/pages/not-found';
import Landing from '@/pages/landing';
import LoginPage from '@/pages/login';
import ForgotPasswordPage from '@/pages/forgot-password';
import ResetPasswordPage from '@/pages/reset-password';
import ConfirmEmailChangePage from '@/pages/confirm-email-change';
import Dashboard from '@/pages/dashboard';
import StudentsList from '@/pages/students/list';
import StudentDetail from '@/pages/students/detail';
import TeachersList from '@/pages/teachers/list';
import TeacherDetail from '@/pages/teachers/detail';
import ClassesList from '@/pages/classes/list';
import ClassDetail from '@/pages/classes/detail';
import AttendancePage from '@/pages/attendance/index';
import ExamsList from '@/pages/exams/list';
import ExamDetail from '@/pages/exams/detail';
import NoticesPage from '@/pages/notices/index';
import FeesPage from '@/pages/fees/index';
import ProfilePage from '@/pages/profile/index';
import UsersPage from '@/pages/users/index';

import { AuthProvider, useAppAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/app-layout";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}

function HomeRedirect() {
  const { user, isLoading } = useAppAuth();
  if (isLoading) return <LoadingScreen />;
  if (user) return <Redirect to="/dashboard" />;
  return <Landing />;
}

function ProtectedRoute({ component: Component }: { component: any }) {
  const { user, isLoading } = useAppAuth();

  if (isLoading) return <LoadingScreen />;
  if (!user) return <Redirect to="/login" />;

  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/login" component={LoginPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/confirm-email-change" component={ConfirmEmailChangePage} />

      <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
      <Route path="/students"><ProtectedRoute component={StudentsList} /></Route>
      <Route path="/students/:id"><ProtectedRoute component={StudentDetail} /></Route>
      <Route path="/teachers"><ProtectedRoute component={TeachersList} /></Route>
      <Route path="/teachers/:id"><ProtectedRoute component={TeacherDetail} /></Route>
      <Route path="/classes"><ProtectedRoute component={ClassesList} /></Route>
      <Route path="/classes/:id"><ProtectedRoute component={ClassDetail} /></Route>
      <Route path="/attendance"><ProtectedRoute component={AttendancePage} /></Route>
      <Route path="/exams"><ProtectedRoute component={ExamsList} /></Route>
      <Route path="/exams/:id"><ProtectedRoute component={ExamDetail} /></Route>
      <Route path="/notices"><ProtectedRoute component={NoticesPage} /></Route>
      <Route path="/fees"><ProtectedRoute component={FeesPage} /></Route>
      <Route path="/profile"><ProtectedRoute component={ProfilePage} /></Route>
      <Route path="/users"><ProtectedRoute component={UsersPage} /></Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={basePath}>
            <Router />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
