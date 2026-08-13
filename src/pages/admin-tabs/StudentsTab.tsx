import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { GroupPersonAvatar } from "@/components/GroupPersonAvatar";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { EmptyState } from "@/components/EmptyState";
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


type StudentForm = { first_name: string; last_name: string; phone: string; parent_phone: string; parent_name: string; group_id: string; status: string };
const emptyStudent = (): StudentForm => ({ first_name: "", last_name: "", phone: "", parent_phone: "", parent_name: "", group_id: "", status: "active" });

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
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkArchiveOpen, setBulkArchiveOpen] = useState(false);
  const [gradYear, setGradYear] = useState("");

  const handleToggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };
  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? filtered.map(s => s.id) : []);
  };
  const handleBulkArchive = async () => {
    if (!gradYear) return toast({ title: "Ошибка", description: "Укажите причину (например, Выпуск 2026)" });
    try {
      await bulkArchiveStudents({ studentIds: selectedIds, graduation_year: gradYear });
      toast({ title: "Успех", description: `Учеников в архиве: ${selectedIds.length}` });
      setBulkArchiveOpen(false);
      setSelectedIds([]);
      await load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e.message });
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm("Вы уверены, что хотите НАВСЕГДА удалить выбранных учеников?")) return;
    try {
      for (const id of selectedIds) await deleteStudent(id);
      toast({ title: "Удалено", description: "Выбранные ученики удалены" });
      setSelectedIds([]);
      await load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e.message });
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setStudents(await fetchStudents());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return students.filter((s) => {
      const match = (s.full_name + " " + (s.phone ?? "") + " " + (s.parent_phone ?? "") + " " + (s.parent_name ?? "")).toLowerCase().includes(q);
      const grpMatch = groupFilter === "all" || String(s.group_id) === groupFilter;
      const stMatch = statusFilter === "all" || s.status === statusFilter;
      return match && grpMatch && stMatch;
    });
  }, [students, search, groupFilter, statusFilter]);

  function openCreate() { setForm(emptyStudent()); setSheet({ open: true }); }
  function openEdit(s: any) {
    const parts = (s.full_name || "").split(" ");
    const first_name = parts[0] || "";
    const last_name = parts.slice(1).join(" ");
    setForm({ first_name, last_name, phone: s.phone ? formatPhone(s.phone) : "", parent_phone: s.parent_phone ? formatPhone(s.parent_phone) : "", parent_name: s.parent_name ?? "", group_id: s.group_id ? String(s.group_id) : "", status: s.status });
    setSheet({ open: true, student: s });
  }

  async function handleSave() {
    if (!form.first_name.trim() || !form.last_name.trim()) return;
    setSaving(true);
    try {
      const full_name = `${form.first_name.trim()} ${form.last_name.trim()}`;
      const data = { 
        full_name,
        phone: form.phone,
        parent_phone: form.parent_phone,
        parent_name: form.parent_name,
        group_id: form.group_id ? parseInt(form.group_id) : null,
        status: form.status
      };
      if (sheet.student) {
        await updateStudent(sheet.student.id, data);
        toast({ title: "Ученик обновлен", description: full_name });
      } else {
        await createStudent(data);
        toast({ title: "Ученик добавлен", description: full_name });
      }
      await load();
      setSheet({ open: false });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e.message });
    } finally { setSaving(false); }
  }

  async function handleArchive() {
    if (!confirmDel) return;
    setDeleting(true);
    try {
      await archiveStudent(confirmDel.id);
      toast({ title: "Ученик перенесен в архив" });
      await load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e.message });
    } finally { setDeleting(false); setConfirmDel(null); }
  }

  async function handleRestore(s: any) {
    try {
      await updateStudent(s.id, { ...s, status: "active" });
      toast({ title: "Ученик восстановлен из архива" });
      await load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e.message });
    }
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
            {groups.map((g) => <SelectItem key={g.id} value={String(g.id)}><span className="flex items-center gap-1.5"><GroupPersonAvatar groupName={g.name} avatarUrl={g.avatar_url} size={18} showTooltip={false} />{g.name}</span></SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="active">Активные</SelectItem>
            <SelectItem value="archived">Архив</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="gap-1.5 h-9" onClick={() => setImportModalOpen(true)}>
          <Upload className="h-4 w-4" />Импорт
        </Button>
        <Button size="sm" className="gap-1.5 h-9" onClick={openCreate}>
          <Plus className="h-4 w-4" />Добавить
        </Button>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl border animate-in fade-in slide-in-from-top-2">
          <span className="text-sm font-medium">Выбрано учеников: {selectedIds.length}</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setBulkArchiveOpen(true)} className="gap-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50">
              <Archive className="h-4 w-4" /> В папку (Архив)
            </Button>
            <Button size="sm" variant="outline" onClick={handleBulkDelete} className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive">
              <Trash2 className="h-4 w-4" /> Удалить
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : (
        <div className="space-y-1.5">
          {filtered.length > 0 && (
            <div className="flex items-center gap-2 px-3 pb-2 text-xs font-medium text-muted-foreground">
              <Checkbox checked={selectedIds.length === filtered.length && filtered.length > 0} onCheckedChange={handleSelectAll} />
              <span className="ml-2">Выбрать всех</span>
            </div>
          )}
          {filtered.length === 0 ? (
            <EmptyState icon={GraduationCap} title="Ученики не найдены" description="По вашему запросу не найдено ни одного ученика." />
          ) : filtered.map((s, i) => {
            const grp = groups.find((g) => g.id === s.group_id);
            return (
              <motion.div initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}} transition={{delay: i * 0.05}} key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border hover:border-primary/50 hover:shadow-md transition-all group">
                <Checkbox checked={selectedIds.includes(s.id)} onCheckedChange={() => handleToggleSelect(s.id)} />
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 ${avatarColor(s.id)}`}>
                  {s.avatar_url ? <img src={s.avatar_url} className="w-full h-full object-cover rounded-full" alt="avatar" /> : s.full_name.split(" ").map((w: string) => w[0]).slice(0, 2).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-sm leading-none">{s.full_name}</p>
                          {s.status === 'archived' && <Badge variant="secondary" className="text-[9px] px-1.5 bg-muted text-muted-foreground">Архив</Badge>}
                        </div>
                    {statusBadge(s.status)}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                    {grp && <span className="inline-flex items-center gap-1"><GroupPersonAvatar groupName={grp.name} avatarUrl={grp.avatar_url} size={14} showTooltip={false} />{grp.name}</span>}
                    {s.phone && <span>{s.phone}</span>}
                    {s.parent_phone && <span>Родитель: {s.parent_phone}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10" onClick={() => openEdit(s)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {s.status === 'archived' ? (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:bg-green-50" onClick={() => handleRestore(s)} title="Восстановить">
                      <Undo2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-amber-100 text-amber-600" onClick={() => setConfirmDel(s)} title="В архив">
                      <Archive className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </motion.div>
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
            <div className="space-y-5 pr-1">
              <div className="p-4 bg-muted/40 rounded-xl space-y-4 border border-border/50">
                <h4 className="text-sm font-semibold flex items-center gap-2"><User className="h-4 w-4 text-primary" /> Основная информация</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Имя *</Label>
                    <Input placeholder="Иван" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="bg-background" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Фамилия *</Label>
                    <Input placeholder="Иванов" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="bg-background" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-muted-foreground" />Телефон ученика</Label>
                  <Input placeholder="+7 (...)" value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })} className="bg-background" />
                </div>
              </div>

              <div className="p-4 bg-muted/40 rounded-xl space-y-4 border border-border/50">
                <h4 className="text-sm font-semibold flex items-center gap-2"><UsersRound className="h-4 w-4 text-primary" /> Родители</h4>
                <div className="space-y-1">
                  <Label className="text-xs">Имя родителя</Label>
                  <Input placeholder="ФИО родителя" value={form.parent_name} onChange={(e) => setForm({ ...form, parent_name: e.target.value })} className="bg-background" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-muted-foreground" />Телефон родителя</Label>
                  <Input placeholder="+7 (...)" value={form.parent_phone} onChange={(e) => setForm({ ...form, parent_phone: formatPhone(e.target.value) })} className="bg-background" />
                </div>
              </div>

              <div className="p-4 bg-muted/40 rounded-xl space-y-4 border border-border/50">
                <h4 className="text-sm font-semibold flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Учеба</h4>
                <div className="space-y-1">
                  <Label className="text-xs">Группа</Label>
                  <Select value={form.group_id} onValueChange={(v) => setForm({ ...form, group_id: v })}>
                    <SelectTrigger className="bg-background"><SelectValue placeholder="Выбрать группу" /></SelectTrigger>
                    <SelectContent>
                      {groups.map((g) => <SelectItem key={g.id} value={String(g.id)}><span className="flex items-center gap-1.5"><GroupPersonAvatar groupName={g.name} avatarUrl={g.avatar_url} size={18} showTooltip={false} />{g.name}</span></SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Статус</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Активный</SelectItem>
                      <SelectItem value="archived">Архив</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </ScrollArea>
          <Separator className="my-4" />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setSheet({ open: false })}>Отмена</Button>
            <Button onClick={handleSave} disabled={!form.first_name.trim() || !form.last_name.trim() || saving} className="gap-1.5">
              {saving ? "Сохранение..." : <><Check className="h-4 w-4" />Сохранить</>}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!confirmDel}
        title="Архивировать ученика?"
        description={`${confirmDel?.full_name} будет перенесен в архив (он не будет отображаться в активных списках).`}
        onConfirm={handleArchive}
        onCancel={() => setConfirmDel(null)}
        loading={deleting}
      />

      <Dialog open={bulkArchiveOpen} onOpenChange={setBulkArchiveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Перенос в папку (Архив)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Выбрано учеников: <strong>{selectedIds.length}</strong>. Укажите папку (например, "Выпуск 2026", "Отчислен", "Перевод"), чтобы перенести их туда и скрыть из активного списка.
            </p>
            <div className="space-y-2">
              <Label>Папка / Причина архивации</Label>
              <Input placeholder="Например: Выпуск 2026" value={gradYear} onChange={(e) => setGradYear(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkArchiveOpen(false)}>Отмена</Button>
            <Button onClick={handleBulkArchive} className="gap-2 bg-amber-600 hover:bg-amber-700">Перенести в архив</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BulkImportModal open={importModalOpen} onOpenChange={setImportModalOpen} onSuccess={load} />
    </div>
  );
}

// 
//  GROUPS SECTION
// 

type GroupForm = { name: string; profile_id: string; curator_id: string; avatar_url: string };
const emptyGroup = (): GroupForm => ({ name: "", profile_id: "", curator_id: "", avatar_url: "" });

export default StudentsTab;
