import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { lazy, Suspense } from "react";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import PublicSchedulePage from "@/pages/PublicSchedulePage";

const CalendarPage        = lazy(() => import("@/pages/CalendarPage"));
const StudentsPage        = lazy(() => import("@/pages/StudentsPage"));
const Student360Page      = lazy(() => import("@/pages/Student360Page"));
const EntResultsPage      = lazy(() => import("@/pages/EntResultsPage"));
const AdmissionPage       = lazy(() => import("@/pages/AdmissionPage"));
const CuratorshipPage     = lazy(() => import("@/pages/CuratorshipPage"));
const TeamPage            = lazy(() => import("@/pages/TeamPage"));
const TasksPage           = lazy(() => import("@/pages/TasksPage"));
const StoragePage         = lazy(() => import("@/pages/StoragePage"));
const SettingsPage        = lazy(() => import("@/pages/SettingsPage"));
const AdminPage           = lazy(() => import("@/pages/AdminPage"));
const WikiPage            = lazy(() => import("@/pages/WikiPage"));
const GradesPage          = lazy(() => import("@/pages/GradesPage"));
const BroadcastPage       = lazy(() => import("@/pages/BroadcastPage"));
const ChatPage            = lazy(() => import("@/pages/ChatPage"));
const DashboardPage       = lazy(() => import("@/pages/DashboardPage"));
const DocsPage            = lazy(() => import("@/pages/DocsPage"));
const TeacherAnalyticsPage = lazy(() => import("@/pages/TeacherAnalyticsPage"));
const ExportReportsPage   = lazy(() => import("@/pages/ExportReportsPage"));

const queryClient = new QueryClient();

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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={null}>
          <Routes>
            <Route path="/login" element={<AuthRoute><Login /></AuthRoute>} />
            <Route path="/" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
            <Route path="/students" element={<ProtectedRoute><StudentsPage /></ProtectedRoute>} />
            <Route path="/students/:id" element={<ProtectedRoute><Student360Page /></ProtectedRoute>} />
            <Route path="/ent-results" element={<ProtectedRoute allowedRoles={["admin", "umo_head", "teacher"]}><EntResultsPage /></ProtectedRoute>} />
            <Route path="/admission" element={<ProtectedRoute allowedRoles={["admin", "umo_head"]}><AdmissionPage /></ProtectedRoute>} />
            <Route path="/curatorship" element={<ProtectedRoute><CuratorshipPage /></ProtectedRoute>} />
            <Route path="/team" element={<ProtectedRoute allowedRoles={["admin", "umo_head"]}><TeamPage /></ProtectedRoute>} />
            <Route path="/tasks" element={<ProtectedRoute><TasksPage /></ProtectedRoute>} />
            <Route path="/storage" element={<ProtectedRoute><StoragePage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="/wiki" element={<ProtectedRoute><WikiPage /></ProtectedRoute>} />
            <Route path="/grades" element={<ProtectedRoute><GradesPage /></ProtectedRoute>} />
            <Route path="/broadcasts" element={<ProtectedRoute><BroadcastPage /></ProtectedRoute>} />
            <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin", "umo_head"]}><AdminPage /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><TeacherAnalyticsPage /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute allowedRoles={["admin", "umo_head"]}><ExportReportsPage /></ProtectedRoute>} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="/schedule/:token" element={<PublicSchedulePage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
