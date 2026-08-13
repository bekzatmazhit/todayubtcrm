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


type GroupForm = { name: string; profile_id: string; curator_id: string; avatar_url: string };
const emptyGroup = (): GroupForm => ({ name: "", profile_id: "", curator_id: "", avatar_url: "" });

function GroupsTab({ toast, users, profiles }: { toast: ReturnType<typeof useToast>["toast"]; users: any[]; profiles: any[] }) {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sheet, setSheet] = useState<{ open: boolean; group?: any }>({ open: false });
  const [form, setForm] = useState<GroupForm>(emptyGroup());
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);


  const load = useCallback(async () => {
    setLoading(true);
    setGroups(await fetchAllGroups());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return groups.filter((g) => {
      const match = (g.name + " " + (g.curator_name ?? "")).toLowerCase().includes(q);
      const statusMatch = statusFilter === "all" || g.status === statusFilter;
      return match && statusMatch;
    });
  }, [groups, search, statusFilter]);

  const teachers = users.filter((u) => u.role === "teacher" || u.role === "umo_head" || u.role === "admin");

  function openCreate() { setForm(emptyGroup()); setSheet({ open: true }); }
  function openEdit(g: any) {
    setForm({ name: g.name, profile_id: g.profile_id ? String(g.profile_id) : "", curator_id: g.curator_id ? String(g.curator_id) : "", avatar_url: g.avatar_url || "" });
    setSheet({ open: true, group: g });
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const data = { name: form.name, profile_id: form.profile_id ? parseInt(form.profile_id) : null, curator_id: form.curator_id ? parseInt(form.curator_id) : null, avatar_url: form.avatar_url || null };
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
      toast({ title: "Группа перемещена в архив" });
      await load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e.message });
    } finally { setDeleting(false); setConfirmDel(null); }
  }

  async function handleRestore(g: any) {
    try {
      await updateGroup(g.id, { ...g, status: "active" });
      toast({ title: "Группа восстановлена из архива" });
      await load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e.message });
    }
  }

  const handleToggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };
  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? filtered.map(g => g.id) : []);
  };
  
  const handleBulkArchive = async () => {
    if (!confirm(`Вы уверены, что хотите отправить в архив ${selectedIds.length} групп?`)) return;
    try {
      for (const id of selectedIds) await deleteGroup(id);
      toast({ title: "Успех", description: `Групп отправлено в архив: ${selectedIds.length}` });
      setSelectedIds([]);
      await load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e.message });
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm("Вы уверены, что хотите НАВСЕГДА удалить выбранные группы?")) return;
    try {
      for (const id of selectedIds) await hardDeleteGroup(id);
      toast({ title: "Удалено", description: "Выбранные группы удалены навсегда" });
      setSelectedIds([]);
      await load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e.message });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-48">
          <SearchBar value={search} onChange={setSearch} placeholder="Поиск по названию или куратору" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="active">Активные</SelectItem>
            <SelectItem value="archived">В архиве</SelectItem>
          </SelectContent>
        </Select>
        {selectedIds.length > 0 && (
          <>
            <Button size="sm" variant="outline" className="h-9 gap-1.5 border-destructive text-destructive hover:bg-destructive hover:text-white" onClick={handleBulkDelete}>
              <Trash2 className="h-4 w-4" />Удалить ({selectedIds.length})
            </Button>
            <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={handleBulkArchive}>
              <Archive className="h-4 w-4" />В архив ({selectedIds.length})
            </Button>
          </>
        )}
        <Button size="sm" className="gap-1.5 h-9" onClick={openCreate}>
          <Plus className="h-4 w-4" />Добавить
        </Button>
      </div>

      {filtered.length > 0 && !loading && (
        <div className="flex items-center gap-2 px-1 mb-2 mt-4">
          <Checkbox 
            checked={selectedIds.length > 0 && selectedIds.length === filtered.length} 
            onCheckedChange={handleSelectAll} 
          />
          <span className="text-xs text-muted-foreground cursor-pointer select-none" onClick={() => handleSelectAll(selectedIds.length !== filtered.length)}>Выбрать все</span>
        </div>
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.length === 0 ? (
            <div className="col-span-full">
              <EmptyState icon={Building2} title="Группы не найдены" description="По вашему запросу не найдено ни одной группы." />
            </div>
          ) : filtered.map((g, i) => {
            const curator = g.curator_id ? users.find((u) => u.id === g.curator_id) : null;
            return (
              <motion.div initial={{opacity: 0, scale: 0.95}} animate={{opacity: 1, scale: 1}} transition={{delay: i * 0.05}} key={g.id}>
                <Card className={`h-full border hover:border-primary/40 hover:shadow-md transition-all group cursor-pointer ${selectedIds.includes(g.id) ? 'ring-2 ring-primary border-primary' : ''}`} onClick={() => openEdit(g)}>
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="pt-2" onClick={(e) => e.stopPropagation()}>
                      <Checkbox 
                        checked={selectedIds.includes(g.id)} 
                        onCheckedChange={() => handleToggleSelect(g.id)}
                      />
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      {g.avatar_url ? (
                        <img src={g.avatar_url} alt={g.name} className="w-full h-full object-cover rounded-xl" />
                      ) : (
                        <Building2 className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-sm">{g.name}</p>
                          {g.status === 'archived' && <Badge variant="secondary" className="text-[9px] px-1.5 bg-muted text-muted-foreground">Архив</Badge>}
                        </div>
                        <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(g)}><Pencil className="h-3 w-3" /></Button>
                          {g.status === 'archived' ? (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={() => handleRestore(g)} title="Восстановить"><Undo2 className="h-3 w-3" /></Button>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setConfirmDel(g)} title="В архив"><Trash2 className="h-3 w-3" /></Button>
                          )}
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
              </motion.div>
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
                <Label className="text-xs">Ссылка на логотип (URL)</Label>
                <Input value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} placeholder="https://example.com/logo.png" />
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
                          {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover rounded-full" alt="avatar" /> : initials(u.name, u.surname)}
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

export default GroupsTab;
