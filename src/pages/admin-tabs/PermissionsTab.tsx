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

export default PermissionsTab;
