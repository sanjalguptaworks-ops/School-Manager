import { useState } from 'react';
import { Switch, Route, Redirect, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';

import NotFound from '@/pages/not-found';
import Landing from '@/pages/landing';
import LoginPage from '@/pages/login';
import SignupPage from '@/pages/signup';
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
import BillingPage from '@/pages/billing/index';
import CreatorSchoolsPage from '@/pages/creator/schools';
import TermsPage from '@/pages/legal/terms';
import PrivacyPage from '@/pages/legal/privacy';
import RefundPolicyPage from '@/pages/legal/refund';

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

function ConnectionErrorScreen({ onRetry }: { onRetry: () => Promise<unknown> }) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-sm text-center space-y-4">
        <p className="text-lg font-semibold">Couldn't reach the server</p>
        <p className="text-sm text-muted-foreground">
          This can happen right after the server has been idle and is waking back up. Your session is still saved — just try again.
        </p>
        <Button onClick={handleRetry} disabled={retrying}>
          {retrying ? "Retrying…" : "Try again"}
        </Button>
      </div>
    </div>
  );
}

function HomeRedirect() {
  const { user, isLoading, authError, refresh } = useAppAuth();
  if (isLoading) return <LoadingScreen />;
  if (authError) return <ConnectionErrorScreen onRetry={refresh} />;
  if (user?.role === "creator") return <Redirect to="/creator/schools" />;
  if (user) return <Redirect to="/dashboard" />;
  return <Landing />;
}

function ProtectedRoute({ component: Component }: { component: any }) {
  const { user, isLoading, authError, refresh } = useAppAuth();

  if (isLoading) return <LoadingScreen />;
  if (authError) return <ConnectionErrorScreen onRetry={refresh} />;
  if (!user) return <Redirect to="/login" />;
  if (user.role === "creator") return <Redirect to="/creator/schools" />;

  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function CreatorRoute({ component: Component }: { component: any }) {
  const { user, isLoading, authError, refresh } = useAppAuth();

  if (isLoading) return <LoadingScreen />;
  if (authError) return <ConnectionErrorScreen onRetry={refresh} />;
  if (!user) return <Redirect to="/login" />;
  if (user.role !== "creator") return <Redirect to="/dashboard" />;

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
      <Route path="/signup" component={SignupPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/confirm-email-change" component={ConfirmEmailChangePage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/refund-policy" component={RefundPolicyPage} />

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
      <Route path="/billing"><ProtectedRoute component={BillingPage} /></Route>
      <Route path="/creator/schools"><CreatorRoute component={CreatorSchoolsPage} /></Route>

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
