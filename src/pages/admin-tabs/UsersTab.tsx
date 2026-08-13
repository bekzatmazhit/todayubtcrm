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


function UsersTab({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sheet, setSheet] = useState<{ open: boolean; user?: any }>({ open: false });
  const [form, setForm] = useState<UserForm>(emptyUser());
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pwdUser, setPwdUser] = useState<any | null>(null);
  const [newPwd, setNewPwd] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setUsers(await fetchUsers());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter((u) => {
      const match = (u.name + " " + u.surname + " " + (u.email ?? "")).toLowerCase().includes(q);
      const roleMatch = roleFilter === "all" || u.role === roleFilter;
      return match && roleMatch;
    });
  }, [users, search, roleFilter]);

  function openCreate() {
    setForm(emptyUser());
    setSheet({ open: true });
  }

  function openEdit(u: any) {
    setForm({ name: u.name, surname: u.surname, phone: u.phone ? formatPhone(u.phone) : "", email: u.email ?? "", role: u.role, avatar_url: u.avatar_url ?? "" });
    setSheet({ open: true, user: u });
  }

  async function handleSave() {
    if (!form.name || !form.surname) return;
    setSaving(true);
    try {
      if (sheet.user) {
        await updateUser(sheet.user.id, form);
        toast({ title: "Устаз обновлён", description: `${form.name} ${form.surname}` });
      } else {
        await createUser(form);
        toast({ title: "Устаз добавлен", description: `${form.name} ${form.surname}` });
      }
      await load();
      setSheet({ open: false });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e.message });
    } finally { setSaving(false); }
  }

  async function handleChangePwd() {
    if (!pwdUser || !newPwd) return;
    setSavingPwd(true);
    try {
      await updateUser(pwdUser.id, { password: newPwd });
      toast({ title: "Пароль изменён", description: `${pwdUser.name} ${pwdUser.surname}` });
      setPwdUser(null);
      setNewPwd("");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e.message });
    } finally { setSavingPwd(false); }
  }

  async function handleDelete() {
    if (!confirmDel) return;
    setDeleting(true);
    try {
      await deleteUser(confirmDel.id);
      toast({ title: "Удалено", description: `${confirmDel.name} ${confirmDel.surname} удалён` });
      await load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e.message });
    } finally { setDeleting(false); setConfirmDel(null); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <SearchBar value={search} onChange={setSearch} placeholder="Поиск по имени или email" />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все роли</SelectItem>
            {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" className="gap-1.5 h-9" onClick={openCreate}>
          <Plus className="h-4 w-4" />Добавить
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <EmptyState icon={Search} title="Пользователи не найдены" description="По вашему запросу не найдено ни одного пользователя." />
          ) : filtered.map((u, i) => (
            <motion.div initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}} transition={{delay: i * 0.05}} key={u.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border hover:border-primary/50 hover:shadow-md transition-all group">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0 ${avatarColor(u.id)}`}>
                {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover rounded-full" alt="avatar" /> : initials(u.name, u.surname)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{u.name} {u.surname}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {roleBadge(u.role)}
                  {u.email && <span className="text-xs text-muted-foreground truncate">{u.email}</span>}
                  {u.phone && <span className="text-xs text-muted-foreground">{formatPhone(u.phone)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10" onClick={() => openEdit(u)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-amber-500/10 text-amber-600" onClick={() => { setPwdUser(u); setNewPwd(""); }}>
                  <KeyRound className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 text-destructive" onClick={() => setConfirmDel(u)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Slide-over */}
      <Sheet open={sheet.open} onOpenChange={(o) => !o && setSheet({ open: false })}>
        <SheetContent className="w-full sm:max-w-md flex flex-col">
          <SheetHeader>
            <SheetTitle>{sheet.user ? "Редактировать устаза" : "Добавить устаза"}</SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1 mt-6">
            <div className="space-y-4 pr-1">
              <div className="flex gap-3">
                <div className="space-y-1 flex-1">
                  <Label className="text-xs">Имя *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-1 flex-1">
                  <Label className="text-xs">Фамилия *</Label>
                  <Input value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />Телефон</Label>
                <Input placeholder="+7 (777) 123-45-67" value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1.5"><User className="h-3.5 w-3.5" />Роль</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1.5"><Image className="h-3.5 w-3.5" />Ссылка на аватар (URL)</Label>
                <Input placeholder="https://example.com/avatar.jpg" value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} />
              </div>
              {!sheet.user && (
                <p className="text-xs text-muted-foreground bg-muted/60 rounded-lg px-3 py-2">
                  Временный пароль будет сгенерирован автоматически.
                </p>
              )}
            </div>
          </ScrollArea>
          <Separator className="my-4" />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setSheet({ open: false })}>Отмена</Button>
            <Button onClick={handleSave} disabled={!form.name || !form.surname || saving} className="gap-1.5">
              {saving ? "Сохранение" : <><Check className="h-4 w-4" />Сохранить</>}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Password change dialog */}
      <Dialog open={!!pwdUser} onOpenChange={(o) => !o && setPwdUser(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Изменить пароль</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {pwdUser?.name} {pwdUser?.surname}
          </p>
          <div className="space-y-1">
            <Label className="text-xs">Новый пароль</Label>
            <Input
              type="text"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              placeholder="Введите новый пароль"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwdUser(null)}>Отмена</Button>
            <Button onClick={handleChangePwd} disabled={!newPwd || newPwd.length < 4 || savingPwd}>
              {savingPwd ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDel}
        title="Удалить устаза?"
        description={`${confirmDel?.name} ${confirmDel?.surname} будет удалён из системы. Это действие нельзя отменить.`}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDel(null)}
        loading={deleting}
      />
    </div>
  );
}

// 
//  STUDENTS SECTION
// 

type StudentForm = { full_name: string; phone: string; parent_phone: string; parent_name: string; group_id: string; status: string };
const emptyStudent = (): StudentForm => ({ full_name: "", phone: "", parent_phone: "", parent_name: "", group_id: "", status: "active" });

export default UsersTab;
