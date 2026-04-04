import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import Login from "@/pages/Login";
import CalendarPage from "@/pages/CalendarPage";
import StudentsPage from "@/pages/StudentsPage";
import Student360Page from "@/pages/Student360Page";
import EntResultsPage from "@/pages/EntResultsPage";
import CuratorshipPage from "@/pages/CuratorshipPage";
import TeamPage from "@/pages/TeamPage";
import TasksPage from "@/pages/TasksPage";
import StoragePage from "@/pages/StoragePage";
import SettingsPage from "@/pages/SettingsPage";
import AdminPage from "@/pages/AdminPage";
import WikiPage from "@/pages/WikiPage";
import GradesPage from "@/pages/GradesPage";
import BroadcastPage from "@/pages/BroadcastPage";
import ChatPage from "@/pages/ChatPage";
import DashboardPage from "@/pages/DashboardPage";
import DocsPage from "@/pages/DocsPage";
import TeacherAnalyticsPage from "@/pages/TeacherAnalyticsPage";
import ExportReportsPage from "@/pages/ExportReportsPage";
import NotFound from "@/pages/NotFound";

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
          <Routes>
            <Route path="/login" element={<AuthRoute><Login /></AuthRoute>} />
            <Route path="/" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
            <Route path="/students" element={<ProtectedRoute><StudentsPage /></ProtectedRoute>} />
            <Route path="/students/:id" element={<ProtectedRoute><Student360Page /></ProtectedRoute>} />
            <Route path="/ent-results" element={<ProtectedRoute allowedRoles={["admin", "umo_head", "teacher"]}><EntResultsPage /></ProtectedRoute>} />
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
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
