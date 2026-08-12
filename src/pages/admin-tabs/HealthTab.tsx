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



function HealthTab() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchHealth();
      setHealth(data);
    } catch (e: any) {
      setError(e.message || "Ошибка");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>;
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" className="mt-3" onClick={load}><RefreshCw className="h-4 w-4 mr-2" />Обновить</Button>
      </div>
    );
  }

  const mem = health.memory || {};
  const heapPercent = mem.heapTotal ? Math.round((mem.heapUsed / mem.heapTotal) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2"><Activity className="h-5 w-5 text-primary" />Мониторинг системы</h3>
        <Button variant="outline" size="sm" onClick={load} className="gap-1.5"><RefreshCw className="h-3.5 w-3.5" />Обновить</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Status */}
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <CircleCheck className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Статус</p>
              <p className="text-lg font-bold text-emerald-600">Работает</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Node.js {health.node_version}</p>
        </CardContent></Card>

        {/* Uptime */}
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Server className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Аптайм</p>
              <p className="text-lg font-bold">{fmtUptime(health.uptime_seconds)}</p>
            </div>
          </div>
        </CardContent></Card>

        {/* DB Response */}
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Database className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Отклик БД</p>
              <p className="text-lg font-bold">{health.db_response_ms} мс</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{health.db_response_ms < 5 ? "Отлично" : health.db_response_ms < 20 ? "Нормально" : "Медленно"}</p>
        </CardContent></Card>

        {/* Disk: DB */}
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <HardDrive className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Размер БД</p>
              <p className="text-lg font-bold">{fmtBytes(health.db_size_bytes)}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Файлы: {fmtBytes(health.uploads_size_bytes)} · Всего: {fmtBytes(health.total_size_bytes)}</p>
        </CardContent></Card>

        {/* Memory */}
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
              <Cpu className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Память (Heap)</p>
              <p className="text-lg font-bold">{fmtBytes(mem.heapUsed)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2"><Progress value={heapPercent} className="h-1.5 flex-1" /><span className="text-xs text-muted-foreground">{heapPercent}%</span></div>
          <p className="text-xs text-muted-foreground mt-1">Всего: {fmtBytes(mem.heapTotal)} · RSS: {fmtBytes(mem.rss)}</p>
        </CardContent></Card>

        {/* Counts */}
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-cyan-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Записи</p>
              <p className="text-lg font-bold">{health.user_count + health.student_count}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Сотрудники: {health.user_count} · Ученики: {health.student_count}</p>
        </CardContent></Card>
      </div>
    </div>
  );
}

export default HealthTab;
