import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { EmptyState } from "@/components/EmptyState";
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

// 
//  USERS (USTAZY) SECTION
// 

const ROLES = ["teacher", "umo_head", "admin"];
const ROLE_LABELS: Record<string, string> = { teacher: "Устаз", umo_head: "УМО", admin: "Админ" };

type UserForm = { name: string; surname: string; phone: string; email: string; role: string; avatar_url: string };
const emptyUser = (): UserForm => ({ name: "", surname: "", phone: "", email: "", role: "teacher", avatar_url: "" });


const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  login: { label: "Вход", color: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  create: { label: "Создание", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  update: { label: "Изменение", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  delete: { label: "Удаление", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
};

const ENTITY_LABELS: Record<string, string> = {
  user: "Пользователь",
  student: "Ученик",
  group: "Группа",
  subject: "Предмет",
  schedule: "Расписание",
  task: "Задача",
  wiki_category: "Категория Wiki",
  wiki_article: "Статья Wiki",
  dynamic_table: "Таблица",
  banner: "Баннер",
  broadcast: "Объявление",
  storage_folder: "Папка",
};

function AuditTab() {
  const { i18n } = useTranslation();
  const locale = i18n.language === "kk" ? "kk-KZ" : i18n.language === "en" ? "en-US" : "ru-RU";
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterEntity, setFilterEntity] = useState("");
  const limit = 30;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAuditLog({
        limit,
        offset: page * limit,
        action: filterAction || undefined,
        entity_type: filterEntity || undefined,
        search: search || undefined,
      });
      setLogs(data.logs);
      setTotal(data.total);
    } catch { /* ignore */ }
    setLoading(false);
  }, [page, filterAction, filterEntity, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(0); }, [filterAction, filterEntity, search]);

  const totalPages = Math.ceil(total / limit);

  const fmtDate = (d: string) => {
    const dt = new Date(d + "Z");
    return dt.toLocaleString(locale, { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Поиск..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={filterAction} onValueChange={v => setFilterAction(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Действие" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все действия</SelectItem>
            <SelectItem value="login">Вход</SelectItem>
            <SelectItem value="create">Создание</SelectItem>
            <SelectItem value="update">Изменение</SelectItem>
            <SelectItem value="delete">Удаление</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterEntity} onValueChange={v => setFilterEntity(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Тип объекта" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все типы</SelectItem>
            {Object.entries(ENTITY_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={load} className="h-9">
          <RefreshCw className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">{total} записей</span>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left p-2 font-medium">Время</th>
              <th className="text-left p-2 font-medium">Пользователь</th>
              <th className="text-left p-2 font-medium">Действие</th>
              <th className="text-left p-2 font-medium hidden md:table-cell">Тип</th>
              <th className="text-left p-2 font-medium">Объект</th>
              <th className="text-left p-2 font-medium hidden lg:table-cell">IP</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b">
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} className={`p-2 ${j === 3 ? 'hidden md:table-cell' : ''} ${j === 5 ? 'hidden lg:table-cell' : ''}`}>
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} className="p-0 border-b-0"><EmptyState icon={Search} title="Записи не найдены" description="Журнал аудита пуст или записи не найдены." /></td></tr>
            ) : (
              logs.map((log, i) => {
                const act = ACTION_LABELS[log.action] || { label: log.action, color: "bg-gray-100 text-gray-700" };
                return (
                  <motion.tr initial={{opacity: 0, y: 5}} animate={{opacity: 1, y: 0}} transition={{delay: i * 0.02}} key={log.id} className="border-b hover:bg-muted/40 transition-colors">
                    <td className="p-2 text-xs whitespace-nowrap text-muted-foreground">{fmtDate(log.created_at)}</td>
                    <td className="p-2 whitespace-nowrap">{log.user_name || "—"}</td>
                    <td className="p-2">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${act.color}`}>{act.label}</span>
                    </td>
                    <td className="p-2 hidden md:table-cell text-xs text-muted-foreground">
                      {ENTITY_LABELS[log.entity_type] || log.entity_type || "—"}
                    </td>
                    <td className="p-2 max-w-[200px] truncate">{log.entity_name || "—"}</td>
                    <td className="p-2 hidden lg:table-cell text-xs text-muted-foreground font-mono">{log.ip || "—"}</td>
                  </motion.tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>←</Button>
          <span className="text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>→</Button>
        </div>
      )}
    </div>
  );
}

// ====================== PERMISSIONS TAB ======================

export default AuditTab;
