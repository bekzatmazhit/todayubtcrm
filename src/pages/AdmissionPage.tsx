import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  GraduationCap, Building2, BookMarked, Plus, Edit2, Trash2,
  ExternalLink, Trophy, TrendingUp, TrendingDown,
  Search, ChevronUp, ChevronDown, ChevronsUpDown, Users,
  Upload, Download, Settings2, Type, Hash, CheckSquare,
} from "lucide-react";
import { GroupPersonAvatar } from "@/components/GroupPersonAvatar";

const API = (import.meta as any).env?.VITE_API_URL || "/api";

// ── Types ──────────────────────────────────────────────────────────────────

interface University { id: number; name: string; city: string | null; website: string | null; logo_url: string | null; }
interface Specialty { id: number; code: string; name: string; profile_subjects: string | null; }
interface PassingScore { id: number; university_id: number; specialty_id: number; year: number; grant_score: number | null; paid_score: number | null; university_name?: string; specialty_name?: string; specialty_code?: string; }
interface TrackerRow {
  id: number; full_name: string; group_id: number; group_name: string;
  target_university_id: number | null; target_specialty_id: number | null;
  unt_january_score: number | null; unt_march_score: number | null;
  unt_grant_1_score: number | null; unt_grant_2_score: number | null;
  university_name: string | null; university_logo_url: string | null;
  specialty_name: string | null; specialty_code: string | null;
  grant_score: number | null; paid_score: number | null;
}
interface CustomColumn { id: number; name: string; type: "checkbox" | "text" | "number"; position: number; }
interface CustomValue  { id: number; student_id: number; column_id: number; value: string | null; }

// ── API helpers ────────────────────────────────────────────────────────────

const get  = (path: string) => fetch(`${API}${path}`).then(r => r.ok ? r.json() : Promise.reject(`${r.status} ${r.url}`));
const post = (path: string, body: object) => fetch(`${API}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json());
const put  = (path: string, body: object) => fetch(`${API}${path}`, { method: "PUT",  headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json());
const del  = (path: string) => fetch(`${API}${path}`, { method: "DELETE" }).then(r => r.json());
const patch = (path: string, body: object) => fetch(`${API}${path}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json());

// ── University logo ────────────────────────────────────────────────────────

function UniLogo({ url, name, size = 24 }: { url: string | null; name: string | null; size?: number }) {
  const [err, setErr] = useState(false);
  if (!url || err) {
    return (
      <div style={{ width: size, height: size }}
        className="rounded bg-primary/10 flex items-center justify-center shrink-0">
        <Building2 className="text-primary/50" style={{ width: size * 0.55, height: size * 0.55 }} />
      </div>
    );
  }
  return <img src={url} alt={name ?? ""} onError={() => setErr(true)}
    className="rounded object-contain shrink-0" style={{ width: size, height: size }} />;
}

// ── Student row editor dialog ──────────────────────────────────────────────

