import React from "react";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { GroupPersonAvatar } from "@/components/GroupPersonAvatar";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard, Users, UsersRound, BookOpen, GraduationCap,
  Plus, Search, Pencil, Trash2, X, ChevronRight, ShieldAlert,
  Phone, Mail, User, Building2, BookMarked, Check, CalendarDays, KeyRound,
  Megaphone, Info, AlertTriangle, AlertCircle, Power, Activity,
  Server, Database, HardDrive, Cpu, RefreshCw, CircleCheck, ScrollText, Shield, Archive, Upload, CheckSquare, Square, Undo2, Image
} from "lucide-react";
import ScheduleConstructor from "@/components/ScheduleConstructor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatPhone } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchUsers, createUser, updateUser, deleteUser,
  fetchStudents, createStudent, updateStudent, deleteStudent, archiveStudent, bulkArchiveStudents,
  fetchGroups, fetchAllGroups, createGroup, updateGroup, deleteGroup, hardDeleteGroup, uploadGroupAvatar, deleteGroupAvatar,
  fetchSubjects, createSubject, updateSubject, deleteSubject,
  fetchProfiles,
  fetchAllBanners, createBanner, updateBanner, deleteBanner,
  fetchHealth, fetchAuditLog,
  fetchRolesWithPermissions, fetchPermissions, updateRolePermissions,
} from "@/lib/api";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkImportModal } from "@/components/BulkImportModal";

//  helpers 

function initials(name: string, surname: string) {
  return (name?.[0] ?? "") + (surname?.[0] ?? "");
}

function avatarColor(id: number) {
  const palette = [
    "bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500",
    "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-pink-500",
  ];
  return palette[id % palette.length];
}

