import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useNavigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { lazy, Suspense, Component, ReactNode } from "react";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import PublicSchedulePage from "@/pages/PublicSchedulePage";

const CalendarPage         = lazy(() => import("@/pages/CalendarPage"));
const StudentsPage         = lazy(() => import("@/pages/StudentsPage"));
const Student360Page       = lazy(() => import("@/pages/Student360Page"));
const EntResultsPage       = lazy(() => import("@/pages/EntResultsPage"));
const AdmissionPage        = lazy(() => import("@/pages/AdmissionPage"));
const CuratorshipPage      = lazy(() => import("@/pages/CuratorshipPage"));
const TeamPage             = lazy(() => import("@/pages/TeamPage"));
const TasksPage            = lazy(() => import("@/pages/TasksPage"));
const StoragePage          = lazy(() => import("@/pages/StoragePage"));
const SettingsPage         = lazy(() => import("@/pages/SettingsPage"));
const AdminPage            = lazy(() => import("@/pages/AdminPage"));
const WikiPage             = lazy(() => import("@/pages/WikiPage"));
const GradesPage           = lazy(() => import("@/pages/GradesPage"));
const BroadcastPage        = lazy(() => import("@/pages/BroadcastPage"));
const ChatPage             = lazy(() => import("@/pages/ChatPage"));
const DocsPage             = lazy(() => import("@/pages/DocsPage"));
const QuizResultsPage      = lazy(() => import("@/pages/QuizResultsPage"));
const TeacherAnalyticsPage = lazy(() => import("@/pages/TeacherAnalyticsPage"));
const ReportsPage          = lazy(() => import("@/pages/ReportsPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

/* ─── Page Loader ──────────────────────────────────────────────────────── */
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
          <div className="absolute inset-0 rounded-full border-2 border-t-primary animate-spin" />
        </div>
        <p className="text-sm text-muted-foreground animate-pulse">Загрузка...</p>
      </div>
    </div>
  );
}

/* ─── Error Boundary ───────────────────────────────────────────────────── */
interface EBState { hasError: boolean; message: string }
class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }
  static getDerivedStateFromError(err: Error): EBState {
    return { hasError: true, message: err.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center max-w-md p-8 rounded-2xl border bg-card shadow-lg">
            <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">⚠️</span>
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Что-то пошло не так</h2>
            <p className="text-sm text-muted-foreground mb-1">Произошла неожиданная ошибка.</p>
            {this.state.message && (
              <p className="text-xs text-muted-foreground/70 font-mono bg-muted rounded p-2 mt-2 text-left break-all">
                {this.state.message}
              </p>
            )}
            <button
              onClick={() => { this.setState({ hasError: false, message: "" }); window.location.href = "/"; }}
              className="mt-5 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              На главную
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ─── Route Guards ─────────────────────────────────────────────────────── */
function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (allowedRoles && user && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/* ─── App ──────────────────────────────────────────────────────────────── */
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/login"      element={<AuthRoute><Login /></AuthRoute>} />
                <Route path="/"           element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
                <Route path="/students"   element={<ProtectedRoute><StudentsPage /></ProtectedRoute>} />
                <Route path="/students/:id" element={<ProtectedRoute><Student360Page /></ProtectedRoute>} />
                <Route path="/ent-results"  element={<ProtectedRoute allowedRoles={["admin","umo_head","teacher"]}><EntResultsPage /></ProtectedRoute>} />
                <Route path="/quiz-results" element={<ProtectedRoute allowedRoles={["admin","umo_head","teacher"]}><QuizResultsPage /></ProtectedRoute>} />
                <Route path="/admission"    element={<ProtectedRoute allowedRoles={["admin","umo_head"]}><AdmissionPage /></ProtectedRoute>} />
                <Route path="/curatorship"  element={<ProtectedRoute><CuratorshipPage /></ProtectedRoute>} />
                <Route path="/team"         element={<ProtectedRoute allowedRoles={["admin","umo_head"]}><TeamPage /></ProtectedRoute>} />
                <Route path="/tasks"        element={<ProtectedRoute><TasksPage /></ProtectedRoute>} />
                <Route path="/storage"      element={<ProtectedRoute><StoragePage /></ProtectedRoute>} />
                <Route path="/settings"     element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
                <Route path="/wiki"         element={<ProtectedRoute><WikiPage /></ProtectedRoute>} />
                <Route path="/grades"       element={<ProtectedRoute><GradesPage /></ProtectedRoute>} />
                <Route path="/broadcasts"   element={<ProtectedRoute><BroadcastPage /></ProtectedRoute>} />
                <Route path="/chat"         element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
                <Route path="/admin"        element={<ProtectedRoute allowedRoles={["admin","umo_head"]}><AdminPage /></ProtectedRoute>} />
                <Route path="/analytics"    element={<ProtectedRoute><TeacherAnalyticsPage /></ProtectedRoute>} />
                <Route path="/reports"      element={<ProtectedRoute allowedRoles={["admin","umo_head"]}><ReportsPage /></ProtectedRoute>} />
                <Route path="/docs"         element={<DocsPage />} />
                <Route path="/schedule/:token" element={<PublicSchedulePage />} />
                <Route path="*"            element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