function StudentTargetDialog({
  row, universities, specialties, passingScores, open, onClose, onSaved,
}: {
  row: TrackerRow;
  universities: University[];
  specialties: Specialty[];
  passingScores: PassingScore[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    target_university_id: row.target_university_id ? String(row.target_university_id) : "",
    target_specialty_id:  row.target_specialty_id  ? String(row.target_specialty_id)  : "",
  });
  const [saving, setSaving] = useState(false);

  const selectedPS = passingScores.find(
    ps => String(ps.university_id) === form.target_university_id &&
          String(ps.specialty_id)  === form.target_specialty_id
  );
  const selectedUni = universities.find(u => String(u.id) === form.target_university_id);

  const handleSave = async () => {
    setSaving(true);
    await patch(`/students/${row.id}/admission`, {
      target_university_id: form.target_university_id ? parseInt(form.target_university_id) : null,
      target_specialty_id:  form.target_specialty_id  ? parseInt(form.target_specialty_id)  : null,
    });
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            {row.full_name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <p className="text-xs text-muted-foreground">Баллы подтягиваются автоматически из Результатов ЕНТ.</p>
          <div className="space-y-1">
            <Label className="text-xs font-medium">Целевой ВУЗ</Label>
            <Select value={form.target_university_id || "__none__"} onValueChange={v => setForm(p => ({ ...p, target_university_id: v === "__none__" ? "" : v, target_specialty_id: "" }))}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Не выбран" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— не выбран —</SelectItem>
                {universities.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}{u.city ? ` · ${u.city}` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {selectedUni && (
            <div className="flex items-center gap-2.5 px-2 py-1.5 rounded bg-muted/40">
              <UniLogo url={selectedUni.logo_url} name={selectedUni.name} size={32} />
              <div>
                <p className="text-sm font-medium">{selectedUni.name}</p>
                {selectedUni.city && <p className="text-xs text-muted-foreground">{selectedUni.city}</p>}
              </div>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs font-medium">Специальность</Label>
            <Select value={form.target_specialty_id || "__none__"} onValueChange={v => setForm(p => ({ ...p, target_specialty_id: v === "__none__" ? "" : v }))}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Не выбрана" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— не выбрана —</SelectItem>
                {specialties.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.code} — {s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {selectedPS && (
            <div className="bg-muted/50 rounded-lg px-3 py-2 text-xs flex gap-4">
              <span>🏆 Грант: <strong className="text-green-600">{selectedPS.grant_score ?? "—"}</strong></span>
              <span>💳 Платное: <strong className="text-blue-600">{selectedPS.paid_score ?? "—"}</strong></span>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={onClose}>Отмена</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Сохранение..." : "Сохранить"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Directory CRUD dialogs ─────────────────────────────────────────────────

function UniversityDialog({ item, onClose, onSaved }: { item: University | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: item?.name ?? "", city: item?.city ?? "", website: item?.website ?? "", logo_url: item?.logo_url ?? "" });
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    setSaving(true);
    if (item) await put(`/universities/${item.id}`, form);
    else await post("/universities", form);
    setSaving(false);
    onSaved();
    onClose();
  };
  const field = (k: keyof typeof form, label: string, placeholder?: string) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} placeholder={placeholder} className="h-8 text-sm" />
    </div>
  );
  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{item ? "Редактировать ВУЗ" : "Добавить ВУЗ"}</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          {field("name", "Название *", "Назарбаев Университет")}
          {field("city", "Город", "Астана")}
          {field("website", "Сайт", "https://nu.edu.kz")}
          {field("logo_url", "URL лого", "https://...")}
          {form.logo_url && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <UniLogo url={form.logo_url} name={form.name} size={32} />
              <span>Предпросмотр лого</span>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={onClose}>Отмена</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !form.name}>{saving ? "..." : "Сохранить"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SpecialtyDialog({ item, onClose, onSaved }: { item: Specialty | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ code: item?.code ?? "", name: item?.name ?? "", profile_subjects: item?.profile_subjects ?? "" });
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    setSaving(true);
    if (item) await put(`/specialties/${item.id}`, form);
    else await post("/specialties", form);
    setSaving(false);
    onSaved();
    onClose();
  };
  const field = (k: keyof typeof form, label: string, placeholder?: string) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} placeholder={placeholder} className="h-8 text-sm" />
    </div>
  );
  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{item ? "Редактировать специальность" : "Добавить специальность"}</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          {field("code", "Шифр *", "B057")}
          {field("name", "Название *", "Информационные системы")}
          {field("profile_subjects", "Профильные предметы", "Математика + Информатика")}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={onClose}>Отмена</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !form.code || !form.name}>{saving ? "..." : "Сохранить"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PassingScoreDialog({
  universities, specialties, onClose, onSaved,
}: { universities: University[]; specialties: Specialty[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ university_id: "", specialty_id: "", year: "2026", grant_score: "", paid_score: "" });
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    setSaving(true);
    await post("/passing-scores", {
      university_id: parseInt(form.university_id),
      specialty_id: parseInt(form.specialty_id),
      year: parseInt(form.year),
      grant_score: form.grant_score !== "" ? parseInt(form.grant_score) : null,
      paid_score: form.paid_score !== "" ? parseInt(form.paid_score) : null,
    });
    setSaving(false);
    onSaved();
    onClose();
  };
  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Проходной балл</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="space-y-1">
            <Label className="text-xs">ВУЗ *</Label>
            <Select value={form.university_id || "__none__"} onValueChange={v => setForm(p => ({ ...p, university_id: v === "__none__" ? "" : v }))}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Выберите ВУЗ" /></SelectTrigger>
              <SelectContent>{universities.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Специальность *</Label>
            <Select value={form.specialty_id || "__none__"} onValueChange={v => setForm(p => ({ ...p, specialty_id: v === "__none__" ? "" : v }))}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Выберите специальность" /></SelectTrigger>
              <SelectContent>{specialties.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.code} — {s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[["Год", "year"], ["Грант", "grant_score"], ["Платное", "paid_score"]].map(([label, key]) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <Input type="number" value={form[key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} className="h-8 text-sm text-center" />
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={onClose}>Отмена</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !form.university_id || !form.specialty_id}>{saving ? "..." : "Сохранить"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── XLSX Import dialog ─────────────────────────────────────────────────────

function XlsxImportDialog({ type, onClose, onSaved }: {
  type: "universities" | "specialties"; onClose: () => void; onSaved: () => void;
}) {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const uniCols  = ["name", "city", "website", "logo_url"];
  const specCols = ["code", "name", "profile_subjects"];
  const cols  = type === "universities" ? uniCols : specCols;
  const label = type === "universities" ? "ВУЗы" : "Специальности";

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([cols, cols.map(() => "")]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, `шаблон_${type}.xlsx`);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const wb   = XLSX.read(ev.target!.result, { type: "binary" });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
        if (!data.length) { setError("Файл пустой"); return; }
        const mapped = data.map(r => {
          const out: Record<string, string> = {};
          cols.forEach(c => { out[c] = String(r[c] ?? r[c.toLowerCase()] ?? "").trim(); });
          return out;
        }).filter(r => r[cols[0]]);
        setRows(mapped);
      } catch { setError("Ошибка чтения файла"); }
    };
    reader.readAsBinaryString(file);
  };

  const handleSave = async () => {
    if (!rows.length) return;
    setSaving(true);
    await post(`/${type}/bulk`, rows);
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4" />Импорт XLSX — {label}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadTemplate}>
              <Download className="h-3.5 w-3.5" />Шаблон
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" />Выбрать файл
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
          </div>
          <p className="text-xs text-muted-foreground">
            Ожидаемые колонки: <code className="bg-muted px-1 rounded">{cols.join(", ")}</code>
          </p>
          {error && <p className="text-xs text-destructive">{error}</p>}
          {rows.length > 0 && (
            <div className="border rounded overflow-auto max-h-48">
              <table className="text-xs w-full">
                <thead className="bg-muted/50">
                  <tr>{cols.map(c => <th key={c} className="px-2 py-1 text-left font-medium">{c}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.slice(0, 20).map((r, i) => (
                    <tr key={i} className="border-t">
                      {cols.map(c => <td key={c} className="px-2 py-1 max-w-[130px] truncate">{r[c]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 20 && <p className="text-xs text-muted-foreground px-2 py-1">...ещё {rows.length - 20} строк</p>}
            </div>
          )}
        </div>
        <div className="flex justify-between items-center mt-4">
          <span className="text-xs text-muted-foreground">{rows.length > 0 ? `${rows.length} строк` : ""}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Отмена</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !rows.length}>
              {saving ? "Импорт..." : `Импортировать (${rows.length})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Custom column dialog ───────────────────────────────────────────────────

function CustomColumnDialog({ item, onClose, onSaved }: {
  item: CustomColumn | null; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({ name: item?.name ?? "", type: (item?.type ?? "checkbox") as CustomColumn["type"] });
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    setSaving(true);
    if (item) await put(`/admission-custom-columns/${item.id}`, form);
    else        await post("/admission-custom-columns", form);
    setSaving(false); onSaved(); onClose();
  };
  const typeIcons: Record<CustomColumn["type"], React.ReactNode> = {
    checkbox: <CheckSquare className="h-3.5 w-3.5" />,
    text:     <Type  className="h-3.5 w-3.5" />,
    number:   <Hash  className="h-3.5 w-3.5" />,
  };
  const typeLabels: Record<CustomColumn["type"], string> = { checkbox: "Чекбокс", text: "Текст", number: "Число" };
  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-xs">
        <DialogHeader><DialogTitle>{item ? "Редактировать колонку" : "Новая колонка"}</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="space-y-1">
            <Label className="text-xs">Название</Label>
            <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Сдал экзамен IELTS" className="h-8 text-sm" autoFocus />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Тип</Label>
            <div className="flex gap-1.5">
              {(["checkbox", "text", "number"] as CustomColumn["type"][]).map(t => (
                <button key={t} onClick={() => setForm(p => ({ ...p, type: t }))}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs rounded border transition-colors
                    ${form.type === t ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                  {typeIcons[t]}{typeLabels[t]}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={onClose}>Отмена</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !form.name}>{saving ? "..." : "Сохранить"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Delta badge ────────────────────────────────────────────────────────────

function DeltaBadge({ score, grantScore, paidScore }: { score: number | null; grantScore: number | null; paidScore: number | null }) {
  if (score == null || (grantScore == null && paidScore == null)) return <span className="text-muted-foreground/40 text-xs">—</span>;
  const threshold = grantScore ?? paidScore!;
  const delta = score - threshold;
  const type = grantScore != null ? "грант" : "платное";
  if (delta >= 0) return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-green-600">
      <TrendingUp className="h-3 w-3" />+{delta} ({type})
    </span>
  );
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-500">
      <TrendingDown className="h-3 w-3" />{delta} ({type})
    </span>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function AdmissionPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "umo_head";

  const [rows, setRows] = useState<TrackerRow[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [passingScores, setPassingScores] = useState<PassingScore[]>([]);
  const [groups, setGroups] = useState<{ id: number; name: string }[]>([]);
  const [customCols, setCustomCols] = useState<CustomColumn[]>([]);
  const [customVals, setCustomVals] = useState<CustomValue[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "on_track" | "gap" | "no_target">("all");

  // Editing
  const [editRow, setEditRow] = useState<TrackerRow | null>(null);

  // Directory dialogs
  const [uniDialog, setUniDialog] = useState<{ open: boolean; item: University | null }>({ open: false, item: null });
  const [specDialog, setSpecDialog] = useState<{ open: boolean; item: Specialty | null }>({ open: false, item: null });
  const [psDialog, setPsDialog] = useState(false);
  const [xlsxDialog, setXlsxDialog] = useState<"universities" | "specialties" | null>(null);
  const [colDialog, setColDialog] = useState<{ open: boolean; item: CustomColumn | null }>({ open: false, item: null });

  // Sort
  const [sortCol, setSortCol] = useState<string>("full_name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [r, u, s, ps, g, cc, cv] = await Promise.all([
        get("/admission-tracker"),
        get("/universities"),
        get("/specialties"),
        get("/passing-scores"),
        get("/groups"),
        get("/admission-custom-columns"),
        get("/admission-custom-values"),
      ]);
      setRows(Array.isArray(r) ? r : []);
      setUniversities(Array.isArray(u) ? u : []);
      setSpecialties(Array.isArray(s) ? s : []);
      setPassingScores(Array.isArray(ps) ? ps : []);
      setGroups(Array.isArray(g) ? g : []);
      setCustomCols(Array.isArray(cc) ? cc : []);
      setCustomVals(Array.isArray(cv) ? cv : []);
    } catch (e) {
      console.error("AdmissionPage load error:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const maxScore = (row: TrackerRow) => {
    const scores = [row.unt_grant_1_score, row.unt_grant_2_score].filter(s => s != null) as number[];
    return scores.length > 0 ? Math.max(...scores) : null;
  };

  // Custom value helpers
  const getVal = (studentId: number, colId: number) =>
    customVals.find(v => v.student_id === studentId && v.column_id === colId)?.value ?? null;

  const setVal = async (studentId: number, colId: number, value: string | null) => {
    await put("/admission-custom-values", { student_id: studentId, column_id: colId, value });
    setCustomVals(prev => {
      const idx = prev.findIndex(v => v.student_id === studentId && v.column_id === colId);
      const entry: CustomValue = { id: 0, student_id: studentId, column_id: colId, value };
      if (idx >= 0) { const next = [...prev]; next[idx] = entry; return next; }
      return [...prev, entry];
    });
  };

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const filtered = useMemo(() => {
    let arr = rows;
    if (search) arr = arr.filter(r => r.full_name.toLowerCase().includes(search.toLowerCase()));
    if (groupFilter !== "all") arr = arr.filter(r => String(r.group_id) === groupFilter);
    if (statusFilter !== "all") {
      arr = arr.filter(r => {
        const ms = maxScore(r);
        if (statusFilter === "no_target") return !r.target_university_id;
        if (!r.target_university_id) return false;
        if (statusFilter === "on_track") return ms != null && r.grant_score != null && ms >= r.grant_score;
        if (statusFilter === "gap") return ms == null || r.grant_score == null || ms < r.grant_score;
        return true;
      });
    }
    return [...arr].sort((a, b) => {
      let va: number | string = 0, vb: number | string = 0;
      if (sortCol === "full_name") { va = a.full_name; vb = b.full_name; }
      else if (sortCol === "january") { va = a.unt_january_score ?? -1; vb = b.unt_january_score ?? -1; }
      else if (sortCol === "march") { va = a.unt_march_score ?? -1; vb = b.unt_march_score ?? -1; }
      else if (sortCol === "grant1") { va = a.unt_grant_1_score ?? -1; vb = b.unt_grant_1_score ?? -1; }
      else if (sortCol === "grant2") { va = a.unt_grant_2_score ?? -1; vb = b.unt_grant_2_score ?? -1; }
      else if (sortCol === "max") { va = maxScore(a) ?? -1; vb = maxScore(b) ?? -1; }
      else if (sortCol === "delta") {
        const da = maxScore(a) != null && a.grant_score != null ? maxScore(a)! - a.grant_score : -999;
        const db = maxScore(b) != null && b.grant_score != null ? maxScore(b)! - b.grant_score : -999;
        va = da; vb = db;
      }
      if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [rows, search, groupFilter, statusFilter, sortCol, sortDir]);

  // Stats
  const stats = useMemo(() => {
    const withTarget = rows.filter(r => r.target_university_id);
    const onTrack = withTarget.filter(r => { const ms = maxScore(r); return ms != null && r.grant_score != null && ms >= r.grant_score; });
    const avgMax = rows.reduce((s, r) => s + (maxScore(r) ?? 0), 0) / (rows.filter(r => maxScore(r) != null).length || 1);
    return { total: rows.length, withTarget: withTarget.length, onTrack: onTrack.length, avgMax: Math.round(avgMax) };
  }, [rows]);

  function SortIcon({ col }: { col: string }) {
    if (sortCol !== col) return <ChevronsUpDown className="h-3 w-3 ml-0.5 opacity-30" />;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />;
  }

  const Th = ({ col, children }: { col: string; children: React.ReactNode }) => (
    <TableHead className="cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort(col)}>
      <span className="flex items-center gap-0.5">{children}<SortIcon col={col} /></span>
    </TableHead>
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-primary" />
              Трекер Поступления
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Мониторинг целей поступления и баллов ЕНТ</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {[
            { label: "Всего учеников", value: stats.total, icon: Users, color: "text-blue-600" },
            { label: "С целью", value: stats.withTarget, icon: Building2, color: "text-purple-600" },
            { label: "На гранте", value: stats.onTrack, icon: Trophy, color: "text-green-600" },
            { label: "Средний макс. балл", value: stats.avgMax || "—", icon: TrendingUp, color: "text-orange-600" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}><CardContent className="p-4 flex items-center gap-3">
              <Icon className={`h-8 w-8 ${color} opacity-80`} />
              <div><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>
            </CardContent></Card>
          ))}
        </div>

        <Tabs defaultValue="tracker">
          <TabsList>
            <TabsTrigger value="tracker"><Users className="h-4 w-4 mr-1.5" />Таблица учеников</TabsTrigger>
            {isAdmin && <TabsTrigger value="directory"><BookMarked className="h-4 w-4 mr-1.5" />Справочник ВУЗов</TabsTrigger>}
            {isAdmin && <TabsTrigger value="columns"><Settings2 className="h-4 w-4 mr-1.5" />Доп. колонки</TabsTrigger>}
          </TabsList>

          {/* ══════ TRACKER TAB ══════ */}
          <TabsContent value="tracker" className="mt-4 space-y-3">
            {/* Filters */}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Поиск по ФИО..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 w-48 text-sm" />
              </div>
              <Select value={groupFilter} onValueChange={setGroupFilter}>
                <SelectTrigger className="h-8 w-44 text-sm"><SelectValue placeholder="Группа" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все группы</SelectItem>
                  {groups.map(g => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={v => setStatusFilter(v as typeof statusFilter)}>
                <SelectTrigger className="h-8 w-44 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все статусы</SelectItem>
                  <SelectItem value="on_track">✅ На гранте</SelectItem>
                  <SelectItem value="gap">❌ Не добирает</SelectItem>
                  <SelectItem value="no_target">⬜ Без цели</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground ml-auto">{filtered.length} учеников</span>
            </div>

            {/* Table */}
            {loading ? (
              <div className="text-center py-16 text-muted-foreground text-sm">Загрузка...</div>
            ) : (
              <div className="rounded-lg border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <Th col="full_name">Ученик</Th>
                      <Th col="january">Январь</Th>
                      <Th col="march">Март</Th>
                      <Th col="grant1">Грант 1</Th>
                      <Th col="grant2">Грант 2</Th>
                      <Th col="max">Макс.</Th>
                      <TableHead className="min-w-[220px]">Цель: ВУЗ / Специальность</TableHead>
                      <TableHead className="whitespace-nowrap">Проходной (Грант)</TableHead>
                      <Th col="delta">Статус / Дельта</Th>
                      {customCols.map(c => (
                        <TableHead key={c.id} className="whitespace-nowrap text-xs">{c.name}</TableHead>
                      ))}
                      {isAdmin && <TableHead className="w-10" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 && (
                      <TableRow><TableCell colSpan={10 + customCols.length} className="text-center py-10 text-muted-foreground text-sm">Нет данных</TableCell></TableRow>
                    )}
                    {filtered.map(row => {
                      const ms = maxScore(row);
                      const delta = ms != null && row.grant_score != null ? ms - row.grant_score : null;
                      return (
                        <TableRow key={row.id} className="hover:bg-muted/30">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <GroupPersonAvatar groupName={row.group_name} size={22} showTooltip={false} />
                              <div>
                                <p className="font-medium text-sm leading-tight">{row.full_name}</p>
                                <p className="text-[11px] text-muted-foreground">{row.group_name}</p>
                              </div>
                            </div>
                          </TableCell>
                          {[row.unt_january_score, row.unt_march_score, row.unt_grant_1_score, row.unt_grant_2_score].map((s, i) => (
                            <TableCell key={i} className="text-center">
                              {s != null ? (
                                <span className={`font-mono font-semibold text-sm ${s >= 100 ? "text-green-600" : s >= 80 ? "text-blue-600" : s >= 60 ? "text-orange-500" : "text-red-500"}`}>{s}</span>
                              ) : <span className="text-muted-foreground/30 text-xs">—</span>}
                            </TableCell>
                          ))}
                          <TableCell className="text-center">
                            {ms != null ? (
                              <span className="font-mono font-bold text-sm bg-primary/10 text-primary px-1.5 py-0.5 rounded">{ms}</span>
                            ) : <span className="text-muted-foreground/30 text-xs">—</span>}
                          </TableCell>
                          <TableCell>
                            {row.university_name ? (
                              <div className="flex items-center gap-2">
                                <UniLogo url={row.university_logo_url} name={row.university_name} size={24} />
                                <div>
                                  <p className="text-sm font-medium leading-tight">{row.university_name}</p>
                                  <p className="text-[11px] text-muted-foreground">{row.specialty_code} {row.specialty_name}</p>
                                </div>
                              </div>
                            ) : <span className="text-muted-foreground/30 text-xs italic">Не задана</span>}
                          </TableCell>
                          <TableCell className="text-center">
                            {row.grant_score != null ? (
                              <span className="font-mono text-sm font-semibold text-green-700">{row.grant_score}</span>
                            ) : <span className="text-muted-foreground/30 text-xs">—</span>}
                          </TableCell>
                          <TableCell>
                            {delta != null ? (
                              <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${delta >= 0 ? "text-green-600" : "text-red-500"}`}>
                                {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                {delta >= 0 ? "+" : ""}{delta} б.
                              </span>
                            ) : (!row.target_university_id
                              ? <span className="text-[11px] text-muted-foreground/50 italic">цель не задана</span>
                              : <span className="text-[11px] text-muted-foreground/50">нет баллов</span>
                            )}
                          </TableCell>

                          {/* Custom column cells */}
                          {customCols.map(col => {
                            const val = getVal(row.id, col.id);
                            if (col.type === "checkbox") return (
                              <TableCell key={col.id} className="text-center">
                                <Checkbox
                                  checked={val === "1"}
                                  onCheckedChange={v => setVal(row.id, col.id, v ? "1" : "0")}
                                />
                              </TableCell>
                            );
                            return (
                              <TableCell key={col.id} className="min-w-[90px]">
                                <Input
                                  type={col.type === "number" ? "number" : "text"}
                                  value={val ?? ""}
                                  onChange={e => setVal(row.id, col.id, e.target.value || null)}
                                  className="h-7 text-xs px-1.5"
                                  placeholder="—"
                                />
                              </TableCell>
                            );
                          })}

                          {isAdmin && (
                            <TableCell>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditRow(row)}>
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Редактировать</TooltipContent>
                              </Tooltip>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* ══════ DIRECTORY TAB ══════ */}
          {isAdmin && (
            <TabsContent value="directory" className="mt-4">
              <div className="grid gap-5 lg:grid-cols-3">

                {/* Universities */}
                <Card>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" />ВУЗы</CardTitle>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => setXlsxDialog("universities")}>
                        <Upload className="h-3.5 w-3.5" />XLSX
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => setUniDialog({ open: true, item: null })}>
                        <Plus className="h-3.5 w-3.5" />Добавить
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-1 max-h-[420px] overflow-y-auto">
                    {universities.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Нет записей</p>}
                    {universities.map(u => (
                      <div key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/40 group">
                        <UniLogo url={u.logo_url} name={u.name} size={28} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{u.name}</p>
                          <p className="text-[11px] text-muted-foreground">{u.city}</p>
                        </div>
                        {u.website && (
                          <a href={u.website} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setUniDialog({ open: true, item: u })}>
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-600" onClick={async () => { await del(`/universities/${u.id}`); loadAll(); }}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Specialties */}
                <Card>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2"><BookMarked className="h-4 w-4 text-primary" />Специальности</CardTitle>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => setXlsxDialog("specialties")}>
                        <Upload className="h-3.5 w-3.5" />XLSX
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => setSpecDialog({ open: true, item: null })}>
                        <Plus className="h-3.5 w-3.5" />Добавить
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-1 max-h-[420px] overflow-y-auto">
                    {specialties.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Нет записей</p>}
                    {specialties.map(s => (
                      <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/40 group">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px] px-1 py-0 font-mono">{s.code}</Badge>
                            <p className="text-sm font-medium truncate">{s.name}</p>
                          </div>
                          {s.profile_subjects && <p className="text-[11px] text-muted-foreground truncate">{s.profile_subjects}</p>}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSpecDialog({ open: true, item: s })}>
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-600" onClick={async () => { await del(`/specialties/${s.id}`); loadAll(); }}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Passing Scores */}
                <Card>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2"><Trophy className="h-4 w-4 text-primary" />Проходные баллы</CardTitle>
                    <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => setPsDialog(true)}>
                      <Plus className="h-3.5 w-3.5" />Добавить
                    </Button>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-1 max-h-[420px] overflow-y-auto">
                    {passingScores.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Нет записей</p>}
                    {passingScores.map(ps => (
                      <div key={ps.id} className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-muted/40 group">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{ps.university_name}</p>
                          <p className="text-[11px] text-muted-foreground">{ps.specialty_code} · {ps.year}</p>
                          <div className="flex gap-2 mt-0.5">
                            {ps.grant_score != null && <span className="text-[11px] text-green-600 font-semibold">🏆 {ps.grant_score}</span>}
                            {ps.paid_score  != null && <span className="text-[11px] text-blue-600 font-semibold">💳 {ps.paid_score}</span>}
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={async () => { await del(`/passing-scores/${ps.id}`); loadAll(); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}

          {/* ══════ CUSTOM COLUMNS TAB ══════ */}
          {isAdmin && (
            <TabsContent value="columns" className="mt-4">
              <Card className="max-w-lg">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-primary" />Дополнительные колонки
                  </CardTitle>
                  <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => setColDialog({ open: true, item: null })}>
                    <Plus className="h-3.5 w-3.5" />Добавить
                  </Button>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground mb-3">
                    Колонки отображаются в таблице учеников. Типы: флажок, текст, число.
                  </p>
                  {customCols.length === 0 && (
                    <p className="text-sm text-muted-foreground py-4 text-center">Нет дополнительных колонок</p>
                  )}
                  <div className="space-y-1">
                    {customCols.map(col => {
                      const typeIcon = col.type === "checkbox"
                        ? <CheckSquare className="h-3.5 w-3.5 text-blue-500" />
                        : col.type === "text"
                          ? <Type className="h-3.5 w-3.5 text-purple-500" />
                          : <Hash className="h-3.5 w-3.5 text-orange-500" />;
                      return (
                        <div key={col.id} className="flex items-center gap-2 px-2 py-2 rounded hover:bg-muted/40 group">
                          {typeIcon}
                          <span className="flex-1 text-sm font-medium">{col.name}</span>
                          <Badge variant="outline" className="text-[10px] px-1 py-0">{col.type}</Badge>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setColDialog({ open: true, item: col })}>
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={async () => { await del(`/admission-custom-columns/${col.id}`); loadAll(); }}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        {/* Dialogs */}
        {editRow && (
          <StudentTargetDialog
            row={editRow}
            universities={universities}
            specialties={specialties}
            passingScores={passingScores}
            open
            onClose={() => setEditRow(null)}
            onSaved={loadAll}
          />
        )}
        {uniDialog.open && (
          <UniversityDialog item={uniDialog.item} onClose={() => setUniDialog({ open: false, item: null })} onSaved={loadAll} />
        )}
        {specDialog.open && (
          <SpecialtyDialog item={specDialog.item} onClose={() => setSpecDialog({ open: false, item: null })} onSaved={loadAll} />
        )}
        {psDialog && (
          <PassingScoreDialog universities={universities} specialties={specialties} onClose={() => setPsDialog(false)} onSaved={loadAll} />
        )}
        {xlsxDialog && (
          <XlsxImportDialog type={xlsxDialog} onClose={() => setXlsxDialog(null)} onSaved={loadAll} />
        )}
        {colDialog.open && (
          <CustomColumnDialog item={colDialog.item} onClose={() => setColDialog({ open: false, item: null })} onSaved={loadAll} />
        )}
      </div>
    </TooltipProvider>
  );
}