function roleBadge(role: string) {
  const map: Record<string, { label: string; cls: string }> = {
    admin:    { label: "Админ",    cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
    umo_head: { label: "УМО",      cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
    teacher:  { label: "Устаз",    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  };
  const { label, cls } = map[role] ?? { label: role, cls: "bg-gray-100 text-gray-600" };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

function statusBadge(status: string) {
  return status === "active"
    ? <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-0">Активный</Badge>
    : <Badge variant="secondary" className="text-[10px]">Архив</Badge>;
}

//  confirmation dialog 

function ConfirmDialog({
  open, title, description, onConfirm, onCancel, loading,
}: { open: boolean; title: string; description: string; onConfirm: () => void; onCancel: () => void; loading?: boolean }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
              <ShieldAlert className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle>{title}</DialogTitle>
          </div>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
        <DialogFooter className="mt-4 gap-2 flex-row justify-end">
          <Button variant="outline" onClick={onCancel} disabled={loading}>Отмена</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading ? "Удаление" : "Да, удалить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

//  stat card 

function StatCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: number; sub?: string; color: string }) {
  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${color}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold font-heading text-foreground">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
          {sub && <p className="text-xs text-muted-foreground/70 mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

//  search bar 

function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        className="pl-9 h-9 bg-background"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button onClick={() => onChange("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}


import { Suspense, lazy } from 'react';

const UsersTab = lazy(() => import('./admin-tabs/UsersTab'));
const StudentsTab = lazy(() => import('./admin-tabs/StudentsTab'));
const GroupsTab = lazy(() => import('./admin-tabs/GroupsTab'));
const SubjectsTab = lazy(() => import('./admin-tabs/SubjectsTab'));
const HealthTab = lazy(() => import('./admin-tabs/HealthTab'));
const BannersTab = lazy(() => import('./admin-tabs/BannersTab'));
const AuditTab = lazy(() => import('./admin-tabs/AuditTab'));
const PermissionsTab = lazy(() => import('./admin-tabs/PermissionsTab'));

function Loader() { return <div className="p-8 text-center text-muted-foreground"><RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />Загрузка модуля...</div>; }

function AdminPage() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    async function loadAll() {
      setStatsLoading(true);
      const [u, g, s, p, subj] = await Promise.all([fetchUsers(), fetchAllGroups(), fetchStudents(), fetchProfiles(), fetchSubjects()]);
      setUsers(u); setGroups(g); setStudents(s); setProfiles(p); setSubjects(subj);
      setStatsLoading(false);
    }
    loadAll();
  }, []);

  const teacherCount = users.filter((u) => u.role === "teacher").length;
  const activeStudents = students.filter((s) => s.status === "active").length;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsLoading ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
        ) : (
          <>
            <StatCard icon={Users} label="Устазов" value={teacherCount} sub="преподавателей" color="bg-gradient-to-br from-violet-500 to-indigo-600" />
            <StatCard icon={GraduationCap} label="Активных учеников" value={activeStudents} sub={`из ${students.length} всего`} color="bg-gradient-to-br from-emerald-500 to-teal-600" />
            <StatCard icon={Building2} label="Групп" value={groups.length} sub="учебных групп" color="bg-gradient-to-br from-blue-500 to-cyan-600" />
            <StatCard icon={BookOpen} label="Предметов" value={subjects.length} sub="в учебном плане" color="bg-gradient-to-br from-amber-500 to-orange-600" />
          </>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="users">
        <div className="overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0">
        <TabsList className="h-10 p-1 bg-muted/60 rounded-xl gap-1 w-max md:w-auto">
          <TabsTrigger value="users" className="rounded-lg gap-1.5 text-xs md:text-sm">
            <UsersRound className="h-4 w-4" /><span className="hidden sm:inline">Устазы</span>
          </TabsTrigger>
          <TabsTrigger value="students" className="rounded-lg gap-1.5 text-xs md:text-sm">
            <GraduationCap className="h-4 w-4" /><span className="hidden sm:inline">Ученики</span>
          </TabsTrigger>
          <TabsTrigger value="groups" className="rounded-lg gap-1.5 text-xs md:text-sm">
            <Building2 className="h-4 w-4" /><span className="hidden sm:inline">Группы</span>
          </TabsTrigger>
          <TabsTrigger value="subjects" className="rounded-lg gap-1.5 text-xs md:text-sm">
            <BookOpen className="h-4 w-4" /><span className="hidden sm:inline">Предметы</span>
          </TabsTrigger>
          <TabsTrigger value="schedule" className="rounded-lg gap-1.5 text-xs md:text-sm">
            <CalendarDays className="h-4 w-4" /><span className="hidden sm:inline">Расписание</span>
          </TabsTrigger>
          <TabsTrigger value="banners" className="rounded-lg gap-1.5 text-xs md:text-sm">
            <Megaphone className="h-4 w-4" /><span className="hidden sm:inline">Баннеры</span>
          </TabsTrigger>
          <TabsTrigger value="health" className="rounded-lg gap-1.5 text-xs md:text-sm">
            <Activity className="h-4 w-4" /><span className="hidden sm:inline">Здоровье</span>
          </TabsTrigger>
          <TabsTrigger value="audit" className="rounded-lg gap-1.5 text-xs md:text-sm">
            <ScrollText className="h-4 w-4" /><span className="hidden sm:inline">Аудит</span>
          </TabsTrigger>
          <TabsTrigger value="permissions" className="rounded-lg gap-1.5 text-xs md:text-sm">
            <Shield className="h-4 w-4" /><span className="hidden sm:inline">Права</span>
          </TabsTrigger>
        </TabsList>
        </div>

        <div className="mt-5">
          <TabsContent value="users" className="mt-0">
            <Suspense fallback={<Loader />}><UsersTab toast={toast} /></Suspense>
          </TabsContent>
          <TabsContent value="students" className="mt-0">
            <Suspense fallback={<Loader />}><StudentsTab toast={toast} groups={groups} /></Suspense>
          </TabsContent>
          <TabsContent value="groups" className="mt-0">
            <Suspense fallback={<Loader />}><GroupsTab toast={toast} users={users} profiles={profiles} /></Suspense>
          </TabsContent>
          <TabsContent value="subjects" className="mt-0">
            <Suspense fallback={<Loader />}><SubjectsTab toast={toast} /></Suspense>
          </TabsContent>
          <TabsContent value="schedule" className="mt-0">
            <ScheduleConstructor onClose={() => {}} />
          </TabsContent>
          <TabsContent value="banners" className="mt-0">
            <Suspense fallback={<Loader />}><BannersTab toast={toast} userId={currentUser?.id} /></Suspense>
          </TabsContent>
          <TabsContent value="health" className="mt-0">
            <Suspense fallback={<Loader />}><HealthTab /></Suspense>
          </TabsContent>
          <TabsContent value="audit" className="mt-0">
            <Suspense fallback={<Loader />}><AuditTab /></Suspense>
          </TabsContent>
          <TabsContent value="permissions" className="mt-0">
            <Suspense fallback={<Loader />}><PermissionsTab toast={toast} /></Suspense>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

export default AdminPage;
