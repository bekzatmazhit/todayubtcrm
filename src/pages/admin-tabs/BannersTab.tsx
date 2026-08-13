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

// 
//  USERS (USTAZY) SECTION
// 

const ROLES = ["teacher", "umo_head", "admin"];
const ROLE_LABELS: Record<string, string> = { teacher: "Устаз", umo_head: "УМО", admin: "Админ" };

type UserForm = { name: string; surname: string; phone: string; email: string; role: string; avatar_url: string };
const emptyUser = (): UserForm => ({ name: "", surname: "", phone: "", email: "", role: "teacher", avatar_url: "" });


const BANNER_TYPE_CONFIG: Record<string, { label: string; color: string; icon: typeof Info }> = {
  info: { label: "Инфо", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", icon: Info },
  warning: { label: "Внимание", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", icon: AlertTriangle },
  danger: { label: "Критический", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300", icon: AlertCircle },
};

function BannersTab({ toast, userId }: { toast: any; userId?: string }) {
  const { i18n } = useTranslation();
  const locale = i18n.language === "kk" ? "kk-KZ" : i18n.language === "en" ? "en-US" : "ru-RU";
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editBanner, setEditBanner] = useState<any>(null);
  const [text, setText] = useState("");
  const [type, setType] = useState("info");
  const [expiresAt, setExpiresAt] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await fetchAllBanners();
      setBanners(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!text.trim() || !userId) return;
    try {
      await createBanner({ text: text.trim(), type, created_by: Number(userId), expires_at: expiresAt || undefined });
      toast({ title: "Баннер создан" });
      setText(""); setType("info"); setExpiresAt(""); setShowCreate(false);
      load();
    } catch {
      toast({ title: "Ошибка создания баннера", variant: "destructive" });
    }
  };

  const handleToggle = async (banner: any) => {
    await updateBanner(banner.id, { is_active: banner.is_active ? 0 : 1 });
    toast({ title: banner.is_active ? "Баннер отключён" : "Баннер включён" });
    load();
  };

  const handleDeleteBanner = async (id: number) => {
    await deleteBanner(id);
    toast({ title: "Баннер удалён" });
    load();
  };

  const handleEdit = async () => {
    if (!editBanner || !text.trim()) return;
    await updateBanner(editBanner.id, { text: text.trim(), type, expires_at: expiresAt || undefined });
    toast({ title: "Баннер обновлён" });
    setEditBanner(null); setText(""); setType("info"); setExpiresAt("");
    load();
  };

  const openEdit = (banner: any) => {
    setEditBanner(banner);
    setText(banner.text);
    setType(banner.type);
    setExpiresAt(banner.expires_at || "");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Информационные баннеры</h3>
          <p className="text-sm text-muted-foreground">Бегущая строка вверху экрана для всех пользователей</p>
        </div>
        <Button className="gap-1.5" onClick={() => { setShowCreate(true); setText(""); setType("info"); setExpiresAt(""); }}>
          <Plus className="h-4 w-4" /> Новый баннер
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : banners.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>Нет баннеров</p>
        </div>
      ) : (
        <div className="space-y-2">
          {banners.map(banner => {
            const cfg = BANNER_TYPE_CONFIG[banner.type] || BANNER_TYPE_CONFIG.info;
            const BIcon = cfg.icon;
            return (
              <Card key={banner.id} className={`${!banner.is_active ? 'opacity-50' : ''}`}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${cfg.color}`}>
                    <BIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{banner.text}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <Badge variant="outline" className={`text-[10px] ${cfg.color}`}>{cfg.label}</Badge>
                      <span>{banner.is_active ? "Активный" : "Отключён"}</span>
                      {banner.expires_at && <span>до {new Date(banner.expires_at).toLocaleDateString(locale)}</span>}
                      <span>{banner.creator_name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggle(banner)}>
                      <Power className={`h-3.5 w-3.5 ${banner.is_active ? 'text-green-500' : 'text-muted-foreground'}`} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(banner)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteBanner(banner.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      {(showCreate || editBanner) && (
        <Dialog open onOpenChange={() => { setShowCreate(false); setEditBanner(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editBanner ? "Редактировать баннер" : "Новый баннер"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label className="mb-1">Текст баннера *</Label>
                <Input value={text} onChange={e => setText(e.target.value)} placeholder="Текст объявления..." />
              </div>
              <div>
                <Label className="mb-1">Тип</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">🔵 Информация</SelectItem>
                    <SelectItem value="warning">🟡 Предупреждение</SelectItem>
                    <SelectItem value="danger">🔴 Критический</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1">Срок действия (необязательно)</Label>
                <Input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowCreate(false); setEditBanner(null); }}>Отмена</Button>
              <Button onClick={editBanner ? handleEdit : handleCreate} disabled={!text.trim()}>
                {editBanner ? "Сохранить" : "Создать"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/* ====================== AUDIT TAB ====================== */

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

export default BannersTab;
