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
    admin:    { label: "╨Р╨┤╨╝╨╕╨╜",    cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
    umo_head: { label: "╨г╨Ь╨Ю",      cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
    teacher:  { label: "╨г╤Б╤В╨░╨╖",    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  };
  const { label, cls } = map[role] ?? { label: role, cls: "bg-gray-100 text-gray-600" };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

function statusBadge(status: string) {
  return status === "active"
    ? <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-0">╨Р╨║╤В╨╕╨▓╨╜╤Л╨╣</Badge>
    : <Badge variant="secondary" className="text-[10px]">╨Р╤А╤Е╨╕╨▓</Badge>;
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
          <Button variant="outline" onClick={onCancel} disabled={loading}>╨Ю╤В╨╝╨╡╨╜╨░</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading ? "╨г╨┤╨░╨╗╨╡╨╜╨╕╨╡" : "╨Ф╨░, ╤Г╨┤╨░╨╗╨╕╤В╤М"}
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
const ROLE_LABELS: Record<string, string> = { teacher: "╨г╤Б╤В╨░╨╖", umo_head: "╨г╨Ь╨Ю", admin: "╨Р╨┤╨╝╨╕╨╜" };

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
        toast({ title: "╨г╤Б╤В╨░╨╖ ╨╛╨▒╨╜╨╛╨▓╨╗╤С╨╜", description: `${form.name} ${form.surname}` });
      } else {
        await createUser(form);
        toast({ title: "╨г╤Б╤В╨░╨╖ ╨┤╨╛╨▒╨░╨▓╨╗╨╡╨╜", description: `${form.name} ${form.surname}` });
      }
      await load();
      setSheet({ open: false });
    } catch (e: any) {
      toast({ variant: "destructive", title: "╨Ю╤И╨╕╨▒╨║╨░", description: e.message });
    } finally { setSaving(false); }
  }

  async function handleChangePwd() {
    if (!pwdUser || !newPwd) return;
    setSavingPwd(true);
    try {
      await updateUser(pwdUser.id, { password: newPwd });
      toast({ title: "╨Я╨░╤А╨╛╨╗╤М ╨╕╨╖╨╝╨╡╨╜╤С╨╜", description: `${pwdUser.name} ${pwdUser.surname}` });
      setPwdUser(null);
      setNewPwd("");
    } catch (e: any) {
      toast({ variant: "destructive", title: "╨Ю╤И╨╕╨▒╨║╨░", description: e.message });
    } finally { setSavingPwd(false); }
  }

  async function handleDelete() {
    if (!confirmDel) return;
    setDeleting(true);
    try {
      await deleteUser(confirmDel.id);
      toast({ title: "╨г╨┤╨░╨╗╨╡╨╜╨╛", description: `${confirmDel.name} ${confirmDel.surname} ╤Г╨┤╨░╨╗╤С╨╜` });
      await load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "╨Ю╤И╨╕╨▒╨║╨░", description: e.message });
    } finally { setDeleting(false); setConfirmDel(null); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <SearchBar value={search} onChange={setSearch} placeholder="╨Я╨╛╨╕╤Б╨║ ╨┐╨╛ ╨╕╨╝╨╡╨╜╨╕ ╨╕╨╗╨╕ email" />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">╨Т╤Б╨╡ ╤А╨╛╨╗╨╕</SelectItem>
            {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" className="gap-1.5 h-9" onClick={openCreate}>
          <Plus className="h-4 w-4" />╨Ф╨╛╨▒╨░╨▓╨╕╤В╤М
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/50">
              <Search className="h-10 w-10 mb-3" />
              <p>╨Э╨╕╤З╨╡╨│╨╛ ╨╜╨╡ ╨╜╨░╨╣╨┤╨╡╨╜╨╛</p>
            </div>
          ) : filtered.map((u) => (
            <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border hover:border-primary/30 transition-colors group">
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
            </div>
          ))}
        </div>
      )}

      {/* Slide-over */}
      <Sheet open={sheet.open} onOpenChange={(o) => !o && setSheet({ open: false })}>
        <SheetContent className="w-full sm:max-w-md flex flex-col">
          <SheetHeader>
            <SheetTitle>{sheet.user ? "╨а╨╡╨┤╨░╨║╤В╨╕╤А╨╛╨▓╨░╤В╤М ╤Г╤Б╤В╨░╨╖╨░" : "╨Ф╨╛╨▒╨░╨▓╨╕╤В╤М ╤Г╤Б╤В╨░╨╖╨░"}</SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1 mt-6">
            <div className="space-y-4 pr-1">
              <div className="flex gap-3">
                <div className="space-y-1 flex-1">
                  <Label className="text-xs">╨Ш╨╝╤П *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-1 flex-1">
                  <Label className="text-xs">╨д╨░╨╝╨╕╨╗╨╕╤П *</Label>
                  <Input value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />╨в╨╡╨╗╨╡╤Д╨╛╨╜</Label>
                <Input placeholder="+7 (777) 123-45-67" value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1.5"><User className="h-3.5 w-3.5" />╨а╨╛╨╗╤М</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1.5"><Image className="h-3.5 w-3.5" />╨б╤Б╤Л╨╗╨║╨░ ╨╜╨░ ╨░╨▓╨░╤В╨░╤А (URL)</Label>
                <Input placeholder="https://example.com/avatar.jpg" value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} />
              </div>
              {!sheet.user && (
                <p className="text-xs text-muted-foreground bg-muted/60 rounded-lg px-3 py-2">
                  ╨Т╤А╨╡╨╝╨╡╨╜╨╜╤Л╨╣ ╨┐╨░╤А╨╛╨╗╤М ╨▒╤Г╨┤╨╡╤В ╤Б╨│╨╡╨╜╨╡╤А╨╕╤А╨╛╨▓╨░╨╜ ╨░╨▓╤В╨╛╨╝╨░╤В╨╕╤З╨╡╤Б╨║╨╕.
                </p>
              )}
            </div>
          </ScrollArea>
          <Separator className="my-4" />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setSheet({ open: false })}>╨Ю╤В╨╝╨╡╨╜╨░</Button>
            <Button onClick={handleSave} disabled={!form.name || !form.surname || saving} className="gap-1.5">
              {saving ? "╨б╨╛╤Е╤А╨░╨╜╨╡╨╜╨╕╨╡" : <><Check className="h-4 w-4" />╨б╨╛╤Е╤А╨░╨╜╨╕╤В╤М</>}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Password change dialog */}
      <Dialog open={!!pwdUser} onOpenChange={(o) => !o && setPwdUser(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>╨Ш╨╖╨╝╨╡╨╜╨╕╤В╤М ╨┐╨░╤А╨╛╨╗╤М</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {pwdUser?.name} {pwdUser?.surname}
          </p>
          <div className="space-y-1">
            <Label className="text-xs">╨Э╨╛╨▓╤Л╨╣ ╨┐╨░╤А╨╛╨╗╤М</Label>
            <Input
              type="text"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              placeholder="╨Т╨▓╨╡╨┤╨╕╤В╨╡ ╨╜╨╛╨▓╤Л╨╣ ╨┐╨░╤А╨╛╨╗╤М"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwdUser(null)}>╨Ю╤В╨╝╨╡╨╜╨░</Button>
            <Button onClick={handleChangePwd} disabled={!newPwd || newPwd.length < 4 || savingPwd}>
              {savingPwd ? "╨б╨╛╤Е╤А╨░╨╜╨╡╨╜╨╕╨╡..." : "╨б╨╛╤Е╤А╨░╨╜╨╕╤В╤М"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDel}
        title="╨г╨┤╨░╨╗╨╕╤В╤М ╤Г╤Б╤В╨░╨╖╨░?"
        description={`${confirmDel?.name} ${confirmDel?.surname} ╨▒╤Г╨┤╨╡╤В ╤Г╨┤╨░╨╗╤С╨╜ ╨╕╨╖ ╤Б╨╕╤Б╤В╨╡╨╝╤Л. ╨н╤В╨╛ ╨┤╨╡╨╣╤Б╤В╨▓╨╕╨╡ ╨╜╨╡╨╗╤М╨╖╤П ╨╛╤В╨╝╨╡╨╜╨╕╤В╤М.`}
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
    if (!gradYear) return toast({ title: "╨Ю╤И╨╕╨▒╨║╨░", description: "╨г╨║╨░╨╢╨╕╤В╨╡ ╨┐╤А╨╕╤З╨╕╨╜╤Г (╨╜╨░╨┐╤А╨╕╨╝╨╡╤А, ╨Т╤Л╨┐╤Г╤Б╨║ 2026)" });
    try {
      await bulkArchiveStudents({ studentIds: selectedIds, graduation_year: gradYear });
      toast({ title: "╨г╤Б╨┐╨╡╤Е", description: `╨г╤З╨╡╨╜╨╕╨║╨╛╨▓ ╨▓ ╨░╤А╤Е╨╕╨▓╨╡: ${selectedIds.length}` });
      setBulkArchiveOpen(false);
      setSelectedIds([]);
      await load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "╨Ю╤И╨╕╨▒╨║╨░", description: e.message });
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm("╨Т╤Л ╤Г╨▓╨╡╤А╨╡╨╜╤Л, ╤З╤В╨╛ ╤Е╨╛╤В╨╕╤В╨╡ ╨Э╨Р╨Т╨б╨Х╨У╨Ф╨Р ╤Г╨┤╨░╨╗╨╕╤В╤М ╨▓╤Л╨▒╤А╨░╨╜╨╜╤Л╤Е ╤Г╤З╨╡╨╜╨╕╨║╨╛╨▓?")) return;
    try {
      for (const id of selectedIds) await deleteStudent(id);
      toast({ title: "╨г╨┤╨░╨╗╨╡╨╜╨╛", description: "╨Т╤Л╨▒╤А╨░╨╜╨╜╤Л╨╡ ╤Г╤З╨╡╨╜╨╕╨║╨╕ ╤Г╨┤╨░╨╗╨╡╨╜╤Л" });
      setSelectedIds([]);
      await load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "╨Ю╤И╨╕╨▒╨║╨░", description: e.message });
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
    setForm({ full_name: s.full_name, phone: s.phone ? formatPhone(s.phone) : "", parent_phone: s.parent_phone ? formatPhone(s.parent_phone) : "", parent_name: s.parent_name ?? "", group_id: s.group_id ? String(s.group_id) : "", status: s.status });
    setSheet({ open: true, student: s });
  }

  async function handleSave() {
    if (!form.full_name.trim()) return;
    setSaving(true);
    try {
      const data = { ...form, group_id: form.group_id ? parseInt(form.group_id) : null };
      if (sheet.student) {
        await updateStudent(sheet.student.id, data);
        toast({ title: "╨г╤З╨╡╨╜╨╕╨║ ╨╛╨▒╨╜╨╛╨▓╨╗╤С╨╜", description: form.full_name });
      } else {
        await createStudent(data);
        toast({ title: "╨г╤З╨╡╨╜╨╕╨║ ╨┤╨╛╨▒╨░╨▓╨╗╨╡╨╜", description: form.full_name });
      }
      await load();
      setSheet({ open: false });
    } catch (e: any) {
      toast({ variant: "destructive", title: "╨Ю╤И╨╕╨▒╨║╨░", description: e.message });
    } finally { setSaving(false); }
  }

  async function handleArchive() {
    if (!confirmDel) return;
    setDeleting(true);
    try {
      await archiveStudent(confirmDel.id);
      toast({ title: "╨г╤З╨╡╨╜╨╕╨║ ╨┐╨╡╤А╨╡╨╜╨╡╤Б╨╡╨╜ ╨▓ ╨░╤А╤Е╨╕╨▓" });
      await load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "╨Ю╤И╨╕╨▒╨║╨░", description: e.message });
    } finally { setDeleting(false); setConfirmDel(null); }
  }

  async function handleRestore(s: any) {
    try {
      await updateStudent(s.id, { ...s, status: "active" });
      toast({ title: "╨г╤З╨╡╨╜╨╕╨║ ╨▓╨╛╤Б╤Б╤В╨░╨╜╨╛╨▓╨╗╨╡╨╜ ╨╕╨╖ ╨░╤А╤Е╨╕╨▓╨░" });
      await load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "╨Ю╤И╨╕╨▒╨║╨░", description: e.message });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-48">
          <SearchBar value={search} onChange={setSearch} placeholder="╨Я╨╛╨╕╤Б╨║ ╨┐╨╛ ╨╕╨╝╨╡╨╜╨╕ ╨╕╨╗╨╕ ╤В╨╡╨╗╨╡╤Д╨╛╨╜╤Г" />
        </div>
        <Select value={groupFilter} onValueChange={setGroupFilter}>
          <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">╨Т╤Б╨╡ ╨│╤А╤Г╨┐╨┐╤Л</SelectItem>
            {groups.map((g) => <SelectItem key={g.id} value={String(g.id)}><span className="flex items-center gap-1.5"><GroupPersonAvatar groupName={g.name} avatarUrl={g.avatar_url} size={18} showTooltip={false} />{g.name}</span></SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">╨Т╤Б╨╡ ╤Б╤В╨░╤В╤Г╤Б╤Л</SelectItem>
            <SelectItem value="active">╨Р╨║╤В╨╕╨▓╨╜╤Л╨╡</SelectItem>
            <SelectItem value="archived">╨Р╤А╤Е╨╕╨▓</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="gap-1.5 h-9" onClick={() => setImportModalOpen(true)}>
          <Upload className="h-4 w-4" />╨Ш╨╝╨┐╨╛╤А╤В
        </Button>
        <Button size="sm" className="gap-1.5 h-9" onClick={openCreate}>
          <Plus className="h-4 w-4" />╨Ф╨╛╨▒╨░╨▓╨╕╤В╤М
        </Button>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl border animate-in fade-in slide-in-from-top-2">
          <span className="text-sm font-medium">╨Т╤Л╨▒╤А╨░╨╜╨╛ ╤Г╤З╨╡╨╜╨╕╨║╨╛╨▓: {selectedIds.length}</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setBulkArchiveOpen(true)} className="gap-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50">
              <Archive className="h-4 w-4" /> ╨Т ╨┐╨░╨┐╨║╤Г (╨Р╤А╤Е╨╕╨▓)
            </Button>
            <Button size="sm" variant="outline" onClick={handleBulkDelete} className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive">
              <Trash2 className="h-4 w-4" /> ╨г╨┤╨░╨╗╨╕╤В╤М
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
              <span className="ml-2">╨Т╤Л╨▒╤А╨░╤В╤М ╨▓╤Б╨╡╤Е</span>
            </div>
          )}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/50">
              <GraduationCap className="h-10 w-10 mb-3" />
              <p>╨Э╨╕╤З╨╡╨│╨╛ ╨╜╨╡ ╨╜╨░╨╣╨┤╨╡╨╜╨╛</p>
            </div>
          ) : filtered.map((s) => {
            const grp = groups.find((g) => g.id === s.group_id);
            return (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border hover:border-primary/30 transition-colors group">
                <Checkbox checked={selectedIds.includes(s.id)} onCheckedChange={() => handleToggleSelect(s.id)} />
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 ${avatarColor(s.id)}`}>
                  {s.avatar_url ? <img src={s.avatar_url} className="w-full h-full object-cover rounded-full" alt="avatar" /> : s.full_name.split(" ").map((w: string) => w[0]).slice(0, 2).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-sm leading-none">{s.full_name}</p>
                          {s.status === 'archived' && <Badge variant="secondary" className="text-[9px] px-1.5 bg-muted text-muted-foreground">╨Р╤А╤Е╨╕╨▓</Badge>}
                        </div>
                    {statusBadge(s.status)}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                    {grp && <span className="inline-flex items-center gap-1"><GroupPersonAvatar groupName={grp.name} avatarUrl={grp.avatar_url} size={14} showTooltip={false} />{grp.name}</span>}
                    {s.phone && <span>{s.phone}</span>}
                    {s.parent_phone && <span>╨а╨╛╨┤╨╕╤В╨╡╨╗╤М: {s.parent_phone}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10" onClick={() => openEdit(s)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {s.status === 'archived' ? (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:bg-green-50" onClick={() => handleRestore(s)} title="╨Т╨╛╤Б╤Б╤В╨░╨╜╨╛╨▓╨╕╤В╤М">
                      <Undo2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-amber-100 text-amber-600" onClick={() => setConfirmDel(s)} title="╨Т ╨░╤А╤Е╨╕╨▓">
                      <Archive className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Sheet open={sheet.open} onOpenChange={(o) => !o && setSheet({ open: false })}>
        <SheetContent className="w-full sm:max-w-md flex flex-col">
          <SheetHeader>
            <SheetTitle>{sheet.student ? "╨а╨╡╨┤╨░╨║╤В╨╕╤А╨╛╨▓╨░╤В╤М ╤Г╤З╨╡╨╜╨╕╨║╨░" : "╨Ф╨╛╨▒╨░╨▓╨╕╤В╤М ╤Г╤З╨╡╨╜╨╕╨║╨░"}</SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1 mt-6">
            <div className="space-y-5 pr-1">
              <div className="p-4 bg-muted/40 rounded-xl space-y-4 border border-border/50">
                <h4 className="text-sm font-semibold flex items-center gap-2"><User className="h-4 w-4 text-primary" /> ╨Ю╤Б╨╜╨╛╨▓╨╜╨░╤П ╨╕╨╜╤Д╨╛╤А╨╝╨░╤Ж╨╕╤П</h4>
                <div className="space-y-1">
                  <Label className="text-xs">╨д╨Ш╨Ю *</Label>
                  <Input placeholder="╨д╨░╨╝╨╕╨╗╨╕╤П ╨Ш╨╝╤П ╨Ю╤В╤З╨╡╤Б╤В╨▓╨╛" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="bg-background" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-muted-foreground" />╨в╨╡╨╗╨╡╤Д╨╛╨╜ ╤Г╤З╨╡╨╜╨╕╨║╨░</Label>
                  <Input placeholder="+7 (...)" value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })} className="bg-background" />
                </div>
              </div>

              <div className="p-4 bg-muted/40 rounded-xl space-y-4 border border-border/50">
                <h4 className="text-sm font-semibold flex items-center gap-2"><UsersRound className="h-4 w-4 text-primary" /> ╨а╨╛╨┤╨╕╤В╨╡╨╗╨╕</h4>
                <div className="space-y-1">
                  <Label className="text-xs">╨Ш╨╝╤П ╤А╨╛╨┤╨╕╤В╨╡╨╗╤П</Label>
                  <Input placeholder="╨д╨Ш╨Ю ╤А╨╛╨┤╨╕╤В╨╡╨╗╤П" value={form.parent_name} onChange={(e) => setForm({ ...form, parent_name: e.target.value })} className="bg-background" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-muted-foreground" />╨в╨╡╨╗╨╡╤Д╨╛╨╜ ╤А╨╛╨┤╨╕╤В╨╡╨╗╤П</Label>
                  <Input placeholder="+7 (...)" value={form.parent_phone} onChange={(e) => setForm({ ...form, parent_phone: formatPhone(e.target.value) })} className="bg-background" />
                </div>
              </div>

              <div className="p-4 bg-muted/40 rounded-xl space-y-4 border border-border/50">
                <h4 className="text-sm font-semibold flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> ╨г╤З╨╡╨▒╨░</h4>
                <div className="space-y-1">
                  <Label className="text-xs">╨У╤А╤Г╨┐╨┐╨░</Label>
                  <Select value={form.group_id} onValueChange={(v) => setForm({ ...form, group_id: v })}>
                    <SelectTrigger className="bg-background"><SelectValue placeholder="╨Т╤Л╨▒╤А╨░╤В╤М ╨│╤А╤Г╨┐╨┐╤Г" /></SelectTrigger>
                    <SelectContent>
                      {groups.map((g) => <SelectItem key={g.id} value={String(g.id)}><span className="flex items-center gap-1.5"><GroupPersonAvatar groupName={g.name} avatarUrl={g.avatar_url} size={18} showTooltip={false} />{g.name}</span></SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">╨б╤В╨░╤В╤Г╤Б</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">╨Р╨║╤В╨╕╨▓╨╜╤Л╨╣</SelectItem>
                      <SelectItem value="archived">╨Р╤А╤Е╨╕╨▓</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </ScrollArea>
          <Separator className="my-4" />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setSheet({ open: false })}>╨Ю╤В╨╝╨╡╨╜╨░</Button>
            <Button onClick={handleSave} disabled={!form.full_name.trim() || saving} className="gap-1.5">
              {saving ? "╨б╨╛╤Е╤А╨░╨╜╨╡╨╜╨╕╨╡" : <><Check className="h-4 w-4" />╨б╨╛╤Е╤А╨░╨╜╨╕╤В╤М</>}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!confirmDel}
        title="╨Р╤А╤Е╨╕╨▓╨╕╤А╨╛╨▓╨░╤В╤М ╤Г╤З╨╡╨╜╨╕╨║╨░?"
        description={`${confirmDel?.full_name} ╨▒╤Г╨┤╨╡╤В ╨┐╨╡╤А╨╡╨╜╨╡╤Б╨╡╨╜ ╨▓ ╨░╤А╤Е╨╕╨▓ (╨╛╨╜ ╨╜╨╡ ╨▒╤Г╨┤╨╡╤В ╨╛╤В╨╛╨▒╤А╨░╨╢╨░╤В╤М╤Б╤П ╨▓ ╨░╨║╤В╨╕╨▓╨╜╤Л╤Е ╤Б╨┐╨╕╤Б╨║╨░╤Е).`}
        onConfirm={handleArchive}
        onCancel={() => setConfirmDel(null)}
        loading={deleting}
      />

      <Dialog open={bulkArchiveOpen} onOpenChange={setBulkArchiveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>╨Я╨╡╤А╨╡╨╜╨╛╤Б ╨▓ ╨┐╨░╨┐╨║╤Г (╨Р╤А╤Е╨╕╨▓)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              ╨Т╤Л╨▒╤А╨░╨╜╨╛ ╤Г╤З╨╡╨╜╨╕╨║╨╛╨▓: <strong>{selectedIds.length}</strong>. ╨г╨║╨░╨╢╨╕╤В╨╡ ╨┐╨░╨┐╨║╤Г (╨╜╨░╨┐╤А╨╕╨╝╨╡╤А, "╨Т╤Л╨┐╤Г╤Б╨║ 2026", "╨Ю╤В╤З╨╕╤Б╨╗╨╡╨╜", "╨Я╨╡╤А╨╡╨▓╨╛╨┤"), ╤З╤В╨╛╨▒╤Л ╨┐╨╡╤А╨╡╨╜╨╡╤Б╤В╨╕ ╨╕╤Е ╤В╤Г╨┤╨░ ╨╕ ╤Б╨║╤А╤Л╤В╤М ╨╕╨╖ ╨░╨║╤В╨╕╨▓╨╜╨╛╨│╨╛ ╤Б╨┐╨╕╤Б╨║╨░.
            </p>
            <div className="space-y-2">
              <Label>╨Я╨░╨┐╨║╨░ / ╨Я╤А╨╕╤З╨╕╨╜╨░ ╨░╤А╤Е╨╕╨▓╨░╤Ж╨╕╨╕</Label>
              <Input placeholder="╨Э╨░╨┐╤А╨╕╨╝╨╡╤А: ╨Т╤Л╨┐╤Г╤Б╨║ 2026" value={gradYear} onChange={(e) => setGradYear(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkArchiveOpen(false)}>╨Ю╤В╨╝╨╡╨╜╨░</Button>
            <Button onClick={handleBulkArchive} className="gap-2 bg-amber-600 hover:bg-amber-700">╨Я╨╡╤А╨╡╨╜╨╡╤Б╤В╨╕ ╨▓ ╨░╤А╤Е╨╕╨▓</Button>
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
        toast({ title: "╨У╤А╤Г╨┐╨┐╨░ ╨╛╨▒╨╜╨╛╨▓╨╗╨╡╨╜╨░", description: form.name });
      } else {
        await createGroup(data);
        toast({ title: "╨У╤А╤Г╨┐╨┐╨░ ╤Б╨╛╨╖╨┤╨░╨╜╨░", description: form.name });
      }
      await load();
      setSheet({ open: false });
    } catch (e: any) {
      toast({ variant: "destructive", title: "╨Ю╤И╨╕╨▒╨║╨░", description: e.message });
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirmDel) return;
    setDeleting(true);
    try {
      await deleteGroup(confirmDel.id);
      toast({ title: "╨У╤А╤Г╨┐╨┐╨░ ╨┐╨╡╤А╨╡╨╝╨╡╤Й╨╡╨╜╨░ ╨▓ ╨░╤А╤Е╨╕╨▓" });
      await load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "╨Ю╤И╨╕╨▒╨║╨░", description: e.message });
    } finally { setDeleting(false); setConfirmDel(null); }
  }

  async function handleRestore(g: any) {
    try {
      await updateGroup(g.id, { ...g, status: "active" });
      toast({ title: "╨У╤А╤Г╨┐╨┐╨░ ╨▓╨╛╤Б╤Б╤В╨░╨╜╨╛╨▓╨╗╨╡╨╜╨░ ╨╕╨╖ ╨░╤А╤Е╨╕╨▓╨░" });
      await load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "╨Ю╤И╨╕╨▒╨║╨░", description: e.message });
    }
  }

  const handleToggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };
  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? filtered.map(g => g.id) : []);
  };
  
  const handleBulkArchive = async () => {
    if (!confirm(`╨Т╤Л ╤Г╨▓╨╡╤А╨╡╨╜╤Л, ╤З╤В╨╛ ╤Е╨╛╤В╨╕╤В╨╡ ╨╛╤В╨┐╤А╨░╨▓╨╕╤В╤М ╨▓ ╨░╤А╤Е╨╕╨▓ ${selectedIds.length} ╨│╤А╤Г╨┐╨┐?`)) return;
    try {
      for (const id of selectedIds) await deleteGroup(id);
      toast({ title: "╨г╤Б╨┐╨╡╤Е", description: `╨У╤А╤Г╨┐╨┐ ╨╛╤В╨┐╤А╨░╨▓╨╗╨╡╨╜╨╛ ╨▓ ╨░╤А╤Е╨╕╨▓: ${selectedIds.length}` });
      setSelectedIds([]);
      await load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "╨Ю╤И╨╕╨▒╨║╨░", description: e.message });
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm("╨Т╤Л ╤Г╨▓╨╡╤А╨╡╨╜╤Л, ╤З╤В╨╛ ╤Е╨╛╤В╨╕╤В╨╡ ╨Э╨Р╨Т╨б╨Х╨У╨Ф╨Р ╤Г╨┤╨░╨╗╨╕╤В╤М ╨▓╤Л╨▒╤А╨░╨╜╨╜╤Л╨╡ ╨│╤А╤Г╨┐╨┐╤Л?")) return;
    try {
      for (const id of selectedIds) await hardDeleteGroup(id);
      toast({ title: "╨г╨┤╨░╨╗╨╡╨╜╨╛", description: "╨Т╤Л╨▒╤А╨░╨╜╨╜╤Л╨╡ ╨│╤А╤Г╨┐╨┐╤Л ╤Г╨┤╨░╨╗╨╡╨╜╤Л ╨╜╨░╨▓╤Б╨╡╨│╨┤╨░" });
      setSelectedIds([]);
      await load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "╨Ю╤И╨╕╨▒╨║╨░", description: e.message });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-48">
          <SearchBar value={search} onChange={setSearch} placeholder="╨Я╨╛╨╕╤Б╨║ ╨┐╨╛ ╨╜╨░╨╖╨▓╨░╨╜╨╕╤О ╨╕╨╗╨╕ ╨║╤Г╤А╨░╤В╨╛╤А╤Г" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">╨Т╤Б╨╡ ╤Б╤В╨░╤В╤Г╤Б╤Л</SelectItem>
            <SelectItem value="active">╨Р╨║╤В╨╕╨▓╨╜╤Л╨╡</SelectItem>
            <SelectItem value="archived">╨Т ╨░╤А╤Е╨╕╨▓╨╡</SelectItem>
          </SelectContent>
        </Select>
        {selectedIds.length > 0 && (
          <>
            <Button size="sm" variant="outline" className="h-9 gap-1.5 border-destructive text-destructive hover:bg-destructive hover:text-white" onClick={handleBulkDelete}>
              <Trash2 className="h-4 w-4" />╨г╨┤╨░╨╗╨╕╤В╤М ({selectedIds.length})
            </Button>
            <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={handleBulkArchive}>
              <Archive className="h-4 w-4" />╨Т ╨░╤А╤Е╨╕╨▓ ({selectedIds.length})
            </Button>
          </>
        )}
        <Button size="sm" className="gap-1.5 h-9" onClick={openCreate}>
          <Plus className="h-4 w-4" />╨Ф╨╛╨▒╨░╨▓╨╕╤В╤М
        </Button>
      </div>

      {filtered.length > 0 && !loading && (
        <div className="flex items-center gap-2 px-1 mb-2 mt-4">
          <Checkbox 
            checked={selectedIds.length > 0 && selectedIds.length === filtered.length} 
            onCheckedChange={handleSelectAll} 
          />
          <span className="text-xs text-muted-foreground cursor-pointer select-none" onClick={() => handleSelectAll(selectedIds.length !== filtered.length)}>╨Т╤Л╨▒╤А╨░╤В╤М ╨▓╤Б╨╡</span>
        </div>
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-muted-foreground/50">
              <Building2 className="h-10 w-10 mb-3" />
              <p>╨Э╨╕╤З╨╡╨│╨╛ ╨╜╨╡ ╨╜╨░╨╣╨┤╨╡╨╜╨╛</p>
            </div>
          ) : filtered.map((g) => {
            const curator = g.curator_id ? users.find((u) => u.id === g.curator_id) : null;
            return (
              <Card key={g.id} className={`border hover:border-primary/40 hover:shadow-md transition-all group cursor-pointer ${selectedIds.includes(g.id) ? 'ring-2 ring-primary border-primary' : ''}`} onClick={() => openEdit(g)}>
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
                        {g.status === 'archived' && <Badge variant="secondary" className="text-[9px] px-1.5 bg-muted text-muted-foreground">╨Р╤А╤Е╨╕╨▓</Badge>}
                      </div>
                      <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(g)}><Pencil className="h-3 w-3" /></Button>
                        {g.status === 'archived' ? (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={() => handleRestore(g)} title="╨Т╨╛╤Б╤Б╤В╨░╨╜╨╛╨▓╨╕╤В╤М"><Undo2 className="h-3 w-3" /></Button>
                        ) : (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setConfirmDel(g)} title="╨Т ╨░╤А╤Е╨╕╨▓"><Trash2 className="h-3 w-3" /></Button>
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
                        ) : <span className="text-xs text-muted-foreground/50">╨Ъ╤Г╤А╨░╤В╨╛╤А ╨╜╨╡ ╨╜╨░╨╖╨╜╨░╤З╨╡╨╜</span>}
                      </div>
                      <Badge variant="outline" className="text-[10px]">{g.students_count ?? 0} ╤Г╤З.</Badge>
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
            <SheetTitle>{sheet.group ? "╨а╨╡╨┤╨░╨║╤В╨╕╤А╨╛╨▓╨░╤В╤М ╨│╤А╤Г╨┐╨┐╤Г" : "╨б╨╛╨╖╨┤╨░╤В╤М ╨│╤А╤Г╨┐╨┐╤Г"}</SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1 mt-6">
            <div className="space-y-4 pr-1">
              <div className="space-y-1">
                <Label className="text-xs">╨Э╨░╨╖╨▓╨░╨╜╨╕╨╡ ╨│╤А╤Г╨┐╨┐╤Л *</Label>
                <Input placeholder="╨Э╨░╨┐╤А╨╕╨╝╨╡╤А: 11 ╨д╨Ь-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs">╨б╤Б╤Л╨╗╨║╨░ ╨╜╨░ ╨╗╨╛╨│╨╛╤В╨╕╨┐ (URL)</Label>
                <Input value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} placeholder="https://example.com/logo.png" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">╨Я╤А╨╛╤Д╨╕╨╗╤М</Label>
                <Select value={form.profile_id} onValueChange={(v) => setForm({ ...form, profile_id: v })}>
                  <SelectTrigger><SelectValue placeholder="╨Т╤Л╨▒╤А╨░╤В╤М ╨┐╤А╨╛╤Д╨╕╨╗╤М" /></SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">╨Ъ╤Г╤А╨░╤В╨╛╤А</Label>
                <div className="border rounded-lg overflow-hidden">
                  <div className="p-2 border-b bg-muted/30">
                    <p className="text-xs text-muted-foreground">╨Т╤Л╨▒╨╡╤А╨╕╤В╨╡ ╨║╤Г╤А╨░╤В╨╛╤А╨░ ╨╕╨╖ ╤Б╨┐╨╕╤Б╨║╨░</p>
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
            <Button variant="outline" onClick={() => setSheet({ open: false })}>╨Ю╤В╨╝╨╡╨╜╨░</Button>
            <Button onClick={handleSave} disabled={!form.name.trim() || saving} className="gap-1.5">
              {saving ? "╨б╨╛╤Е╤А╨░╨╜╨╡╨╜╨╕╨╡" : <><Check className="h-4 w-4" />╨б╨╛╤Е╤А╨░╨╜╨╕╤В╤М</>}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!confirmDel}
        title="╨г╨┤╨░╨╗╨╕╤В╤М ╨│╤А╤Г╨┐╨┐╤Г?"
        description={`╨У╤А╤Г╨┐╨┐╨░ ${confirmDel?.name} ╨▒╤Г╨┤╨╡╤В ╤Г╨┤╨░╨╗╨╡╨╜╨░. ╨г╤З╨╡╨╜╨╕╨║╨╕, ╨┐╤А╨╕╨║╤А╨╡╨┐╨╗╤С╨╜╨╜╤Л╨╡ ╨║ ╨╜╨╡╨╣, ╨╛╤Б╤В╨░╨╜╤Г╤В╤Б╤П ╨▓ ╤Б╨╕╤Б╤В╨╡╨╝╨╡.`}
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
const SUBJECT_TYPE_LABELS: Record<string, string> = { mandatory: "╨Ю╨▒╤П╨╖╨░╤В╨╡╨╗╤М╨╜╤Л╨╣", elective: "╨н╨╗╨╡╨║╤В╨╕╨▓╨╜╤Л╨╣", extra: "╨Ф╨╛╨┐." };
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
        toast({ title: "╨Я╤А╨╡╨┤╨╝╨╡╤В ╨╛╨▒╨╜╨╛╨▓╨╗╤С╨╜", description: form.name });
      } else {
        await createSubject(form);
        toast({ title: "╨Я╤А╨╡╨┤╨╝╨╡╤В ╨┤╨╛╨▒╨░╨▓╨╗╨╡╨╜", description: form.name });
      }
      await load();
      setSheet({ open: false });
    } catch (e: any) {
      toast({ variant: "destructive", title: "╨Ю╤И╨╕╨▒╨║╨░", description: e.message });
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirmDel) return;
    setDeleting(true);
    try {
      await deleteSubject(confirmDel.id);
      toast({ title: "╨Я╤А╨╡╨┤╨╝╨╡╤В ╤Г╨┤╨░╨╗╤С╨╜" });
      await load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "╨Ю╤И╨╕╨▒╨║╨░", description: e.message });
    } finally { setDeleting(false); setConfirmDel(null); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <SearchBar value={search} onChange={setSearch} placeholder="╨Я╨╛╨╕╤Б╨║ ╨┐╨╛ ╨╜╨░╨╖╨▓╨░╨╜╨╕╤О ╨┐╤А╨╡╨┤╨╝╨╡╤В╨░" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">╨Т╤Б╨╡ ╤В╨╕╨┐╤Л</SelectItem>
            {SUBJECT_TYPES.map((t) => <SelectItem key={t} value={t}>{SUBJECT_TYPE_LABELS[t]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" className="gap-1.5 h-9" onClick={openCreate}>
          <Plus className="h-4 w-4" />╨Ф╨╛╨▒╨░╨▓╨╕╤В╤М
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
      ) : (
        <div className="space-y-1.5">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/50">
              <BookOpen className="h-10 w-10 mb-3" />
              <p>╨Э╨╕╤З╨╡╨│╨╛ ╨╜╨╡ ╨╜╨░╨╣╨┤╨╡╨╜╨╛</p>
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
            <SheetTitle>{sheet.subject ? "╨а╨╡╨┤╨░╨║╤В╨╕╤А╨╛╨▓╨░╤В╤М ╨┐╤А╨╡╨┤╨╝╨╡╤В" : "╨Ф╨╛╨▒╨░╨▓╨╕╤В╤М ╨┐╤А╨╡╨┤╨╝╨╡╤В"}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6 flex-1">
            <div className="space-y-1">
              <Label className="text-xs">╨Э╨░╨╖╨▓╨░╨╜╨╕╨╡ *</Label>
              <Input placeholder="╨Р╨╗╨│╨╡╨▒╤А╨░, ╨д╨╕╨╖╨╕╨║╨░" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">╨в╨╕╨┐</Label>
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
            <Button variant="outline" onClick={() => setSheet({ open: false })}>╨Ю╤В╨╝╨╡╨╜╨░</Button>
            <Button onClick={handleSave} disabled={!form.name.trim() || saving} className="gap-1.5">
              {saving ? "╨б╨╛╤Е╤А╨░╨╜╨╡╨╜╨╕╨╡" : <><Check className="h-4 w-4" />╨б╨╛╤Е╤А╨░╨╜╨╕╤В╤М</>}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!confirmDel}
        title="╨г╨┤╨░╨╗╨╕╤В╤М ╨┐╤А╨╡╨┤╨╝╨╡╤В?"
        description={`${confirmDel?.name} ╨▒╤Г╨┤╨╡╤В ╤Г╨┤╨░╨╗╤С╨╜ ╨╕╨╖ ╤Б╨╕╤Б╤В╨╡╨╝╤Л.`}
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
            <StatCard icon={Users} label="╨г╤Б╤В╨░╨╖╨╛╨▓" value={teacherCount} sub="╨┐╤А╨╡╨┐╨╛╨┤╨░╨▓╨░╤В╨╡╨╗╨╡╨╣" color="bg-gradient-to-br from-violet-500 to-indigo-600" />
            <StatCard icon={GraduationCap} label="╨Р╨║╤В╨╕╨▓╨╜╤Л╤Е ╤Г╤З╨╡╨╜╨╕╨║╨╛╨▓" value={activeStudents} sub={`╨╕╨╖ ${students.length} ╨▓╤Б╨╡╨│╨╛`} color="bg-gradient-to-br from-emerald-500 to-teal-600" />
            <StatCard icon={Building2} label="╨У╤А╤Г╨┐╨┐" value={groups.length} sub="╤Г╤З╨╡╨▒╨╜╤Л╤Е ╨│╤А╤Г╨┐╨┐" color="bg-gradient-to-br from-blue-500 to-cyan-600" />
            <StatCard icon={BookOpen} label="╨Я╤А╨╡╨┤╨╝╨╡╤В╨╛╨▓" value={subjects.length} sub="╨▓ ╤Г╤З╨╡╨▒╨╜╨╛╨╝ ╨┐╨╗╨░╨╜╨╡" color="bg-gradient-to-br from-amber-500 to-orange-600" />
          </>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="users">
        <div className="overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0">
        <TabsList className="h-10 p-1 bg-muted/60 rounded-xl gap-1 w-max md:w-auto">
          <TabsTrigger value="users" className="rounded-lg gap-1.5 text-xs md:text-sm">
            <UsersRound className="h-4 w-4" /><span className="hidden sm:inline">╨г╤Б╤В╨░╨╖╤Л</span>
          </TabsTrigger>
          <TabsTrigger value="students" className="rounded-lg gap-1.5 text-xs md:text-sm">
            <GraduationCap className="h-4 w-4" /><span className="hidden sm:inline">╨г╤З╨╡╨╜╨╕╨║╨╕</span>
          </TabsTrigger>
          <TabsTrigger value="groups" className="rounded-lg gap-1.5 text-xs md:text-sm">
            <Building2 className="h-4 w-4" /><span className="hidden sm:inline">╨У╤А╤Г╨┐╨┐╤Л</span>
          </TabsTrigger>
          <TabsTrigger value="subjects" className="rounded-lg gap-1.5 text-xs md:text-sm">
            <BookOpen className="h-4 w-4" /><span className="hidden sm:inline">╨Я╤А╨╡╨┤╨╝╨╡╤В╤Л</span>
          </TabsTrigger>
          <TabsTrigger value="schedule" className="rounded-lg gap-1.5 text-xs md:text-sm">
            <CalendarDays className="h-4 w-4" /><span className="hidden sm:inline">╨а╨░╤Б╨┐╨╕╤Б╨░╨╜╨╕╨╡</span>
          </TabsTrigger>
          <TabsTrigger value="banners" className="rounded-lg gap-1.5 text-xs md:text-sm">
            <Megaphone className="h-4 w-4" /><span className="hidden sm:inline">╨С╨░╨╜╨╜╨╡╤А╤Л</span>
          </TabsTrigger>
          <TabsTrigger value="health" className="rounded-lg gap-1.5 text-xs md:text-sm">
            <Activity className="h-4 w-4" /><span className="hidden sm:inline">╨Ч╨┤╨╛╤А╨╛╨▓╤М╨╡</span>
          </TabsTrigger>
          <TabsTrigger value="audit" className="rounded-lg gap-1.5 text-xs md:text-sm">
            <ScrollText className="h-4 w-4" /><span className="hidden sm:inline">╨Р╤Г╨┤╨╕╤В</span>
          </TabsTrigger>
          <TabsTrigger value="permissions" className="rounded-lg gap-1.5 text-xs md:text-sm">
            <Shield className="h-4 w-4" /><span className="hidden sm:inline">╨Я╤А╨░╨▓╨░</span>
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
  if (d) parts.push(`${d}╨┤`);
  if (h) parts.push(`${h}╤З`);
  if (m) parts.push(`${m}╨╝`);
  if (!parts.length) parts.push(`${s}╤Б`);
  return parts.join(" ");
}

function fmtBytes(bytes: number) {
  if (bytes < 1024) return bytes + " ╨С";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " ╨Ъ╨С";
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " ╨Ь╨С";
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " ╨У╨С";
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
      setError(e.message || "╨Ю╤И╨╕╨▒╨║╨░");
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
        <Button variant="outline" className="mt-3" onClick={load}><RefreshCw className="h-4 w-4 mr-2" />╨Ю╨▒╨╜╨╛╨▓╨╕╤В╤М</Button>
      </div>
    );
  }

  const mem = health.memory || {};
  const heapPercent = mem.heapTotal ? Math.round((mem.heapUsed / mem.heapTotal) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2"><Activity className="h-5 w-5 text-primary" />╨Ь╨╛╨╜╨╕╤В╨╛╤А╨╕╨╜╨│ ╤Б╨╕╤Б╤В╨╡╨╝╤Л</h3>
        <Button variant="outline" size="sm" onClick={load} className="gap-1.5"><RefreshCw className="h-3.5 w-3.5" />╨Ю╨▒╨╜╨╛╨▓╨╕╤В╤М</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Status */}
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <CircleCheck className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">╨б╤В╨░╤В╤Г╤Б</p>
              <p className="text-lg font-bold text-emerald-600">╨а╨░╨▒╨╛╤В╨░╨╡╤В</p>
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
              <p className="text-xs text-muted-foreground">╨Р╨┐╤В╨░╨╣╨╝</p>
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
              <p className="text-xs text-muted-foreground">╨Ю╤В╨║╨╗╨╕╨║ ╨С╨Ф</p>
              <p className="text-lg font-bold">{health.db_response_ms} ╨╝╤Б</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{health.db_response_ms < 5 ? "╨Ю╤В╨╗╨╕╤З╨╜╨╛" : health.db_response_ms < 20 ? "╨Э╨╛╤А╨╝╨░╨╗╤М╨╜╨╛" : "╨Ь╨╡╨┤╨╗╨╡╨╜╨╜╨╛"}</p>
        </CardContent></Card>

        {/* Disk: DB */}
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <HardDrive className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">╨а╨░╨╖╨╝╨╡╤А ╨С╨Ф</p>
              <p className="text-lg font-bold">{fmtBytes(health.db_size_bytes)}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">╨д╨░╨╣╨╗╤Л: {fmtBytes(health.uploads_size_bytes)} ┬╖ ╨Т╤Б╨╡╨│╨╛: {fmtBytes(health.total_size_bytes)}</p>
        </CardContent></Card>

        {/* Memory */}
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
              <Cpu className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">╨Я╨░╨╝╤П╤В╤М (Heap)</p>
              <p className="text-lg font-bold">{fmtBytes(mem.heapUsed)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2"><Progress value={heapPercent} className="h-1.5 flex-1" /><span className="text-xs text-muted-foreground">{heapPercent}%</span></div>
          <p className="text-xs text-muted-foreground mt-1">╨Т╤Б╨╡╨│╨╛: {fmtBytes(mem.heapTotal)} ┬╖ RSS: {fmtBytes(mem.rss)}</p>
        </CardContent></Card>

        {/* Counts */}
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-cyan-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">╨Ч╨░╨┐╨╕╤Б╨╕</p>
              <p className="text-lg font-bold">{health.user_count + health.student_count}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">╨б╨╛╤В╤А╤Г╨┤╨╜╨╕╨║╨╕: {health.user_count} ┬╖ ╨г╤З╨╡╨╜╨╕╨║╨╕: {health.student_count}</p>
        </CardContent></Card>
      </div>
    </div>
  );
}

/* ====================== BANNERS TAB ====================== */

const BANNER_TYPE_CONFIG: Record<string, { label: string; color: string; icon: typeof Info }> = {
  info: { label: "╨Ш╨╜╤Д╨╛", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", icon: Info },
  warning: { label: "╨Т╨╜╨╕╨╝╨░╨╜╨╕╨╡", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", icon: AlertTriangle },
  danger: { label: "╨Ъ╤А╨╕╤В╨╕╤З╨╡╤Б╨║╨╕╨╣", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300", icon: AlertCircle },
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
      toast({ title: "╨С╨░╨╜╨╜╨╡╤А ╤Б╨╛╨╖╨┤╨░╨╜" });
      setText(""); setType("info"); setExpiresAt(""); setShowCreate(false);
      load();
    } catch {
      toast({ title: "╨Ю╤И╨╕╨▒╨║╨░ ╤Б╨╛╨╖╨┤╨░╨╜╨╕╤П ╨▒╨░╨╜╨╜╨╡╤А╨░", variant: "destructive" });
    }
  };

  const handleToggle = async (banner: any) => {
    await updateBanner(banner.id, { is_active: banner.is_active ? 0 : 1 });
    toast({ title: banner.is_active ? "╨С╨░╨╜╨╜╨╡╤А ╨╛╤В╨║╨╗╤О╤З╤С╨╜" : "╨С╨░╨╜╨╜╨╡╤А ╨▓╨║╨╗╤О╤З╤С╨╜" });
    load();
  };

  const handleDeleteBanner = async (id: number) => {
    await deleteBanner(id);
    toast({ title: "╨С╨░╨╜╨╜╨╡╤А ╤Г╨┤╨░╨╗╤С╨╜" });
    load();
  };

  const handleEdit = async () => {
    if (!editBanner || !text.trim()) return;
    await updateBanner(editBanner.id, { text: text.trim(), type, expires_at: expiresAt || undefined });
    toast({ title: "╨С╨░╨╜╨╜╨╡╤А ╨╛╨▒╨╜╨╛╨▓╨╗╤С╨╜" });
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
          <h3 className="text-lg font-semibold">╨Ш╨╜╤Д╨╛╤А╨╝╨░╤Ж╨╕╨╛╨╜╨╜╤Л╨╡ ╨▒╨░╨╜╨╜╨╡╤А╤Л</h3>
          <p className="text-sm text-muted-foreground">╨С╨╡╨│╤Г╤Й╨░╤П ╤Б╤В╤А╨╛╨║╨░ ╨▓╨▓╨╡╤А╤Е╤Г ╤Н╨║╤А╨░╨╜╨░ ╨┤╨╗╤П ╨▓╤Б╨╡╤Е ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╨╡╨╣</p>
        </div>
        <Button className="gap-1.5" onClick={() => { setShowCreate(true); setText(""); setType("info"); setExpiresAt(""); }}>
          <Plus className="h-4 w-4" /> ╨Э╨╛╨▓╤Л╨╣ ╨▒╨░╨╜╨╜╨╡╤А
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : banners.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>╨Э╨╡╤В ╨▒╨░╨╜╨╜╨╡╤А╨╛╨▓</p>
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
                      <span>{banner.is_active ? "╨Р╨║╤В╨╕╨▓╨╜╤Л╨╣" : "╨Ю╤В╨║╨╗╤О╤З╤С╨╜"}</span>
                      {banner.expires_at && <span>╨┤╨╛ {new Date(banner.expires_at).toLocaleDateString(locale)}</span>}
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
              <DialogTitle>{editBanner ? "╨а╨╡╨┤╨░╨║╤В╨╕╤А╨╛╨▓╨░╤В╤М ╨▒╨░╨╜╨╜╨╡╤А" : "╨Э╨╛╨▓╤Л╨╣ ╨▒╨░╨╜╨╜╨╡╤А"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label className="mb-1">╨в╨╡╨║╤Б╤В ╨▒╨░╨╜╨╜╨╡╤А╨░ *</Label>
                <Input value={text} onChange={e => setText(e.target.value)} placeholder="╨в╨╡╨║╤Б╤В ╨╛╨▒╤К╤П╨▓╨╗╨╡╨╜╨╕╤П..." />
              </div>
              <div>
                <Label className="mb-1">╨в╨╕╨┐</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">ЁЯФ╡ ╨Ш╨╜╤Д╨╛╤А╨╝╨░╤Ж╨╕╤П</SelectItem>
                    <SelectItem value="warning">ЁЯЯб ╨Я╤А╨╡╨┤╤Г╨┐╤А╨╡╨╢╨┤╨╡╨╜╨╕╨╡</SelectItem>
                    <SelectItem value="danger">ЁЯФ┤ ╨Ъ╤А╨╕╤В╨╕╤З╨╡╤Б╨║╨╕╨╣</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1">╨б╤А╨╛╨║ ╨┤╨╡╨╣╤Б╤В╨▓╨╕╤П (╨╜╨╡╨╛╨▒╤П╨╖╨░╤В╨╡╨╗╤М╨╜╨╛)</Label>
                <Input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowCreate(false); setEditBanner(null); }}>╨Ю╤В╨╝╨╡╨╜╨░</Button>
              <Button onClick={editBanner ? handleEdit : handleCreate} disabled={!text.trim()}>
                {editBanner ? "╨б╨╛╤Е╤А╨░╨╜╨╕╤В╤М" : "╨б╨╛╨╖╨┤╨░╤В╤М"}
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
  login: { label: "╨Т╤Е╨╛╨┤", color: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  create: { label: "╨б╨╛╨╖╨┤╨░╨╜╨╕╨╡", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  update: { label: "╨Ш╨╖╨╝╨╡╨╜╨╡╨╜╨╕╨╡", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  delete: { label: "╨г╨┤╨░╨╗╨╡╨╜╨╕╨╡", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
};

const ENTITY_LABELS: Record<string, string> = {
  user: "╨Я╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤М",
  student: "╨г╤З╨╡╨╜╨╕╨║",
  group: "╨У╤А╤Г╨┐╨┐╨░",
  subject: "╨Я╤А╨╡╨┤╨╝╨╡╤В",
  schedule: "╨а╨░╤Б╨┐╨╕╤Б╨░╨╜╨╕╨╡",
  task: "╨Ч╨░╨┤╨░╤З╨░",
  wiki_category: "╨Ъ╨░╤В╨╡╨│╨╛╤А╨╕╤П Wiki",
  wiki_article: "╨б╤В╨░╤В╤М╤П Wiki",
  dynamic_table: "╨в╨░╨▒╨╗╨╕╤Ж╨░",
  banner: "╨С╨░╨╜╨╜╨╡╤А",
  broadcast: "╨Ю╨▒╤К╤П╨▓╨╗╨╡╨╜╨╕╨╡",
  storage_folder: "╨Я╨░╨┐╨║╨░",
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
          <Input placeholder="╨Я╨╛╨╕╤Б╨║..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={filterAction} onValueChange={v => setFilterAction(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="╨Ф╨╡╨╣╤Б╤В╨▓╨╕╨╡" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">╨Т╤Б╨╡ ╨┤╨╡╨╣╤Б╤В╨▓╨╕╤П</SelectItem>
            <SelectItem value="login">╨Т╤Е╨╛╨┤</SelectItem>
            <SelectItem value="create">╨б╨╛╨╖╨┤╨░╨╜╨╕╨╡</SelectItem>
            <SelectItem value="update">╨Ш╨╖╨╝╨╡╨╜╨╡╨╜╨╕╨╡</SelectItem>
            <SelectItem value="delete">╨г╨┤╨░╨╗╨╡╨╜╨╕╨╡</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterEntity} onValueChange={v => setFilterEntity(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="╨в╨╕╨┐ ╨╛╨▒╤К╨╡╨║╤В╨░" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">╨Т╤Б╨╡ ╤В╨╕╨┐╤Л</SelectItem>
            {Object.entries(ENTITY_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={load} className="h-9">
          <RefreshCw className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">{total} ╨╖╨░╨┐╨╕╤Б╨╡╨╣</span>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left p-2 font-medium">╨Т╤А╨╡╨╝╤П</th>
              <th className="text-left p-2 font-medium">╨Я╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤М</th>
              <th className="text-left p-2 font-medium">╨Ф╨╡╨╣╤Б╤В╨▓╨╕╨╡</th>
              <th className="text-left p-2 font-medium hidden md:table-cell">╨в╨╕╨┐</th>
              <th className="text-left p-2 font-medium">╨Ю╨▒╤К╨╡╨║╤В</th>
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
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">╨Э╨╡╤В ╨╖╨░╨┐╨╕╤Б╨╡╨╣</td></tr>
            ) : (
              logs.map(log => {
                const act = ACTION_LABELS[log.action] || { label: log.action, color: "bg-gray-100 text-gray-700" };
                return (
                  <tr key={log.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-2 text-xs whitespace-nowrap text-muted-foreground">{fmtDate(log.created_at)}</td>
                    <td className="p-2 whitespace-nowrap">{log.user_name || "тАФ"}</td>
                    <td className="p-2">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${act.color}`}>{act.label}</span>
                    </td>
                    <td className="p-2 hidden md:table-cell text-xs text-muted-foreground">
                      {ENTITY_LABELS[log.entity_type] || log.entity_type || "тАФ"}
                    </td>
                    <td className="p-2 max-w-[200px] truncate">{log.entity_name || "тАФ"}</td>
                    <td className="p-2 hidden lg:table-cell text-xs text-muted-foreground font-mono">{log.ip || "тАФ"}</td>
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
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>тЖР</Button>
          <span className="text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>тЖТ</Button>
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
      toast({ title: "╨Я╤А╨░╨▓╨░ ╨╛╨▒╨╜╨╛╨▓╨╗╨╡╨╜╤Л" });
      load();
    } catch {
      toast({ title: "╨Ю╤И╨╕╨▒╨║╨░", variant: "destructive" });
    } finally { setSaving(null); }
  };

  const roleLabelMap: Record<string, string> = {
    admin: "╨Р╨┤╨╝╨╕╨╜",
    umo_head: "╨Ч╨░╨▓╤Г╤З (╨г╨Ь╨Ю)",
    teacher: "╨Я╤А╨╡╨┐╨╛╨┤╨░╨▓╨░╤В╨╡╨╗╤М",
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
        <h3 className="text-lg font-semibold">╨г╨┐╤А╨░╨▓╨╗╨╡╨╜╨╕╨╡ ╨┐╤А╨░╨▓╨░╨╝╨╕ ╨┤╨╛╤Б╤В╤Г╨┐╨░</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        ╨Э╨░╤Б╤В╤А╨╛╨╣╤В╨╡, ╨║╨░╨║╨╕╨╡ ╨┤╨╡╨╣╤Б╤В╨▓╨╕╤П ╨┤╨╛╤Б╤В╤Г╨┐╨╜╤Л ╨┤╨╗╤П ╨║╨░╨╢╨┤╨╛╨╣ ╤А╨╛╨╗╨╕. ╨Ш╨╖╨╝╨╡╨╜╨╡╨╜╨╕╤П ╨▓╤Б╤В╤Г╨┐╨░╤О╤В ╨▓ ╤Б╨╕╨╗╤Г ╨┐╤А╨╕ ╤Б╨╗╨╡╨┤╤Г╤О╤Й╨╡╨╝ ╨▓╤Е╨╛╨┤╨╡ ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤П.
      </p>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left p-3 font-medium min-w-[200px]">╨а╨░╨╖╤А╨╡╤И╨╡╨╜╨╕╨╡</th>
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
            {saving === role.id ? "╨б╨╛╤Е╤А╨░╨╜╨╡╨╜╨╕╨╡..." : `╨б╨╛╤Е╤А╨░╨╜╨╕╤В╤М ${roleLabelMap[role.name] || role.name}`}
          </Button>
        ))}
      </div>
    </div>
  );
}
