import { useState, useEffect, useCallback, useMemo } from "react";
import { GroupPersonAvatar } from "@/components/GroupPersonAvatar";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard, Users, UsersRound, BookOpen, GraduationCap,
  Plus, Search, Pencil, Trash2, X, ChevronRight, ShieldAlert,
  Phone, Mail, User, Building2, BookMarked, Check, CalendarDays, KeyRound,
  Megaphone, Info, AlertTriangle, AlertCircle, Power, Activity,
  Server, Database, HardDrive, Cpu, RefreshCw, CircleCheck, ScrollText, Shield,
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
  fetchStudents, createStudent, updateStudent, deleteStudent,
  fetchGroups, createGroup, updateGroup, deleteGroup,
  fetchSubjects, createSubject, updateSubject, deleteSubject,
  fetchProfiles,
  fetchAllBanners, createBanner, updateBanner, deleteBanner,
  fetchHealth, fetchAuditLog,
  fetchRolesWithPermissions, fetchPermissions, updateRolePermissions,
} from "@/lib/api";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";

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

type UserForm = { name: string; surname: string; phone: string; email: string; role: string };
const emptyUser = (): UserForm => ({ name: "", surname: "", phone: "", email: "", role: "teacher" });

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
    setForm({ name: u.name, surname: u.surname, phone: u.phone ? formatPhone(u.phone) : "", email: u.email ?? "", role: u.role });
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
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/50">
              <Search className="h-10 w-10 mb-3" />
              <p>Ничего не найдено</p>
            </div>
          ) : filtered.map((u) => (
            <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border hover:border-primary/30 transition-colors group">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0 ${avatarColor(u.id)}`}>
                {initials(u.name, u.surname)}
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
            </div>
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

type StudentForm = { full_name: string; phone: string; parent_phone: string; group_id: string; status: string };
const emptyStudent = (): StudentForm => ({ full_name: "", phone: "", parent_phone: "", group_id: "", status: "active" });

function StudentsTab({ toast, groups }: { toast: ReturnType<typeof useToast>["toast"]; groups: any[] }) {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sheet, setSheet] = useState<{ open: boolean; student?: any }>({ open: false });
  const [form, setForm] = useState<StudentForm>(emptyStudent());
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setStudents(await fetchStudents());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return students.filter((s) => {
      const match = (s.full_name + " " + (s.phone ?? "") + " " + (s.parent_phone ?? "")).toLowerCase().includes(q);
      const grpMatch = groupFilter === "all" || String(s.group_id) === groupFilter;
      const stMatch = statusFilter === "all" || s.status === statusFilter;
      return match && grpMatch && stMatch;
    });
  }, [students, search, groupFilter, statusFilter]);

  function openCreate() { setForm(emptyStudent()); setSheet({ open: true }); }
  function openEdit(s: any) {
    setForm({ full_name: s.full_name, phone: s.phone ? formatPhone(s.phone) : "", parent_phone: s.parent_phone ? formatPhone(s.parent_phone) : "", group_id: s.group_id ? String(s.group_id) : "", status: s.status });
    setSheet({ open: true, student: s });
  }

  async function handleSave() {
    if (!form.full_name.trim()) return;
    setSaving(true);
    try {
      const data = { ...form, group_id: form.group_id ? parseInt(form.group_id) : null };
      if (sheet.student) {
        await updateStudent(sheet.student.id, data);
        toast({ title: "Ученик обновлён", description: form.full_name });
      } else {
        await createStudent(data);
        toast({ title: "Ученик добавлен", description: form.full_name });
      }
      await load();
      setSheet({ open: false });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e.message });
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirmDel) return;
    setDeleting(true);
    try {
      await deleteStudent(confirmDel.id);
      toast({ title: "Удалено", description: `${confirmDel.full_name} удалён` });
      await load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e.message });
    } finally { setDeleting(false); setConfirmDel(null); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-48">
          <SearchBar value={search} onChange={setSearch} placeholder="Поиск по имени или телефону" />
        </div>
        <Select value={groupFilter} onValueChange={setGroupFilter}>
          <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все группы</SelectItem>
            {groups.map((g) => <SelectItem key={g.id} value={String(g.id)}><span className="flex items-center gap-1.5"><GroupPersonAvatar groupName={g.name} size={18} showTooltip={false} />{g.name}</span></SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="active">Активные</SelectItem>
            <SelectItem value="archive">Архив</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" className="gap-1.5 h-9" onClick={openCreate}>
          <Plus className="h-4 w-4" />Добавить
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : (
        <div className="space-y-1.5">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/50">
              <GraduationCap className="h-10 w-10 mb-3" />
              <p>Ничего не найдено</p>
            </div>
          ) : filtered.map((s) => {
            const grp = groups.find((g) => g.id === s.group_id);
            return (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border hover:border-primary/30 transition-colors group">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 ${avatarColor(s.id)}`}>
                  {s.full_name.split(" ").map((w: string) => w[0]).slice(0, 2).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{s.full_name}</p>
                    {statusBadge(s.status)}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                    {grp && <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{grp.name}</span>}
                    {s.phone && <span>{s.phone}</span>}
                    {s.parent_phone && <span>Родитель: {s.parent_phone}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10" onClick={() => openEdit(s)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 text-destructive" onClick={() => setConfirmDel(s)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Sheet open={sheet.open} onOpenChange={(o) => !o && setSheet({ open: false })}>
        <SheetContent className="w-full sm:max-w-md flex flex-col">
          <SheetHeader>
            <SheetTitle>{sheet.student ? "Редактировать ученика" : "Добавить ученика"}</SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1 mt-6">
            <div className="space-y-4 pr-1">
              <div className="space-y-1">
                <Label className="text-xs">ФИО *</Label>
                <Input placeholder="Фамилия Имя Отчество" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />Телефон</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Тел. родителя</Label>
                  <Input value={form.parent_phone} onChange={(e) => setForm({ ...form, parent_phone: formatPhone(e.target.value) })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />Группа</Label>
                <Select value={form.group_id} onValueChange={(v) => setForm({ ...form, group_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Выбрать группу" /></SelectTrigger>
                  <SelectContent>
                    {groups.map((g) => <SelectItem key={g.id} value={String(g.id)}><span className="flex items-center gap-1.5"><GroupPersonAvatar groupName={g.name} size={18} showTooltip={false} />{g.name}</span></SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Статус</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Активный</SelectItem>
                    <SelectItem value="archive">Архив</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </ScrollArea>
          <Separator className="my-4" />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setSheet({ open: false })}>Отмена</Button>
            <Button onClick={handleSave} disabled={!form.full_name.trim() || saving} className="gap-1.5">
              {saving ? "Сохранение" : <><Check className="h-4 w-4" />Сохранить</>}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!confirmDel}
        title="Удалить ученика?"
        description={`${confirmDel?.full_name} будет удалён из базы данных. Архивирование невозможно через данный диалог.`}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDel(null)}
        loading={deleting}
      />
    </div>
  );
}

// 
//  GROUPS SECTION
// 

type GroupForm = { name: string; profile_id: string; curator_id: string };
const emptyGroup = (): GroupForm => ({ name: "", profile_id: "", curator_id: "" });

function GroupsTab({ toast, users, profiles }: { toast: ReturnType<typeof useToast>["toast"]; users: any[]; profiles: any[] }) {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sheet, setSheet] = useState<{ open: boolean; group?: any }>({ open: false });
  const [form, setForm] = useState<GroupForm>(emptyGroup());
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setGroups(await fetchGroups());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return groups.filter((g) => (g.name + " " + (g.curator_name ?? "")).toLowerCase().includes(q));
  }, [groups, search]);

  const teachers = users.filter((u) => u.role === "teacher" || u.role === "umo_head" || u.role === "admin");

  function openCreate() { setForm(emptyGroup()); setSheet({ open: true }); }
  function openEdit(g: any) {
    setForm({ name: g.name, profile_id: g.profile_id ? String(g.profile_id) : "", curator_id: g.curator_id ? String(g.curator_id) : "" });
    setSheet({ open: true, group: g });
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const data = { name: form.name, profile_id: form.profile_id ? parseInt(form.profile_id) : null, curator_id: form.curator_id ? parseInt(form.curator_id) : null };
      if (sheet.group) {
        await updateGroup(sheet.group.id, data);
        toast({ title: "Группа обновлена", description: form.name });
      } else {
        await createGroup(data);
        toast({ title: "Группа создана", description: form.name });
      }
      await load();
      setSheet({ open: false });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e.message });
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirmDel) return;
    setDeleting(true);
    try {
      await deleteGroup(confirmDel.id);
      toast({ title: "Группа удалена" });
      await load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e.message });
    } finally { setDeleting(false); setConfirmDel(null); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <SearchBar value={search} onChange={setSearch} placeholder="Поиск по названию или куратору" />
        </div>
        <Button size="sm" className="gap-1.5 h-9" onClick={openCreate}>
          <Plus className="h-4 w-4" />Добавить
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-muted-foreground/50">
              <Building2 className="h-10 w-10 mb-3" />
              <p>Ничего не найдено</p>
            </div>
          ) : filtered.map((g) => {
            const curator = g.curator_id ? users.find((u) => u.id === g.curator_id) : null;
            return (
              <Card key={g.id} className="border hover:border-primary/40 hover:shadow-md transition-all group cursor-pointer" onClick={() => openEdit(g)}>
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <p className="font-semibold text-sm">{g.name}</p>
                      <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(g)}><Pencil className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setConfirmDel(g)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </div>
                    {g.profile_name && <p className="text-xs text-muted-foreground mt-0.5">{g.profile_name}</p>}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1.5">
                        {curator ? (
                          <>
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${avatarColor(curator.id)}`}>
                              {initials(curator.name, curator.surname)}
                            </div>
                            <span className="text-xs text-muted-foreground">{curator.name} {curator.surname}</span>
                          </>
                        ) : <span className="text-xs text-muted-foreground/50">Куратор не назначен</span>}
                      </div>
                      <Badge variant="outline" className="text-[10px]">{g.students_count ?? 0} уч.</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Sheet open={sheet.open} onOpenChange={(o) => !o && setSheet({ open: false })}>
        <SheetContent className="w-full sm:max-w-md flex flex-col">
          <SheetHeader>
            <SheetTitle>{sheet.group ? "Редактировать группу" : "Создать группу"}</SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1 mt-6">
            <div className="space-y-4 pr-1">
              <div className="space-y-1">
                <Label className="text-xs">Название группы *</Label>
                <Input placeholder="Например: 11 ФМ-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Профиль</Label>
                <Select value={form.profile_id} onValueChange={(v) => setForm({ ...form, profile_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Выбрать профиль" /></SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Куратор</Label>
                <div className="border rounded-lg overflow-hidden">
                  <div className="p-2 border-b bg-muted/30">
                    <p className="text-xs text-muted-foreground">Выберите куратора из списка</p>
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {teachers.map((u) => (
                      <button key={u.id} type="button"
                        className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/60 transition-colors text-left ${form.curator_id === String(u.id) ? "bg-primary/10" : ""}`}
                        onClick={() => setForm({ ...form, curator_id: form.curator_id === String(u.id) ? "" : String(u.id) })}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 ${avatarColor(u.id)}`}>
                          {initials(u.name, u.surname)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{u.name} {u.surname}</p>
                          <p className="text-xs text-muted-foreground">{ROLE_LABELS[u.role] ?? u.role}</p>
                        </div>
                        {form.curator_id === String(u.id) && <Check className="h-4 w-4 text-primary shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
          <Separator className="my-4" />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setSheet({ open: false })}>Отмена</Button>
            <Button onClick={handleSave} disabled={!form.name.trim() || saving} className="gap-1.5">
              {saving ? "Сохранение" : <><Check className="h-4 w-4" />Сохранить</>}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!confirmDel}
        title="Удалить группу?"
        description={`Группа ${confirmDel?.name} будет удалена. Ученики, прикреплённые к ней, останутся в системе.`}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDel(null)}
        loading={deleting}
      />
    </div>
  );
}

// 
//  SUBJECTS SECTION
// 

const SUBJECT_TYPES = ["mandatory", "elective", "extra"];
const SUBJECT_TYPE_LABELS: Record<string, string> = { mandatory: "Обязательный", elective: "Элективный", extra: "Доп." };
const SUBJECT_TYPE_COLORS: Record<string, string> = {
  mandatory: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  elective:  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  extra:     "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

type SubjectForm = { name: string; type: string };
const emptySubject = (): SubjectForm => ({ name: "", type: "mandatory" });

function SubjectsTab({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sheet, setSheet] = useState<{ open: boolean; subject?: any }>({ open: false });
  const [form, setForm] = useState<SubjectForm>(emptySubject());
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setSubjects(await fetchSubjects());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return subjects.filter((s) => {
      const match = s.name.toLowerCase().includes(q);
      const typeMatch = typeFilter === "all" || s.type === typeFilter;
      return match && typeMatch;
    });
  }, [subjects, search, typeFilter]);

  function openCreate() { setForm(emptySubject()); setSheet({ open: true }); }
  function openEdit(s: any) { setForm({ name: s.name, type: s.type ?? "mandatory" }); setSheet({ open: true, subject: s }); }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (sheet.subject) {
        await updateSubject(sheet.subject.id, form);
        toast({ title: "Предмет обновлён", description: form.name });
      } else {
        await createSubject(form);
        toast({ title: "Предмет добавлен", description: form.name });
      }
      await load();
      setSheet({ open: false });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e.message });
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirmDel) return;
    setDeleting(true);
    try {
      await deleteSubject(confirmDel.id);
      toast({ title: "Предмет удалён" });
      await load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e.message });
    } finally { setDeleting(false); setConfirmDel(null); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <SearchBar value={search} onChange={setSearch} placeholder="Поиск по названию предмета" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все типы</SelectItem>
            {SUBJECT_TYPES.map((t) => <SelectItem key={t} value={t}>{SUBJECT_TYPE_LABELS[t]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" className="gap-1.5 h-9" onClick={openCreate}>
          <Plus className="h-4 w-4" />Добавить
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
      ) : (
        <div className="space-y-1.5">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/50">
              <BookOpen className="h-10 w-10 mb-3" />
              <p>Ничего не найдено</p>
            </div>
          ) : filtered.map((s) => (
            <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border hover:border-primary/30 transition-colors group">
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <BookMarked className="h-4.5 w-4.5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0 flex items-center gap-3">
                <p className="font-medium text-sm">{s.name}</p>
                {s.type && (
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SUBJECT_TYPE_COLORS[s.type] ?? SUBJECT_TYPE_COLORS.mandatory}`}>
                    {SUBJECT_TYPE_LABELS[s.type] ?? s.type}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10" onClick={() => openEdit(s)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 text-destructive" onClick={() => setConfirmDel(s)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Sheet open={sheet.open} onOpenChange={(o) => !o && setSheet({ open: false })}>
        <SheetContent className="w-full sm:max-w-sm flex flex-col">
          <SheetHeader>
            <SheetTitle>{sheet.subject ? "Редактировать предмет" : "Добавить предмет"}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6 flex-1">
            <div className="space-y-1">
              <Label className="text-xs">Название *</Label>
              <Input placeholder="Алгебра, Физика" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Тип</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUBJECT_TYPES.map((t) => <SelectItem key={t} value={t}>{SUBJECT_TYPE_LABELS[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Separator className="my-4" />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setSheet({ open: false })}>Отмена</Button>
            <Button onClick={handleSave} disabled={!form.name.trim() || saving} className="gap-1.5">
              {saving ? "Сохранение" : <><Check className="h-4 w-4" />Сохранить</>}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!confirmDel}
        title="Удалить предмет?"
        description={`${confirmDel?.name} будет удалён из системы.`}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDel(null)}
        loading={deleting}
      />
    </div>
  );
}

// 
//  MAIN PAGE
// 

export default function AdminPage() {
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
      const [u, g, s, p, subj] = await Promise.all([fetchUsers(), fetchGroups(), fetchStudents(), fetchProfiles(), fetchSubjects()]);
      setUsers(u); setGroups(g); setStudents(s); setProfiles(p); setSubjects(subj);
      setStatsLoading(false);
    }
    loadAll();
  }, []);

  const teacherCount = users.filter((u) => u.role === "teacher").length;
  const activeStudents = students.filter((s) => s.status === "active").length;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shrink-0">
          <LayoutDashboard className="h-5 w-5 md:h-6 md:w-6 text-white" />
        </div>
        <div>
          <h1 className="text-lg md:text-2xl font-heading font-bold text-foreground">Control Center</h1>
          <p className="text-xs md:text-sm text-muted-foreground">Управление сотрудниками, учениками и данными центра</p>
        </div>
      </div>

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
            <UsersTab toast={toast} />
          </TabsContent>
          <TabsContent value="students" className="mt-0">
            <StudentsTab toast={toast} groups={groups} />
          </TabsContent>
          <TabsContent value="groups" className="mt-0">
            <GroupsTab toast={toast} users={users} profiles={profiles} />
          </TabsContent>
          <TabsContent value="subjects" className="mt-0">
            <SubjectsTab toast={toast} />
          </TabsContent>
          <TabsContent value="schedule" className="mt-0">
            <ScheduleConstructor onClose={() => {}} />
          </TabsContent>
          <TabsContent value="banners" className="mt-0">
            <BannersTab toast={toast} userId={currentUser?.id} />
          </TabsContent>
          <TabsContent value="health" className="mt-0">
            <HealthTab />
          </TabsContent>
          <TabsContent value="audit" className="mt-0">
            <AuditTab />
          </TabsContent>
          <TabsContent value="permissions" className="mt-0">
            <PermissionsTab toast={toast} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

/* ====================== HEALTH TAB ====================== */

function fmtUptime(sec: number) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts = [];
  if (d) parts.push(`${d}д`);
  if (h) parts.push(`${h}ч`);
  if (m) parts.push(`${m}м`);
  if (!parts.length) parts.push(`${s}с`);
  return parts.join(" ");
}

function fmtBytes(bytes: number) {
  if (bytes < 1024) return bytes + " Б";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " КБ";
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " МБ";
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " ГБ";
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

/* ====================== BANNERS TAB ====================== */

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
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Нет записей</td></tr>
            ) : (
              logs.map(log => {
                const act = ACTION_LABELS[log.action] || { label: log.action, color: "bg-gray-100 text-gray-700" };
                return (
                  <tr key={log.id} className="border-b hover:bg-muted/30 transition-colors">
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
                  </tr>
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

function PermissionsTab({ toast }: { toast: any }) {
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [editState, setEditState] = useState<Record<number, Set<number>>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([fetchRolesWithPermissions(), fetchPermissions()]);
      setRoles(r);
      setPermissions(p);
      const state: Record<number, Set<number>> = {};
      for (const role of r) {
        state[role.id] = new Set(role.permissions.map((p: any) => p.permission_id));
      }
      setEditState(state);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (roleId: number, permId: number) => {
    setEditState(prev => {
      const next = { ...prev };
      const set = new Set(next[roleId] || []);
      if (set.has(permId)) set.delete(permId); else set.add(permId);
      next[roleId] = set;
      return next;
    });
  };

  const save = async (roleId: number) => {
    setSaving(roleId);
    try {
      await updateRolePermissions(roleId, [...(editState[roleId] || [])]);
      toast({ title: "Права обновлены" });
      load();
    } catch {
      toast({ title: "Ошибка", variant: "destructive" });
    } finally { setSaving(null); }
  };

  const roleLabelMap: Record<string, string> = {
    admin: "Админ",
    umo_head: "Завуч (УМО)",
    teacher: "Преподаватель",
  };

  const roleColorMap: Record<string, string> = {
    admin: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    umo_head: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    teacher: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  };

  if (loading) return <div className="space-y-3">{Array.from({length: 5}).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <Shield className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Управление правами доступа</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Настройте, какие действия доступны для каждой роли. Изменения вступают в силу при следующем входе пользователя.
      </p>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left p-3 font-medium min-w-[200px]">Разрешение</th>
              {roles.map(role => (
                <th key={role.id} className="text-center p-3 font-medium min-w-[120px]">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${roleColorMap[role.name] || ''}`}>
                    {roleLabelMap[role.name] || role.name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.map(perm => (
              <tr key={perm.id} className="border-b hover:bg-muted/30 transition-colors">
                <td className="p-3">
                  <div>
                    <p className="font-medium text-sm">{perm.name}</p>
                    <p className="text-xs text-muted-foreground">{perm.description}</p>
                  </div>
                </td>
                {roles.map(role => (
                  <td key={role.id} className="text-center p-3">
                    <Checkbox
                      checked={editState[role.id]?.has(perm.id) || false}
                      onCheckedChange={() => toggle(role.id, perm.id)}
                      disabled={role.name === 'admin' && perm.key === 'manage_permissions'}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2 justify-end">
        {roles.map(role => (
          <Button
            key={role.id}
            size="sm"
            onClick={() => save(role.id)}
            disabled={saving !== null}
          >
            {saving === role.id ? "Сохранение..." : `Сохранить ${roleLabelMap[role.name] || role.name}`}
          </Button>
        ))}
      </div>
    </div>
  );
}
