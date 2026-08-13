import React, { useState, useEffect, useMemo, useCallback, useRef, Fragment } from "react";
import { GroupPersonAvatar } from "@/components/GroupPersonAvatar";
import * as XLSX from "xlsx";
import { addExcelWatermarkSheet } from "@/lib/watermark";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  BarChart3, Users, TrendingUp, Edit, ArrowUp, ArrowDown, Minus,
  Trophy, Medal, Crown, Filter, ChevronsUpDown, ChevronUp, ChevronDown,
  Target, Star, Award, Flame, Hash, BookOpen, Loader2,
  Upload, Download, FileText, PenLine, TableIcon, CheckCircle2, X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend,
  ResponsiveContainer, Area, AreaChart, BarChart, Bar,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Cell, LabelList,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { fetchGroups, saveEntResultsBatch, fetchStudents, deleteEntResults } from "@/lib/api";
import { useEntResults, useAllEntResults } from "./ent-results/hooks/useEntData";

/* ══════ Constants ══════ */

export const TOTAL_MAX = 140; // 20 + 10 + 10 + 50 + 50

export const ACADEMIC_MONTHS = [
  { value: "2026-08", label: "Август", short: "Авг" },
  { value: "2026-09", label: "Сентябрь", short: "Сен" },
  { value: "2026-10", label: "Октябрь", short: "Окт" },
  { value: "2026-11", label: "Ноябрь", short: "Ноя" },
  { value: "2026-12", label: "Декабрь", short: "Дек" },
  { value: "2027-01", label: "Январь", short: "Янв" },
  { value: "2027-02", label: "Февраль", short: "Фев" },
  { value: "2027-03", label: "Март", short: "Мар" },
  { value: "2027-04", label: "Апрель", short: "Апр" },
  { value: "2027-05", label: "Май", short: "Май" },
  { value: "2027-06", label: "Июнь", short: "Июн" },
  { value: "2027-07", label: "Июль", short: "Июл" },
];

export const REAL_EXAM_TYPES = [
  { value: "1000-01", label: "Январьский реальный ЕНТ", short: "Янв.ЕНТ" },
  { value: "1000-03", label: "Мартовский реальный ЕНТ", short: "Мар.ЕНТ" },
  { value: "1001-01", label: "Грантовский 1", short: "Грант 1" },
  { value: "1001-02", label: "Грантовский 2", short: "Грант 2" },
];

export const MONTH_LABELS: Record<string, string> = {};
export const MONTH_SHORT: Record<string, string> = {};
for (const m of ACADEMIC_MONTHS) { MONTH_LABELS[m.value] = m.label; MONTH_SHORT[m.value] = m.short; }
for (const m of REAL_EXAM_TYPES) { MONTH_LABELS[m.value] = m.label; MONTH_SHORT[m.value] = m.short; }

// Profile → 5 ENT subjects (3 mandatory + 2 profile)
// История: max 20, Чтение: max 10, Мат.грам: max 10, Профильные: max 50
export const ENT_PROFILE_SUBJECTS: Record<number, { id: number; name: string; short: string; max: number }[]> = {
  1: [ // ФМ (Мат-Физ)
    { id: 1, name: "История Казахстана", short: "ИК", max: 20 },
    { id: 8, name: "Грамотность чтения", short: "ГЧ", max: 10 },
    { id: 3, name: "Мат. грамотность", short: "МГ", max: 10 },
    { id: 2, name: "Математика", short: "Мат", max: 50 },
    { id: 5, name: "Физика", short: "Физ", max: 50 },
  ],
  2: [ // ХБ (Хим-Био)
    { id: 1, name: "История Казахстана", short: "ИК", max: 20 },
    { id: 8, name: "Грамотность чтения", short: "ГЧ", max: 10 },
    { id: 3, name: "Мат. грамотность", short: "МГ", max: 10 },
    { id: 6, name: "Биология", short: "Био", max: 50 },
    { id: 7, name: "Химия", short: "Хим", max: 50 },
  ],
  3: [ // ИНФМАТ (Инф-Мат)
    { id: 1, name: "История Казахстана", short: "ИК", max: 20 },
    { id: 8, name: "Грамотность чтения", short: "ГЧ", max: 10 },
    { id: 3, name: "Мат. грамотность", short: "МГ", max: 10 },
    { id: 2, name: "Математика", short: "Мат", max: 50 },
    { id: 4, name: "Информатика", short: "Инф", max: 50 },
  ],
};

const MANDATORY_SUBJECTS = [
  { id: 1, name: "История Казахстана", short: "ИК", max: 20 },
  { id: 8, name: "Грамотность чтения", short: "ГЧ", max: 10 },
  { id: 3, name: "Мат. грамотность", short: "МГ", max: 10 },
];

const CHART_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#3b82f6"];

export const GROUP_ROW_COLORS = [
  'bg-blue-500/[0.03]',
  'bg-violet-500/[0.03]',
  'bg-amber-500/[0.03]',
  'bg-emerald-500/[0.03]',
  'bg-rose-500/[0.03]',
  'bg-cyan-500/[0.03]',
  'bg-orange-500/[0.03]',
  'bg-pink-500/[0.03]',
];
export const getGroupRowColor = (groupId: number) => GROUP_ROW_COLORS[(groupId - 1) % GROUP_ROW_COLORS.length];

export function getScoreColor(score: number, max: number) {
  const pct = score / max;
  if (pct >= 0.8) return "text-emerald-600 dark:text-emerald-400 font-bold";
  if (pct >= 0.6) return "text-foreground font-semibold";
  if (pct >= 0.4) return "text-orange-500 font-medium";
  return "text-red-500 font-medium";
}

export function getScoreBg(score: number, max: number) {
  const pct = score / max;
  if (pct >= 0.8) return "bg-emerald-500";
  if (pct >= 0.6) return "bg-blue-500";
  if (pct >= 0.4) return "bg-orange-500";
  return "bg-red-500";
}

export function DeltaBadge({ delta }: { delta: number }) {
  if (delta > 0) return <span className="inline-flex items-center text-[11px] text-green-600 font-medium"><ArrowUp className="h-3 w-3" />+{delta}</span>;
  if (delta < 0) return <span className="inline-flex items-center text-[11px] text-red-600 font-medium"><ArrowDown className="h-3 w-3" />{delta}</span>;
  return <span className="inline-flex items-center text-[11px] text-muted-foreground"><Minus className="h-3 w-3" /></span>;
}

export function getMatrixCellBg(score: number, max: number) {
  if (!score || score <= 0) return "";
  const pct = score / max;
  if (pct >= 0.85) return "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold";
  if (pct >= 0.70) return "bg-green-500/15 text-green-700 dark:text-green-400 font-medium";
  if (pct >= 0.50) return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-500 font-medium";
  if (pct >= 0.35) return "bg-orange-500/20 text-orange-700 dark:text-orange-400 font-medium";
  return "bg-red-500/20 text-red-700 dark:text-red-400 font-medium";
}

/* ══════ Types ══════ */

export interface RawEntResult {
  id: number; student_id: number; subject_id: number; score: number;
  month: string; student_name: string; subject_name: string;
  group_id: number; group_name: string;
}

export interface StudentRow {
  id: number; full_name: string; group_name: string; group_id: number;
  scores: Record<number, number>; total: number;
}

/* ══════ Real ENT Dialog (Manual + CSV) ══════ */

import { RealEntImportDialog } from "./ent-results/components/RealEntImportDialog";
import { EntAnalyticsTab } from "./ent-results/tabs/EntAnalyticsTab";
import { EntMatrixTab } from "./ent-results/tabs/EntMatrixTab";

/* ══════ Score Editor Dialog ══════ */

function ScoreEditorDialog({ student, month, profileId, currentScores, onSave, onDelete, onClose }: {
  student: { id: number; full_name: string } | null;
  month: string; profileId: number;
  currentScores: Record<number, number>;
  onSave: (scores: { student_id: number; subject_id: number; score: number; month: string }[]) => Promise<void>;
  onDelete?: (student_id: number, month: string) => Promise<void>;
  onClose: () => void;
}) {
  const subjects = ENT_PROFILE_SUBJECTS[profileId] || ENT_PROFILE_SUBJECTS[1];
  const [values, setValues] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init: Record<number, string> = {};
    for (const s of subjects) init[s.id] = (currentScores[s.id] != null) ? String(currentScores[s.id]) : "";
    setValues(init);
  }, [student, currentScores]);

  const total = useMemo(() => subjects.reduce((sum, s) => sum + (parseInt(values[s.id]) || 0), 0), [values, subjects]);

  const handleSave = async () => {
    if (!student) return;
    setSaving(true);
    const scores = subjects.filter(s => values[s.id] !== "").map(s => ({
      student_id: student.id, subject_id: s.id, score: parseInt(values[s.id]) || 0, month,
    }));
    await onSave(scores);
    setSaving(false);
    onClose();
  };

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const handleDelete = () => setConfirmDeleteOpen(true);
  
  const executeDelete = async () => {
    if (!student || !onDelete) return;
    setSaving(true);
    await onDelete(student.id, month);
    setSaving(false);
    setConfirmDeleteOpen(false);
    onClose();
  };

  if (!student) return null;

  return (
    <>
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Edit className="h-5 w-5 text-primary" />Баллы ЕНТ</DialogTitle>
          <div className="text-sm text-muted-foreground">{student.full_name} · {MONTH_LABELS[month] || month}</div>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          {subjects.map(s => (
            <div key={s.id} className="flex items-center gap-3">
              <Label className="text-sm w-40 shrink-0">{s.name}</Label>
              <Input type="number" min={0} max={s.max} value={values[s.id] || ""} onChange={e => setValues(v => ({ ...v, [s.id]: e.target.value }))} className="w-20 h-8 text-center" placeholder="0" />
              <span className="text-xs text-muted-foreground">/ {s.max}</span>
            </div>
          ))}
          <div className="flex items-center gap-3 pt-2 border-t">
            <Label className="text-sm w-40 shrink-0 font-semibold">Итого</Label>
            <span className={`text-lg font-bold ${getScoreColor(total, TOTAL_MAX)}`}>{total}</span>
            <span className="text-xs text-muted-foreground">/ {TOTAL_MAX}</span>
          </div>
        </div>
        <div className="flex gap-2 pt-3">
          <Button onClick={handleSave} disabled={saving} className="flex-1">{saving ? "Сохранение..." : "Сохранить"}</Button>
          {onDelete && Object.keys(currentScores).length > 0 && (
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>Удалить</Button>
          )}
          <Button variant="outline" onClick={onClose}>Отмена</Button>
        </div>
      </DialogContent>
    </Dialog>
    <ConfirmDialog
        open={confirmDeleteOpen}
        title="Удалить баллы?"
        description="Вы уверены, что хотите удалить все баллы этого ученика за этот месяц?"
        onConfirm={executeDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
        loading={saving}
      />
    </>
  );
}

/* ══════ Unified ENT XLSX Import Dialog ══════ */

// Profile subject ids for п1/п2 by profile_id
const PROFILE_SUB_IDS: Record<number, [number, number]> = {
  1: [2, 5],  // ФМ: Мат, Физ
  2: [6, 7],  // ХБ: Био, Хим
  3: [2, 4],  // ИНФМАТ: Мат, Инф
};

interface XlsxRow {
  studentId: number | null;
  rawId: string;
  тарих?: number | null;
  чтение?: number | null;
  матграм?: number | null;
  п1?: number | null;
  п2?: number | null;
  общий?: number | null;
  errors: string[];
}

type EntXlsxMode = "trial" | "real";

function EntXlsxImportDialog({ open, onOpenChange, groups, groupProfileMap, studentGroupMap, onSuccess }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groups: any[];
  groupProfileMap: Record<number, number>;
  studentGroupMap: Record<number, number>;
  onSuccess: (savedMonth: string, isReal: boolean) => void;
}) {
  const [entMode, setEntMode] = useState<EntXlsxMode>("trial");
  const [month, setMonth] = useState(ACADEMIC_MONTHS[ACADEMIC_MONTHS.length - 1].value);
  const [examType, setExamType] = useState(REAL_EXAM_TYPES[0].value);
  const [groupId, setGroupId] = useState("all");
  const [rows, setRows] = useState<XlsxRow[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [students, setStudents] = useState<{ id: number; full_name: string; group_id: number }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastFileRef = useRef<File | null>(null);

  const selectedGroup = groups.find((g: any) => String(g.id) === groupId);
  const profileId: number = selectedGroup?.profile_id || 1;
  const [p1Id, p2Id] = PROFILE_SUB_IDS[profileId] || [2, 4];
  const activeMonth = entMode === "trial" ? month : examType;

  // Load students for current group (for template + validation)
  useEffect(() => {
    fetchStudents().then((all: any[]) => {
      setStudents(all);
    });
  }, []);

  const groupStudents = useMemo(() =>
    groupId === "all" ? students : students.filter(s => String(s.group_id) === groupId),
    [students, groupId]
  );

  // Known student ID set for validation
  const knownStudentIds = useMemo(() => new Set(students.map(s => s.id)), [students]);

  useEffect(() => {
    if (!open) { setRows(null); setFileName(""); setGroupId("all"); setSaveError(null); lastFileRef.current = null; }
  }, [open]);

  // Re-validate rows when knownStudentIds changes (students loaded after file was parsed)
  useEffect(() => {
    if (lastFileRef.current && knownStudentIds.size > 0) {
      parseXlsx(lastFileRef.current);
    }
  }, [knownStudentIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const parseXlsx = (file: File) => {
    lastFileRef.current = file;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        if (raw.length < 2) { setRows([]); return; }

        let headerIdx = 0;
        for (let i = 0; i < Math.min(5, raw.length); i++) {
          const lower = raw[i].map((c: any) => String(c).toLowerCase().trim());
          if (lower.some(c => c === "id" || c === "id ученика")) { headerIdx = i; break; }
        }
        const headers = raw[headerIdx].map((c: any) => String(c).toLowerCase().trim().replace(/\s+/g, ""));

        const idxOf = (keys: string[]) => {
          for (const k of keys) { const i = headers.indexOf(k); if (i >= 0) return i; }
          return -1;
        };
        const colId     = idxOf(["id", "idученика", "idученика"]);
        const colTarikh = idxOf(["тарих", "история", "ик", "историяказахстана"]);
        const colRead   = idxOf(["чтение", "грамотностьчтения", "гч"]);
        const colMat    = idxOf(["матграм", "матграмотность", "мг", "математическаяграмотность"]);
        const colP1     = idxOf(["п1", "профиль1", "профиль1"]);
        const colP2     = idxOf(["п2", "профиль2", "профиль2"]);

        const parsed: XlsxRow[] = [];
        for (let i = headerIdx + 1; i < raw.length; i++) {
          const row = raw[i];
          if (row.every((c: any) => c === "" || c == null)) continue;
          const rawId = String(row[colId] ?? "").trim();
          const studentId = rawId && !isNaN(Number(rawId)) ? Number(rawId) : null;

          const parseCell = (col: number, max: number): number | null => {
            if (col < 0) return null;
            const v = row[col];
            if (v === "" || v == null) return null;
            if (typeof v === "string" && ["-", "—", "–", "null", "none"].includes(v.trim().toLowerCase())) return null;
            const n = Number(v);
            return isNaN(n) || n < 0 || n > max ? null : n;
          };

          const errs: string[] = [];
          if (!studentId) errs.push("ID не найден");
          else if (knownStudentIds.size > 0 && !knownStudentIds.has(studentId)) errs.push(`ID ${studentId} не существует в БД`);

          const cells = {
            тарих:   parseCell(colTarikh,  20),
            чтение:  parseCell(colRead,    10),
            матграм: parseCell(colMat,     10),
            п1:      parseCell(colP1,      50),
            п2:      parseCell(colP2,      50),
          };

          const isInvalid = (val: any, parsed: number | null) => {
            if (val === "" || val == null) return false;
            if (typeof val === "string" && ["-", "—", "–", "null", "none"].includes(val.trim().toLowerCase())) return false;
            return parsed === null;
          };

          if (colTarikh >= 0 && isInvalid(row[colTarikh], cells.тарих)) errs.push("Тарих: неверное значение");
          if (colRead   >= 0 && isInvalid(row[colRead], cells.чтение)) errs.push("Чтение: неверное значение");
          if (colMat    >= 0 && isInvalid(row[colMat], cells.матграм)) errs.push("МатГрам: неверное значение");
          if (colP1     >= 0 && isInvalid(row[colP1], cells.п1)) errs.push("П1: неверное значение");
          if (colP2     >= 0 && isInvalid(row[colP2], cells.п2)) errs.push("П2: неверное значение");


          const computed = (cells.тарих ?? 0) + (cells.чтение ?? 0) + (cells.матграм ?? 0) + (cells.п1 ?? 0) + (cells.п2 ?? 0);
          parsed.push({ studentId, rawId, ...cells, общий: computed || null, errors: errs });
        }
        setRows(parsed);
      } catch {
        setRows([]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const validRows = rows?.filter(r => r.studentId != null && r.errors.length === 0) ?? [];
  const errorRows = rows?.filter(r => r.errors.length > 0) ?? [];

  const handleSave = async () => {
    if (!validRows.length || !activeMonth) return;
    setSaving(true);
    setSaveError(null);
    const scores: { student_id: number; subject_id: number; score: number; month: string }[] = [];
    for (const r of validRows) {
      // Per-student P1/P2 resolution when "all groups" selected
      let rp1Id = p1Id, rp2Id = p2Id;
      if (groupId === "all" && r.studentId != null) {
        const gid = studentGroupMap[r.studentId];
        if (gid != null) {
          const pid = groupProfileMap[gid] || 1;
          [rp1Id, rp2Id] = PROFILE_SUB_IDS[pid] || [2, 4];
        }
      }
      if (r.тарих   != null) scores.push({ student_id: r.studentId!, subject_id: 1,     score: r.тарих,   month: activeMonth });
      if (r.чтение  != null) scores.push({ student_id: r.studentId!, subject_id: 8,     score: r.чтение,  month: activeMonth });
      if (r.матграм != null) scores.push({ student_id: r.studentId!, subject_id: 3,     score: r.матграм, month: activeMonth });
      if (r.п1      != null) scores.push({ student_id: r.studentId!, subject_id: rp1Id, score: r.п1,      month: activeMonth });
      if (r.п2      != null) scores.push({ student_id: r.studentId!, subject_id: rp2Id, score: r.п2,      month: activeMonth });
    }
    const result = await saveEntResultsBatch(scores);
    setSaving(false);
    if (!result) {
      setSaveError("Ошибка сохранения. Проверьте ID учеников и повторите попытку.");
      return;
    }
    onSuccess(activeMonth, entMode === "real");
    onOpenChange(false);
  };

  const downloadTemplate = () => {
    const header = ["id ученика", "тарих", "чтение", "матграм", "п1", "п2", "общий"];
    const dataRows = groupStudents.length > 0
      ? groupStudents.map(s => [s.id, "", "", "", "", "", ""])
      : [["<id>", "", "", "", "", "", ""]];
    const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ЕНТ Баллы");
    addExcelWatermarkSheet(XLSX, wb);
    XLSX.writeFile(wb, `ent_${entMode}_template_${activeMonth}.xlsx`);
  };

  const monthLabel = entMode === "trial"
    ? ACADEMIC_MONTHS.find(m => m.value === month)?.label
    : REAL_EXAM_TYPES.find(m => m.value === examType)?.label;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col p-0 gap-0">
        <DialogTitle className="sr-only">Загрузка баллов ЕНТ через XLSX</DialogTitle>
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Upload className="h-4 w-4 text-primary" />
              Загрузка баллов ЕНТ через XLSX
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Колонки: id ученика · тарих · чтение · матграм · п1 · п2 · общий
            </p>
          </div>
          <button onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground mt-0.5">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Config row */}
        <div className="px-6 py-3 border-b bg-muted/30 flex flex-wrap gap-3 items-end">
          {/* Mode toggle */}
          <div className="flex rounded-lg border overflow-hidden text-xs font-medium self-end">
            <button
              onClick={() => { setEntMode("trial"); setRows(null); setFileName(""); }}
              className={`px-3 py-1.5 transition-colors ${entMode === "trial" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              Пробный ЕНТ
            </button>
            <button
              onClick={() => { setEntMode("real"); setRows(null); setFileName(""); }}
              className={`px-3 py-1.5 transition-colors border-l ${entMode === "real" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              Реальный ЕНТ
            </button>
          </div>

          {/* Month / exam type selector */}
          <div className="flex-1 min-w-[160px]">
            {entMode === "trial" ? (
              <>
                <Label className="text-xs font-medium mb-1 block">Месяц</Label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACADEMIC_MONTHS.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            ) : (
              <>
                <Label className="text-xs font-medium mb-1 block">Вид ЕНТ</Label>
                <Select value={examType} onValueChange={setExamType}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REAL_EXAM_TYPES.map(e => (
                      <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>

          {/* Group selector (for P1/P2 mapping) */}
          <div className="flex-1 min-w-[160px]">
            <Label className="text-xs font-medium mb-1 block">Группа (для П1/П2)</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Все группы" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все группы (авто)</SelectItem>
                {groups.map((g: any) => (
                  <SelectItem key={g.id} value={String(g.id)}>
                    <span className="flex items-center gap-1.5">
                      <GroupPersonAvatar groupName={g.name} avatarUrl={g.avatar_url} size={18} showTooltip={false} />
                      {g.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {groupId === "all" ? (
              <p className="text-[11px] text-muted-foreground mt-1">П1/П2 определяется автоматически по группе ученика</p>
            ) : groupId ? (
              <p className="text-[11px] text-muted-foreground mt-1">
                П1 = {(ENT_PROFILE_SUBJECTS[profileId] || [])[3]?.name}, П2 = {(ENT_PROFILE_SUBJECTS[profileId] || [])[4]?.name}
              </p>
            ) : null}
          </div>

          <div className="flex gap-2 self-end">
            <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={downloadTemplate}>
              <Download className="h-3.5 w-3.5" />Шаблон
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => fileRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" />Загрузить XLSX
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) parseXlsx(f); e.target.value = ""; }}
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          {!rows ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <FileText className="h-10 w-10 opacity-30" />
              <p className="text-sm">Загрузите XLSX файл для предпросмотра</p>
              <p className="text-xs">Обязательная колонка: <code className="bg-muted px-1 rounded">id ученика</code></p>
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Не удалось прочитать данные из файла</div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{fileName} — {rows.length} строк</span>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-green-600 border-green-200">✓ {validRows.length} ок</Badge>
                  {errorRows.length > 0 && <Badge variant="outline" className="text-red-600 border-red-200">✗ {errorRows.length} ошибок</Badge>}
                </div>
              </div>
              <div className="rounded-md border overflow-auto max-h-[45vh]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/60 border-b sticky top-0">
                      <th className="px-2 py-1.5 text-left font-medium w-6">#</th>
                      <th className="px-2 py-1.5 text-center font-medium">ID</th>
                      <th className="px-2 py-1.5 text-center font-medium">Тарих</th>
                      <th className="px-2 py-1.5 text-center font-medium">Чтение</th>
                      <th className="px-2 py-1.5 text-center font-medium">МатГрам</th>
                      <th className="px-2 py-1.5 text-center font-medium">П1</th>
                      <th className="px-2 py-1.5 text-center font-medium">П2</th>
                      <th className="px-2 py-1.5 text-center font-medium">Общий</th>
                      <th className="px-2 py-1.5 text-left font-medium">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className={`border-b last:border-0 ${row.errors.length > 0 ? "bg-red-50 dark:bg-red-950/20" : "hover:bg-muted/20"}`}>
                        <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                        <td className="px-2 py-1 text-center font-mono">{row.rawId}</td>
                        {(["тарих","чтение","матграм","п1","п2"] as const).map(k => (
                          <td key={k} className="px-2 py-1 text-center">
                            {row[k] != null ? <span className="font-mono">{row[k]}</span> : <span className="text-muted-foreground/30">—</span>}
                          </td>
                        ))}
                        <td className="px-2 py-1 text-center font-bold">
                          {row.общий ? <span className={getScoreColor(row.общий, TOTAL_MAX)}>{row.общий}</span> : <span className="text-muted-foreground/30">—</span>}
                        </td>
                        <td className="px-2 py-1">
                          {row.errors.length === 0
                            ? <span className="text-green-600">✓</span>
                            : <span className="text-red-600 text-[10px]">{row.errors.join("; ")}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t bg-muted/20 flex flex-col gap-2">
          {saveError && (
            <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 rounded px-3 py-1.5 border border-red-200 dark:border-red-800">
              ⚠ {saveError}
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              {rows && <>{validRows.length} из {rows.length} готовы · <strong>{monthLabel}</strong></>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Закрыть</Button>
              <Button size="sm" disabled={saving || validRows.length === 0}
                onClick={handleSave} className="gap-1.5">
                {saving ? "Сохранение..." : `Сохранить ${validRows.length} записей`}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}



/*  Main Page  */

export default function EntResultsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "umo_head";

  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("2026-02");
  const [search, setSearch] = useState("");
  
  const [editStudent, setEditStudent] = useState<{ id: number; full_name: string; month?: string } | null>(null);
  
  const [xlsxImportOpen, setXlsxImportOpen] = useState(false);
  const [realEntImportOpen, setRealEntImportOpen] = useState(false);
  
  // Matrix specific state
  const [showMatrixSubjects, setShowMatrixSubjects] = useState(false);
  const [hiddenMatrixMonths, setHiddenMatrixMonths] = useState<Set<string>>(new Set());

  // Enhanced filters & sorting
  const [sortColumn, setSortColumn] = useState<string>("total");
  const [matrixSortCol, setMatrixSortCol] = useState<string>("name");
  const [matrixSortDir, setMatrixSortDir] = useState<"asc" | "desc">("asc");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [scoreRange, setScoreRange] = useState<[number, number]>([0, TOTAL_MAX]);
  const [performanceFilter, setPerformanceFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [profileFilter, setProfileFilter] = useState<string>("all");
  const [dataMode, setDataMode] = useState<"training" | "real">("training");
  const [statusFilter, setStatusFilter] = useState("active");
  const [activeTab, setActiveTab] = useState("table");

  useEffect(() => {
    fetchGroups().then(g => { setGroups(g); setSelectedGroupId("all"); });
  }, []);

  const { data: allData = [], isLoading: isLoadingAll } = useAllEntResults(selectedGroupId || 'all', statusFilter);
  const { data: rawData = [], isLoading: isLoadingCurrent } = useEntResults(selectedMonth, selectedGroupId || 'all', statusFilter);
  
  const loading = isLoadingAll || isLoadingCurrent;

  useEffect(() => {
    if (allData.length > 0) {
      const months = [...new Set(allData.map((r: any) => r.month))].sort();
      if (months.length > 0 && !months.includes(selectedMonth)) {
         setSelectedMonth(months[months.length - 1]);
      }
    }
  }, [allData, selectedMonth]);

  const isAllGroups = selectedGroupId === "all";
  const selectedGroup = useMemo(() => groups.find(g => String(g.id) === selectedGroupId), [groups, selectedGroupId]);
  const profileId: number = selectedGroup?.profile_id || 1;
  const profileSubjects = ENT_PROFILE_SUBJECTS[profileId] || ENT_PROFILE_SUBJECTS[1];

  // Map group_id тЖТ profile_id for looking up per-student profiles
  const groupProfileMap = useMemo(() => {
    const m: Record<number, number> = {};
    for (const g of groups) m[g.id] = g.profile_id;
    return m;
  }, [groups]);

  // student_id → group_id map for XLSX import P1/P2 resolution
  const studentGroupMap = useMemo(() => {
    const m: Record<number, number> = {};
    for (const r of allData) m[r.student_id] = r.group_id;
    return m;
  }, [allData]);

  // All available months with data
  const availableMonths = useMemo(() => {
    const ms = new Set<string>(); for (const r of allData) ms.add(r.month);
    return ACADEMIC_MONTHS.filter(m => ms.has(m.value));
  }, [allData]);

  // Available real ENT exam types with data
  const availableRealExamTypes = useMemo(() => {
    const ms = new Set<string>(); for (const r of allData) ms.add(r.month);
    return new Set(REAL_EXAM_TYPES.map(m => m.value).filter(v => ms.has(v)));
  }, [allData]);

  // Active month list for charts/progress tabs — switches by dataMode
  const activeMonthsList = useMemo(() =>
    dataMode === "real"
      ? REAL_EXAM_TYPES.filter(m => availableRealExamTypes.has(m.value))
      : availableMonths,
    [dataMode, availableMonths, availableRealExamTypes]
  );

  // allData filtered to the current mode's months
  const modeAllData = useMemo(() => {
    const active = new Set(activeMonthsList.map(m => m.value));
    return allData.filter(r => active.has(r.month));
  }, [allData, activeMonthsList]);

  // Previous month key
  const prevMonth = useMemo(() => {
    const idx = availableMonths.findIndex(m => m.value === selectedMonth);
    return idx > 0 ? availableMonths[idx - 1].value : null;
  }, [availableMonths, selectedMonth]);

  // Pivot raw data тЖТ student rows for current month
  const studentsTable = useMemo<StudentRow[]>(() => {
    const map: Record<number, StudentRow> = {};
    for (const r of rawData) {
      if (!map[r.student_id]) map[r.student_id] = { id: r.student_id, full_name: r.student_name, group_name: r.group_name, group_id: r.group_id, scores: {}, total: 0 };
      map[r.student_id].scores[r.subject_id] = r.score;
      map[r.student_id].total += r.score;
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [rawData]);

  // Previous month totals for delta calculation
  const prevTotals = useMemo<Record<number, number>>(() => {
    if (!prevMonth) return {};
    const map: Record<number, number> = {};
    for (const r of allData) {
      if (r.month !== prevMonth) continue;
      if (!map[r.student_id]) map[r.student_id] = 0;
      map[r.student_id] += r.score;
    }
    return map;
  }, [allData, prevMonth]);

  const filtered = useMemo(() => {
    let arr = studentsTable.filter(s => s.full_name.toLowerCase().includes(search.toLowerCase()));
    // Profile/direction filter
    if (profileFilter !== "all" && isAllGroups) {
      const pid = parseInt(profileFilter);
      arr = arr.filter(s => (groupProfileMap[s.group_id] || 1) === pid);
    }
    // Score range filter
    arr = arr.filter(s => s.total >= scoreRange[0] && s.total <= scoreRange[1]);
    // Performance level filter
    if (performanceFilter !== "all") {
      arr = arr.filter(s => {
        const pct = s.total / TOTAL_MAX;
        switch (performanceFilter) {
          case "high": return pct >= 0.8;
          case "medium": return pct >= 0.6 && pct < 0.8;
          case "low": return pct >= 0.4 && pct < 0.6;
          case "critical": return pct < 0.4;
          default: return true;
        }
      });
    }
    // Sorting
    arr.sort((a, b) => {
      let va: number, vb: number;
      if (sortColumn === "total") { va = a.total; vb = b.total; }
      else if (sortColumn === "name") { return sortDirection === "asc" ? a.full_name.localeCompare(b.full_name) : b.full_name.localeCompare(a.full_name); }
      else { const sid = parseInt(sortColumn); va = a.scores[sid] || 0; vb = b.scores[sid] || 0; }
      return sortDirection === "asc" ? va - vb : vb - va;
    });
    return arr;
  }, [studentsTable, search, scoreRange, performanceFilter, sortColumn, sortDirection, profileFilter, isAllGroups, groupProfileMap]);

  const activeDisplaySubjects = useMemo(() => {
    if (!isAllGroups) return profileSubjects;
    const activeIds = new Set<number>();
    for (const st of filtered) {
      Object.keys(st.scores).forEach(id => {
        if (st.scores[Number(id)] > 0) activeIds.add(Number(id));
      });
    }
    const allKnown = Array.from(new Map(Object.values(ENT_PROFILE_SUBJECTS).flat().map(s => [s.id, s])).values());
    return allKnown.filter(s => activeIds.has(s.id) || MANDATORY_SUBJECTS.find(m => m.id === s.id));
  }, [filtered, isAllGroups, profileSubjects]);

  const handleSort = useCallback((col: string) => {
    if (sortColumn === col) setSortDirection(d => d === "asc" ? "desc" : "asc");
    else { setSortColumn(col); setSortDirection("desc"); }
  }, [sortColumn]);

  function SortIcon({ col }: { col: string }) {
    if (sortColumn !== col) return <ChevronsUpDown className="h-3 w-3 ml-0.5 opacity-30" />;
    return sortDirection === "asc" ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />;
  }

  // ── Matrix Table Data (All Months & All Exam Types) ──
  const matrixMonths = useMemo(() => {
    const ms = new Set<string>();
    ACADEMIC_MONTHS.forEach(m => ms.add(m.value));
    REAL_EXAM_TYPES.forEach(m => ms.add(m.value));
    for (const r of allData) ms.add(r.month);
    
    return Array.from(ms).sort((a, b) => {
      if (a.startsWith("10") && !b.startsWith("10")) return 1;
      if (!a.startsWith("10") && b.startsWith("10")) return -1;
      return a.localeCompare(b);
    });
  }, [allData]);

  const matrixData = useMemo(() => {
    const sMap: Record<number, any> = {};
    for (const r of allData) {
      if (!sMap[r.student_id]) {
        sMap[r.student_id] = {
          id: r.student_id,
          name: r.student_name,
          group_id: r.group_id,
          scoresByMonth: {}
        };
      }
      if (!sMap[r.student_id].scoresByMonth[r.month]) {
        sMap[r.student_id].scoresByMonth[r.month] = { total: 0, scores: {} };
      }
      sMap[r.student_id].scoresByMonth[r.month].scores[r.subject_id] = r.score;
      sMap[r.student_id].scoresByMonth[r.month].total += r.score;
    }

    let arr = Object.values(sMap);

    // Filter by profile
    if (profileFilter !== "all" && isAllGroups) {
      const pid = parseInt(profileFilter);
      arr = arr.filter(st => (groupProfileMap[st.group_id] || 1) === pid);
    }

    // Filter by search
    if (search) {
      arr = arr.filter(st => st.name.toLowerCase().includes(search.toLowerCase()));
    }

    // Filter by score range and performance (using their best month's total)
    if (scoreRange[0] > 0 || scoreRange[1] < TOTAL_MAX || performanceFilter !== "all") {
      arr = arr.filter(st => {
        let maxTotal = 0;
        for (const m in st.scoresByMonth) {
          if (st.scoresByMonth[m].total > maxTotal) maxTotal = st.scoresByMonth[m].total;
        }
        if (maxTotal < scoreRange[0] || maxTotal > scoreRange[1]) return false;
        if (performanceFilter !== "all") {
          const pct = maxTotal / TOTAL_MAX;
          switch (performanceFilter) {
            case "high": return pct >= 0.8;
            case "medium": return pct >= 0.6 && pct < 0.8;
            case "low": return pct >= 0.4 && pct < 0.6;
            case "critical": return pct < 0.4;
            default: return true;
          }
        }
        return true;
      });
    }

    // Progress
    arr.forEach(st => {
      let prevTotal = 0;
      for (const m of matrixMonths) {
        if (st.scoresByMonth[m]) {
          const cur = st.scoresByMonth[m].total;
          if (prevTotal > 0) {
            st.scoresByMonth[m].progress = cur - prevTotal;
          }
          prevTotal = cur;
        }
      }
    });
    
    // Sort
    arr.sort((a, b) => {
      if (matrixSortCol === "name") {
        return matrixSortDir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      } else {
        const valA = a.scoresByMonth[matrixSortCol]?.total || 0;
        const valB = b.scoresByMonth[matrixSortCol]?.total || 0;
        return matrixSortDir === "asc" ? valA - valB : valB - valA;
      }
    });

    return arr;
  }, [allData, matrixMonths, search, profileFilter, isAllGroups, groupProfileMap, scoreRange, performanceFilter, matrixSortCol, matrixSortDir]);

  const monthsWithData = useMemo(() => {
    const s = new Set<string>();
    for (const st of matrixData) {
      for (const m of Object.keys(st.scoresByMonth)) {
        if (st.scoresByMonth[m].total > 0) s.add(m);
      }
    }
    return s;
  }, [matrixData]);

  // Summary averages
  const averages = useMemo(() => {
    if (filtered.length === 0) return null;
    const displaySubjects = activeDisplaySubjects;
    const sums: Record<number, number> = {};
    displaySubjects.forEach(s => (sums[s.id] = 0));
    let totalSum = 0;
    let prof1Sum = 0, prof2Sum = 0;
    for (const st of filtered) {
      for (const s of displaySubjects) sums[s.id] += st.scores[s.id] || 0;
      totalSum += st.total;
      if (isAllGroups) {
        const pid = groupProfileMap[st.group_id] || 1;
        const ps = (ENT_PROFILE_SUBJECTS[pid] || []).slice(3);
        if (ps[0]) prof1Sum += st.scores[ps[0].id] || 0;
        if (ps[1]) prof2Sum += st.scores[ps[1].id] || 0;
      }
    }
    const n = filtered.length;
    return {
      subjects: displaySubjects.map(s => ({ ...s, avg: Math.round(sums[s.id] / n) })),
      totalAvg: Math.round(totalSum / n), count: n,
      prof1Avg: isAllGroups ? Math.round(prof1Sum / n) : 0,
      prof2Avg: isAllGroups ? Math.round(prof2Sum / n) : 0,
    };
  }, [filtered, profileSubjects, isAllGroups, groupProfileMap]);

  // тФАтФАтФАтФА All-students progress data тФАтФАтФАтФА
  const allStudentsProgress = useMemo(() => {
    // Per student: first total, last total, all month-totals
    const studentMonths: Record<number, Record<string, number>> = {};
    const studentNames: Record<number, string> = {};
    for (const r of modeAllData) {
      studentNames[r.student_id] = r.student_name;
      if (!studentMonths[r.student_id]) studentMonths[r.student_id] = {};
      if (!studentMonths[r.student_id][r.month]) studentMonths[r.student_id][r.month] = 0;
      studentMonths[r.student_id][r.month] += r.score;
    }
    const months = activeMonthsList.map(m => m.value);
    return Object.entries(studentMonths).map(([sid, mScores]) => {
      const id = parseInt(sid);
      const sortedMonths = months.filter(m => mScores[m] > 0);
      const first = sortedMonths.length > 0 ? mScores[sortedMonths[0]] : 0;
      const last = sortedMonths.length > 0 ? mScores[sortedMonths[sortedMonths.length - 1]] : 0;
      const growth = last - first;
      const monthData = months.map(m => mScores[m] || 0);
      return { id, name: studentNames[id], first, last, growth, monthData, sortedMonths };
    }).sort((a, b) => b.last - a.last);
  }, [modeAllData, activeMonthsList]);

  

  // ══════ TOPS / LEADERBOARD DATA ══════

  // Top by total for current month
  const topByTotal = useMemo(() =>
    [...studentsTable].sort((a, b) => b.total - a.total).slice(0, 10),
    [studentsTable]);

  // Top by each subject for current month
  const topBySubject = useMemo(() => {
    const displaySubjects = activeDisplaySubjects;
    return displaySubjects.map(subj => {
      const ranked = [...studentsTable]
        .filter(s => s.scores[subj.id] != null)
        .sort((a, b) => (b.scores[subj.id] || 0) - (a.scores[subj.id] || 0))
        .slice(0, 5);
      return { subject: subj, students: ranked };
    });
  }, [studentsTable, profileSubjects, isAllGroups]);

  // Most improved: compare last two months with data for each student
  const mostImproved = useMemo(() => {
    // Build per-student per-month totals from modeAllData
    const studentMonths: Record<number, Record<string, number>> = {};
    const studentNames: Record<number, string> = {};
    const studentGroups: Record<number, number> = {};
    for (const r of modeAllData) {
      studentNames[r.student_id] = r.student_name;
      studentGroups[r.student_id] = r.group_id;
      if (!studentMonths[r.student_id]) studentMonths[r.student_id] = {};
      if (!studentMonths[r.student_id][r.month]) studentMonths[r.student_id][r.month] = 0;
      studentMonths[r.student_id][r.month] += r.score;
    }
    const months = activeMonthsList.map(m => m.value);
    return Object.entries(studentMonths)
      .map(([sid, mScores]) => {
        const id = parseInt(sid);
        // Only months where student actually has data
        const withData = months.filter(m => mScores[m] > 0);
        if (withData.length < 2) return null;
        const prev = mScores[withData[withData.length - 2]];
        const last = mScores[withData[withData.length - 1]];
        const growth = last - prev;
        return { id, name: studentNames[id], prev, last, growth, prevMonth: withData[withData.length - 2], lastMonth: withData[withData.length - 1], group_id: studentGroups[id] };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null && s.growth !== 0)
      .sort((a, b) => b.growth - a.growth)
      .slice(0, 10);
  }, [modeAllData, activeMonthsList]);

  // Group rankings (average total per group)
  const groupRankings = useMemo(() => {
    const sums: Record<number, { name: string; sum: number; count: number; profile_id: number }> = {};
    for (const st of studentsTable) {
      if (!sums[st.group_id]) sums[st.group_id] = { name: st.group_name, sum: 0, count: 0, profile_id: groupProfileMap[st.group_id] || 1 };
      sums[st.group_id].sum += st.total;
      sums[st.group_id].count++;
    }
    return Object.entries(sums)
      .map(([id, d]) => ({ id: parseInt(id), ...d, avg: Math.round(d.sum / d.count) }))
      .sort((a, b) => b.avg - a.avg);
  }, [studentsTable, groupProfileMap]);

  // Score distribution histogram
  const scoreDistribution = useMemo(() => {
    const brackets = [
      { label: "0-30", min: 0, max: 30, count: 0, color: "#ef4444" },
      { label: "31-55", min: 31, max: 55, count: 0, color: "#f97316" },
      { label: "56-83", min: 56, max: 83, count: 0, color: "#eab308" },
      { label: "84-111", min: 84, max: 111, count: 0, color: "#3b82f6" },
      { label: "112-140", min: 112, max: 140, count: 0, color: "#22c55e" },
    ];
    for (const st of studentsTable) {
      const b = brackets.find(br => st.total >= br.min && st.total <= br.max);
      if (b) b.count++;
    }
    return brackets;
  }, [studentsTable]);

  // Achievement counts
  const achievements = useMemo(() => {
    const total = studentsTable.length;
    if (total === 0) return null;
    const high = studentsTable.filter(s => s.total / TOTAL_MAX >= 0.8).length;
    const medium = studentsTable.filter(s => { const p = s.total / TOTAL_MAX; return p >= 0.6 && p < 0.8; }).length;
    const low = studentsTable.filter(s => { const p = s.total / TOTAL_MAX; return p >= 0.4 && p < 0.6; }).length;
    const critical = studentsTable.filter(s => s.total / TOTAL_MAX < 0.4).length;
    const maxScore = studentsTable.length > 0 ? Math.max(...studentsTable.map(s => s.total)) : 0;
    const minScore = studentsTable.length > 0 ? Math.min(...studentsTable.map(s => s.total)) : 0;
    const avgScore = Math.round(studentsTable.reduce((s, st) => s + st.total, 0) / total);
    const median = total > 0 ? [...studentsTable].sort((a, b) => a.total - b.total)[Math.floor(total / 2)].total : 0;
    return { total, high, medium, low, critical, maxScore, minScore, avgScore, median };
  }, [studentsTable]);

  // ══════ SUBJECT ANALYSIS DATA ══════
  const subjectAnalysis = useMemo(() => {
    const displaySubjects = activeDisplaySubjects;
    const months = activeMonthsList.map(m => m.value);
    if (months.length === 0 || modeAllData.length === 0) return [];

    return displaySubjects.map(subj => {
      // Per-month stats
      const monthlyStats = months.map(m => {
        const scores = modeAllData.filter(r => r.month === m && r.subject_id === subj.id).map(r => r.score);
        if (scores.length === 0) return { month: m, monthShort: MONTH_SHORT[m] || m, monthLabel: MONTH_LABELS[m] || m, avg: 0, max: 0, min: 0, count: 0, pct: 0 };
        const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        const max = Math.max(...scores);
        const min = Math.min(...scores);
        return { month: m, monthShort: MONTH_SHORT[m] || m, monthLabel: MONTH_LABELS[m] || m, avg, max, min, count: scores.length, pct: Math.round(avg / subj.max * 100) };
      }).filter(s => s.count > 0);

      // Current month data (or last available)
      const currentMonthData = monthlyStats.find(m => m.month === selectedMonth) || monthlyStats[monthlyStats.length - 1];
      const prevMonthData = monthlyStats.length >= 2 ? monthlyStats[monthlyStats.length - 2] : null;
      const delta = currentMonthData && prevMonthData ? currentMonthData.avg - prevMonthData.avg : null;

      // Score distribution for current month
      const currentScores = modeAllData.filter(r => r.month === selectedMonth && r.subject_id === subj.id);
      const dist = [
        { label: `0-${Math.round(subj.max * 0.4) - 1}`, count: 0, color: "#ef4444" },
        { label: `${Math.round(subj.max * 0.4)}-${Math.round(subj.max * 0.6) - 1}`, count: 0, color: "#f97316" },
        { label: `${Math.round(subj.max * 0.6)}-${Math.round(subj.max * 0.8) - 1}`, count: 0, color: "#3b82f6" },
        { label: `${Math.round(subj.max * 0.8)}-${subj.max}`, count: 0, color: "#22c55e" },
      ];
      for (const r of currentScores) {
        const pct = r.score / subj.max;
        if (pct >= 0.8) dist[3].count++;
        else if (pct >= 0.6) dist[2].count++;
        else if (pct >= 0.4) dist[1].count++;
        else dist[0].count++;
      }

      // Top 5 students for this subject (current month)
      const top5 = [...currentScores]
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(r => ({ name: r.student_name, score: r.score, group: r.group_name }));

      // Bottom 5
      const bottom5 = [...currentScores]
        .sort((a, b) => a.score - b.score)
        .slice(0, 5)
        .map(r => ({ name: r.student_name, score: r.score, group: r.group_name }));

      return {
        subject: subj,
        monthlyStats,
        currentMonth: currentMonthData,
        delta,
        distribution: dist,
        top5,
        bottom5,
        totalStudents: currentScores.length,
      };
    });
  }, [modeAllData, activeMonthsList, profileSubjects, isAllGroups, selectedMonth]);

  // Profile-specific subjects analysis (for "all groups" mode)
  const profileSubjectAnalysis = useMemo(() => {
    if (!isAllGroups) return [];
    const allProfileSubjects = new Map<number, { id: number; name: string; short: string; max: number }>();
    for (const pid of [1, 2, 3]) {
      for (const s of (ENT_PROFILE_SUBJECTS[pid] || []).slice(3)) {
        if (!allProfileSubjects.has(s.id)) allProfileSubjects.set(s.id, s);
      }
    }
    const months = activeMonthsList.map(m => m.value);
    return [...allProfileSubjects.values()].map(subj => {
      const monthlyStats = months.map(m => {
        const scores = modeAllData.filter(r => r.month === m && r.subject_id === subj.id).map(r => r.score);
        if (scores.length === 0) return { month: m, monthShort: MONTH_SHORT[m] || m, monthLabel: MONTH_LABELS[m] || m, avg: 0, max: 0, min: 0, count: 0, pct: 0 };
        const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        return { month: m, monthShort: MONTH_SHORT[m] || m, monthLabel: MONTH_LABELS[m] || m, avg, max: Math.max(...scores), min: Math.min(...scores), count: scores.length, pct: Math.round(avg / subj.max * 100) };
      }).filter(s => s.count > 0);
      const currentScores = modeAllData.filter(r => r.month === selectedMonth && r.subject_id === subj.id);
      const top5 = [...currentScores].sort((a, b) => b.score - a.score).slice(0, 5).map(r => ({ name: r.student_name, score: r.score, group: r.group_name }));
      const currentMonth = monthlyStats.find(m => m.month === selectedMonth) || monthlyStats[monthlyStats.length - 1];
      const prevIdx = monthlyStats.length >= 2 ? monthlyStats.length - 2 : -1;
      const delta = currentMonth && prevIdx >= 0 ? currentMonth.avg - monthlyStats[prevIdx].avg : null;
      return { subject: subj, monthlyStats, currentMonth, delta, top5, totalStudents: currentScores.length };
    });
  }, [modeAllData, activeMonthsList, isAllGroups, selectedMonth]);

  

  const handleSaveScores = useCallback(async (scores: { student_id: number; subject_id: number; score: number; month: string }[]) => {
    await saveEntResultsBatch(scores);
    const gid = selectedGroupId === "all" ? undefined : parseInt(selectedGroupId);
  }, [selectedGroupId, selectedMonth]);

  const handleDeleteScores = useCallback(async (student_id: number, month: string) => {
    await deleteEntResults(student_id, month);
    const gid = selectedGroupId === "all" ? undefined : parseInt(selectedGroupId);
  }, [selectedGroupId, selectedMonth]);

  return (
    <div>
      <Tabs value={activeTab} onValueChange={setActiveTab as any} className="w-full space-y-4">
        {/* 1. TABS LIST AT THE VERY TOP */}
        <TabsList className="mb-2 bg-muted/50 p-1 w-full flex-wrap h-auto justify-start sticky top-0 z-20 backdrop-blur-md">
          <TabsTrigger value="table" className="data-[state=active]:bg-background data-[state=active]:shadow-sm"><Users className="h-4 w-4 mr-1.5" />Таблица баллов (ЕНТ)</TabsTrigger>
          <TabsTrigger value="tops" className="data-[state=active]:bg-background data-[state=active]:shadow-sm"><Trophy className="h-4 w-4 mr-1.5" />Топы</TabsTrigger>
          <TabsTrigger value="subjects" className="data-[state=active]:bg-background data-[state=active]:shadow-sm"><BookOpen className="h-4 w-4 mr-1.5" />Предметы</TabsTrigger>
          <TabsTrigger value="progress" className="data-[state=active]:bg-background data-[state=active]:shadow-sm"><TrendingUp className="h-4 w-4 mr-1.5" />ЕНТ Результаты</TabsTrigger>
          <TabsTrigger value="analytics" className="data-[state=active]:bg-background data-[state=active]:shadow-sm"><BarChart3 className="h-4 w-4 mr-1.5" />Динамика</TabsTrigger>
        </TabsList>

        {/* 2. GLOBAL CONTROLS */}
        <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2">
          {/* Group filter (always shown) */}
          <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
            <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Группа" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все группы</SelectItem>
              {groups.map((g: any) => (
                <SelectItem key={g.id} value={String(g.id)}>
                  <span className="flex items-center gap-1.5">
                    <GroupPersonAvatar groupName={g.name} avatarUrl={g.avatar_url} size={18} showTooltip={false} />
                    {g.name}
                    {g.profile_name && <span className="text-muted-foreground ml-1">({g.profile_name})</span>}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Month filter (only shown if not in table) */}
          {activeTab !== "table" && (
            <Select 
              value={selectedMonth} 
              onValueChange={v => {
                setSelectedMonth(v);
                if (REAL_EXAM_TYPES.some(t => t.value === v)) {
                  setDataMode("real");
                } else {
                  setDataMode("training");
                }
              }}
            >
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Выберите месяц / экзамен" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel className="flex items-center gap-2 text-muted-foreground bg-muted/30 py-1.5 px-2">
                    <PenLine className="h-3.5 w-3.5" /> Пробные ЕНТ (Внутренние)
                  </SelectLabel>
                  {ACADEMIC_MONTHS.map(m => (
                    <SelectItem key={m.value} value={m.value} className="pl-6">
                      {m.label}
                      {!availableMonths.some(am => am.value === m.value) && <span className="ml-2 text-[10px] text-muted-foreground opacity-50">(нет данных)</span>}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel className="flex items-center gap-2 text-primary bg-primary/5 py-1.5 px-2 mt-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Реальные ЕНТ (Официальные)
                  </SelectLabel>
                  {REAL_EXAM_TYPES.map(m => (
                    <SelectItem key={m.value} value={m.value} className="pl-6">
                      {m.label}
                      {!availableRealExamTypes.has(m.value) && <span className="ml-2 text-[10px] text-muted-foreground opacity-50">(нет данных)</span>}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Dialogs can go here */}
        {editStudent && (() => {
          // We use editStudent.month if specified (from matrix cell), else fallback to selectedMonth
          const activeDialogMonth = editStudent.month || selectedMonth;
          // To find current scores, look in allData instead of studentsTable (since studentsTable is only for selectedMonth)
          const currentScores: Record<number, number> = {};
          allData.filter(r => r.student_id === editStudent.id && r.month === activeDialogMonth).forEach(r => {
            currentScores[r.subject_id] = r.score;
          });
          
          let editProfileId = profileId;
          const studentRow = allData.find(r => r.student_id === editStudent.id);
          if (studentRow) editProfileId = groupProfileMap[studentRow.group_id] || profileId;

          return (
            <ScoreEditorDialog student={editStudent} month={activeDialogMonth} profileId={editProfileId}
              currentScores={currentScores}
              onSave={handleSaveScores} onDelete={handleDeleteScores} onClose={() => setEditStudent(null)} />
          );
        })()}
        
        <RealEntImportDialog
          open={realEntImportOpen}
          onOpenChange={setRealEntImportOpen}
          groups={groups}
          onSuccess={async (savedExamType) => {
            setSelectedMonth(savedExamType);
            setDataMode("real");

          }}
        />

        <EntXlsxImportDialog
          open={xlsxImportOpen}
          onOpenChange={setXlsxImportOpen}
          groups={groups}
          groupProfileMap={groupProfileMap}
          studentGroupMap={studentGroupMap}
          onSuccess={async (savedMonth, isReal) => {
            setSelectedMonth(savedMonth);
            setDataMode(isReal ? "real" : "training");

          }}
        />

        {/* TABS CONTENT */}
        {/* ══════ MATRIX TABLE TAB ══════ */}
        <TabsContent value="table" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <EntMatrixTab
            allData={allData}
            search={search}
            setSearch={setSearch}
            profileFilter={profileFilter}
            setProfileFilter={setProfileFilter}
            isAllGroups={isAllGroups}
            groupProfileMap={groupProfileMap}
            scoreRange={scoreRange}
            setScoreRange={setScoreRange}
            performanceFilter={performanceFilter}
            setPerformanceFilter={setPerformanceFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            groups={groups}
            isAdmin={isAdmin}
            dataMode={dataMode}
            setXlsxImportOpen={setXlsxImportOpen}
            setRealEntImportOpen={setRealEntImportOpen}
            setEditStudent={setEditStudent}
            loading={loading}
          />
        </TabsContent>

        {/* ══════ TOPS / LEADERBOARD TAB ══════ */}
        <TabsContent value="tops">
          {studentsTable.length === 0 ? (
            <Card className="text-center py-16"><CardContent>
              <Trophy className="h-12 w-12 mx-auto text-muted-foreground/20 mb-3" />
              <p className="text-muted-foreground">Нет данных для рейтинга</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-6">
              {/* Stats overview */}
              {achievements && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                  <Card><CardContent className="p-3 text-center">
                    <p className="text-[10px] text-muted-foreground">Учеников</p>
                    <p className="text-xl font-bold">{achievements.total}</p>
                  </CardContent></Card>
                  <Card><CardContent className="p-3 text-center">
                    <p className="text-[10px] text-muted-foreground">Средний</p>
                    <p className={`text-xl font-bold ${getScoreColor(achievements.avgScore, TOTAL_MAX)}`}>{achievements.avgScore}</p>
                  </CardContent></Card>
                  <Card><CardContent className="p-3 text-center">
                    <p className="text-[10px] text-muted-foreground">Медиана</p>
                    <p className={`text-xl font-bold ${getScoreColor(achievements.median, TOTAL_MAX)}`}>{achievements.median}</p>
                  </CardContent></Card>
                  <Card><CardContent className="p-3 text-center">
                    <p className="text-[10px] text-muted-foreground">Макс</p>
                    <p className="text-xl font-bold text-green-600">{achievements.maxScore}</p>
                  </CardContent></Card>
                  <Card className="bg-green-50 dark:bg-green-950/30"><CardContent className="p-3 text-center">
                    <p className="text-[10px] text-muted-foreground">≥80%</p>
                    <p className="text-xl font-bold text-green-600">{achievements.high}</p>
                  </CardContent></Card>
                  <Card className="bg-blue-50 dark:bg-blue-950/30"><CardContent className="p-3 text-center">
                    <p className="text-[10px] text-muted-foreground">60-79%</p>
                    <p className="text-xl font-bold text-blue-600">{achievements.medium}</p>
                  </CardContent></Card>
                  <Card className="bg-orange-50 dark:bg-orange-950/30"><CardContent className="p-3 text-center">
                    <p className="text-[10px] text-muted-foreground">40-59%</p>
                    <p className="text-xl font-bold text-orange-600">{achievements.low}</p>
                  </CardContent></Card>
                  <Card className="bg-red-50 dark:bg-red-950/30"><CardContent className="p-3 text-center">
                    <p className="text-[10px] text-muted-foreground">&lt;40%</p>
                    <p className="text-xl font-bold text-red-600">{achievements.critical}</p>
                  </CardContent></Card>
                </div>
              )}

              {/* Score distribution histogram */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2"><Hash className="h-4 w-4" />Распределение баллов</CardTitle>
                  <p className="text-xs text-muted-foreground">Количество учеников в каждом диапазоне</p>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={scoreDistribution} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <RechartsTooltip contentStyle={{ fontSize: 13, borderRadius: 8 }} formatter={(v: number) => [v, "Учеников"]} />
                      {scoreDistribution.map((_, i) => null)}
                      <Bar dataKey="count" name="Учеников" radius={[4, 4, 0, 0]}>
                        {scoreDistribution.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                        <LabelList dataKey="count" position="top" fontSize={12} fontWeight={600} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* 🏆 Top 10 by total */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-yellow-500" />Топ-10 по общему баллу
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">{MONTH_LABELS[selectedMonth] || selectedMonth}</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {topByTotal.map((st, idx) => (
                      <div key={st.id} className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                          style={{ background: idx === 0 ? "#fbbf24" : idx === 1 ? "#94a3b8" : idx === 2 ? "#d97706" : "transparent",
                            color: idx < 3 ? "#fff" : "inherit" }}>
                          {idx < 3 ? (idx === 0 ? <Crown className="h-3.5 w-3.5" /> : idx === 1 ? <Medal className="h-3.5 w-3.5" /> : <Award className="h-3.5 w-3.5" />) : idx + 1}
                        </div>
                        <span className="flex-1 text-sm font-medium truncate">{st.full_name}</span>
                        {isAllGroups && <span className="text-xs text-muted-foreground">{st.group_name}</span>}
                        <span className={`font-bold text-sm ${getScoreColor(st.total, TOTAL_MAX)}`}>{st.total}</span>
                        <div className="w-16">
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${getScoreBg(st.total, TOTAL_MAX)}`}
                              style={{ width: `${Math.round(st.total / TOTAL_MAX * 100)}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                    {topByTotal.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Нет данных</p>}
                  </CardContent>
                </Card>

                {/* 🔥 Most improved */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Flame className="h-4 w-4 text-orange-500" />Лидеры роста
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">Наибольший прогресс с первого месяца</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {mostImproved.map((st, idx) => (
                      <div key={st.id} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-4">{idx + 1}</span>
                        <span className="flex-1 text-sm font-medium truncate">{st.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {st.prev} → {st.last}
                          <span className="opacity-60 ml-1">({MONTH_SHORT[st.prevMonth]} → {MONTH_SHORT[st.lastMonth]})</span>
                        </span>
                        <Badge variant={st.growth > 0 ? "default" : "destructive"}
                          className={`text-xs ${st.growth > 0 ? "bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900 dark:text-green-300" : ""}`}>
                          {st.growth > 0 ? "+" : ""}{st.growth}
                        </Badge>
                      </div>
                    ))}
                    {mostImproved.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Нужны данные за 2+ месяцев</p>}
                  </CardContent>
                </Card>
              </div>

              {/* 🏅 Group rankings */}
              {groupRankings.length > 1 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Star className="h-4 w-4 text-primary" />Рейтинг групп
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">Средний балл по группам · {MONTH_LABELS[selectedMonth]}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {groupRankings.map((g, idx) => (
                        <div key={g.id} className="flex items-center gap-3">
                          <span className="text-sm font-bold w-5 text-center"
                            style={{ color: idx === 0 ? "#fbbf24" : idx === 1 ? "#94a3b8" : idx === 2 ? "#d97706" : "inherit" }}>
                            {idx + 1}
                          </span>
                          <span className="flex-1 text-sm font-medium">{g.name}</span>
                          <span className="text-xs text-muted-foreground">{g.count} уч.</span>
                          <span className={`font-bold text-sm ${getScoreColor(g.avg, TOTAL_MAX)}`}>{g.avg}</span>
                          <div className="w-24">
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${getScoreBg(g.avg, TOTAL_MAX)}`}
                                style={{ width: `${Math.round(g.avg / TOTAL_MAX * 100)}%` }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 📊 Top by each subject */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {topBySubject.map(({ subject: subj, students }) => (
                  <Card key={subj.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Target className="h-4 w-4" />{subj.name}
                        <Badge variant="outline" className="ml-auto text-[10px]">/ {subj.max}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1.5">
                      {students.map((st, idx) => (
                        <div key={st.id} className="flex items-center gap-2">
                          <span className="text-xs w-4 text-muted-foreground font-medium"
                            style={{ color: idx === 0 ? "#fbbf24" : idx === 1 ? "#94a3b8" : idx === 2 ? "#d97706" : undefined }}>
                            {idx + 1}
                          </span>
                          <span className="flex-1 text-sm truncate">{st.full_name}</span>
                          <span className={`text-sm font-bold ${getScoreColor(st.scores[subj.id] || 0, subj.max)}`}>
                            {st.scores[subj.id] || 0}
                          </span>
                        </div>
                      ))}
                      {students.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Нет данных</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ══════ SUBJECTS ANALYSIS TAB ══════ */}
        <TabsContent value="subjects">
          {subjectAnalysis.length === 0 ? (
            <Card className="text-center py-16"><CardContent>
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/20 mb-3" />
              <p className="text-muted-foreground">Нет данных по предметам</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-6">
              {/* Summary cards: avg per subject for current month */}
              <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                {subjectAnalysis.map(sa => (
                  <Card key={sa.subject.id} className={sa.currentMonth && sa.currentMonth.pct >= 80 ? "border-green-200 dark:border-green-800" : sa.currentMonth && sa.currentMonth.pct < 40 ? "border-red-200 dark:border-red-800" : ""}>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground mb-1">{sa.subject.name}</p>
                      <div className="flex items-end gap-2">
                        <span className={`text-2xl font-bold ${sa.currentMonth ? getScoreColor(sa.currentMonth.avg, sa.subject.max) : "text-muted-foreground"}`}>
                          {sa.currentMonth?.avg ?? "—"}
                        </span>
                        <span className="text-xs text-muted-foreground mb-1">/ {sa.subject.max}</span>
                        {sa.delta != null && sa.delta !== 0 && <DeltaBadge delta={sa.delta} />}
                      </div>
                      {sa.currentMonth && (
                        <div className="mt-2">
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${getScoreBg(sa.currentMonth.avg, sa.subject.max)}`}
                              style={{ width: `${sa.currentMonth.pct}%` }} />
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="text-[10px] text-muted-foreground">min {sa.currentMonth.min}</span>
                            <span className="text-[10px] text-muted-foreground">{sa.currentMonth.pct}%</span>
                            <span className="text-[10px] text-muted-foreground">max {sa.currentMonth.max}</span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Subject trend chart: all subjects average by month */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />Динамика средних баллов по предметам
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Средний балл (% от макс.) по каждому предмету за все месяцы</p>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                      data={(() => {
                        const months = availableMonths.map(m => m.value);
                        return months.map(m => {
                          const point: Record<string, string | number> = { month: MONTH_SHORT[m] || m, monthFull: MONTH_LABELS[m] || m };
                          for (const sa of subjectAnalysis) {
                            const ms = sa.monthlyStats.find(s => s.month === m);
                            if (ms) point[sa.subject.short] = ms.pct;
                          }
                          return point;
                        });
                      })()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
                      <RechartsTooltip contentStyle={{ fontSize: 13, borderRadius: 8 }}
                        labelFormatter={label => {
                          const months = availableMonths.map(m => m.value);
                          const idx = months.findIndex(m => MONTH_SHORT[m] === label);
                          return idx >= 0 ? MONTH_LABELS[months[idx]] : label;
                        }}
                        formatter={(v: number, name: string) => [`${v}%`, name]} />
                      <Legend />
                      {subjectAnalysis.map((sa, i) => (
                        <Line key={sa.subject.id} type="monotone" dataKey={sa.subject.short} name={sa.subject.name}
                          stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2.5}
                          dot={{ r: 4, fill: CHART_COLORS[i % CHART_COLORS.length] }} connectNulls />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Detailed cards per subject */}
              {subjectAnalysis.map((sa, saIdx) => (
                <Card key={sa.subject.id}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Target className="h-4 w-4" />{sa.subject.name}
                      <Badge variant="outline" className="ml-auto">макс. {sa.subject.max}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {/* Monthly bar chart */}
                      <div className="lg:col-span-2">
                        <p className="text-xs text-muted-foreground mb-2">Средний балл по месяцам</p>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={sa.monthlyStats} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="monthShort" tick={{ fontSize: 11 }} />
                            <YAxis domain={[0, sa.subject.max]} tick={{ fontSize: 11 }} />
                            <RechartsTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }}
                              formatter={(v: number) => [v, "Средний балл"]}
                              labelFormatter={label => {
                                const ms = sa.monthlyStats.find(s => s.monthShort === label);
                                return ms?.monthLabel || label;
                              }} />
                            <Bar dataKey="avg" name="Средний" radius={[4, 4, 0, 0]}>
                              {sa.monthlyStats.map((ms, i) => (
                                <Cell key={i} fill={getScoreBg(ms.avg, sa.subject.max).replace("bg-", "") === "green-500" ? "#22c55e" : getScoreBg(ms.avg, sa.subject.max).replace("bg-", "") === "blue-500" ? "#3b82f6" : getScoreBg(ms.avg, sa.subject.max).replace("bg-", "") === "orange-500" ? "#f97316" : "#ef4444"} />
                              ))}
                              <LabelList dataKey="avg" position="top" fontSize={11} fontWeight={600} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Top 5 for this subject */}
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Топ-5 · {MONTH_LABELS[selectedMonth]}</p>
                        <div className="space-y-1.5">
                          {sa.top5.map((st, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <span className="text-xs w-4 font-medium"
                                style={{ color: idx === 0 ? "#fbbf24" : idx === 1 ? "#94a3b8" : idx === 2 ? "#d97706" : undefined }}>
                                {idx + 1}
                              </span>
                              <span className="flex-1 text-sm truncate">{st.name}</span>
                              <span className={`text-sm font-bold ${getScoreColor(st.score, sa.subject.max)}`}>{st.score}</span>
                            </div>
                          ))}
                          {sa.top5.length === 0 && <p className="text-xs text-muted-foreground">Нет данных</p>}
                        </div>

                        {sa.bottom5.length > 0 && sa.totalStudents > 5 && (
                          <>
                            <p className="text-xs text-muted-foreground mb-2 mt-4">Нужна помощь</p>
                            <div className="space-y-1.5">
                              {sa.bottom5.map((st, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <span className="text-xs w-4 text-muted-foreground">{sa.totalStudents - sa.bottom5.length + idx + 1}</span>
                                  <span className="flex-1 text-sm truncate">{st.name}</span>
                                  <span className={`text-sm font-bold ${getScoreColor(st.score, sa.subject.max)}`}>{st.score}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Distribution row */}
                    <div className="mt-4 pt-3 border-t">
                      <p className="text-xs text-muted-foreground mb-2">Распределение баллов · {MONTH_LABELS[selectedMonth]}</p>
                      <div className="flex gap-2">
                        {sa.distribution.map((d, i) => (
                          <div key={i} className="flex-1">
                            <div className="text-center mb-1">
                              <span className="text-lg font-bold" style={{ color: d.color }}>{d.count}</span>
                            </div>
                            <div className="h-2 rounded-full" style={{ background: d.color, opacity: 0.2 }}>
                              <div className="h-full rounded-full" style={{ background: d.color, width: sa.totalStudents > 0 ? `${Math.round(d.count / sa.totalStudents * 100)}%` : "0%" }} />
                            </div>
                            <p className="text-[9px] text-muted-foreground text-center mt-0.5">{d.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Profile-specific subjects when viewing all groups */}
              {isAllGroups && profileSubjectAnalysis.length > 0 && (
                <>
                  <h3 className="text-sm font-semibold mt-2 flex items-center gap-2"><Target className="h-4 w-4" />Профильные предметы</h3>
                  {profileSubjectAnalysis.map(sa => (
                    <Card key={sa.subject.id}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Target className="h-4 w-4" />{sa.subject.name}
                          <Badge variant="outline" className="ml-auto">макс. {sa.subject.max}</Badge>
                          {sa.delta != null && sa.delta !== 0 && <DeltaBadge delta={sa.delta} />}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                          <div className="lg:col-span-2">
                            <ResponsiveContainer width="100%" height={180}>
                              <BarChart data={sa.monthlyStats} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="monthShort" tick={{ fontSize: 11 }} />
                                <YAxis domain={[0, sa.subject.max]} tick={{ fontSize: 11 }} />
                                <RechartsTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number) => [v, "Средний"]} />
                                <Bar dataKey="avg" name="Средний" radius={[4, 4, 0, 0]} fill={CHART_COLORS[0]}>
                                  <LabelList dataKey="avg" position="top" fontSize={11} fontWeight={600} />
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-2">Топ-5 · {MONTH_LABELS[selectedMonth]}</p>
                            <div className="space-y-1.5">
                              {sa.top5.map((st, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <span className="text-xs w-4 font-medium" style={{ color: idx === 0 ? "#fbbf24" : idx === 1 ? "#94a3b8" : idx === 2 ? "#d97706" : undefined }}>{idx + 1}</span>
                                  <span className="flex-1 text-sm truncate">{st.name}</span>
                                  <span className="text-xs text-muted-foreground">{st.group}</span>
                                  <span className={`text-sm font-bold ${getScoreColor(st.score, sa.subject.max)}`}>{st.score}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </>
              )}
            </div>
          )}
        </TabsContent>

        {/* ══════ ALL STUDENTS PROGRESS TAB ══════ */}
        <TabsContent value="progress">
          {allStudentsProgress.length === 0 ? (
            <Card className="text-center py-16"><CardContent>
              <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground/20 mb-3" />
              <p className="text-muted-foreground">Нет данных</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {/* Summary header */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
                <Card><CardContent className="p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">Учеников</p>
                  <p className="text-2xl font-bold text-primary">{allStudentsProgress.length}</p>
                </CardContent></Card>
                <Card><CardContent className="p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">Средний балл (посл.)</p>
                  <p className="text-2xl font-bold">{Math.round(allStudentsProgress.reduce((s, st) => s + st.last, 0) / allStudentsProgress.length)}</p>
                  <p className="text-[10px] text-muted-foreground">/ {TOTAL_MAX}</p>
                </CardContent></Card>
                <Card><CardContent className="p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">С ростом</p>
                  <p className="text-2xl font-bold text-green-600">{allStudentsProgress.filter(s => s.growth > 0).length}</p>
                </CardContent></Card>
                <Card><CardContent className="p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">Со снижением</p>
                  <p className="text-2xl font-bold text-red-600">{allStudentsProgress.filter(s => s.growth < 0).length}</p>
                </CardContent></Card>
              </div>

              {/* Student progress cards */}
              {allStudentsProgress.filter(s => s.name.toLowerCase().includes(search.toLowerCase())).map((st, idx) => (
                <Card key={st.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-5">{idx + 1}</span>
                        <span className="font-medium text-sm">{st.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className={`text-lg font-bold ${getScoreColor(st.last, TOTAL_MAX)}`}>{st.last}</span>
                          <span className="text-xs text-muted-foreground ml-1">/ {TOTAL_MAX}</span>
                        </div>
                        {st.growth !== 0 && (
                          <Badge variant={st.growth > 0 ? "default" : "destructive"} className={`text-xs ${st.growth > 0 ? "bg-green-100 text-green-700 hover:bg-green-100" : ""}`}>
                            {st.growth > 0 ? "+" : ""}{st.growth}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="relative h-2.5 bg-muted rounded-full overflow-hidden mb-2">
                      <div className={`absolute inset-y-0 left-0 rounded-full transition-all ${getScoreBg(st.last, TOTAL_MAX)}`} style={{ width: `${Math.round(st.last / TOTAL_MAX * 100)}%` }} />
                    </div>
                    {/* Mini sparkline: month totals */}
                    <div className="flex items-end gap-0.5 h-7">
                      {st.monthData.map((score, i) => {
                        const h = score > 0 ? Math.max(4, Math.round(score / TOTAL_MAX * 28)) : 0;
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                            {score > 0 && <div className={`w-full rounded-sm ${getScoreBg(score, TOTAL_MAX)} opacity-80`} style={{ height: h }} title={`${activeMonthsList[i]?.label || ""}: ${score}`} />}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-0.5 mt-0.5">
                      {activeMonthsList.map((m, i) => (
                        <div key={m.value} className="flex-1 text-center text-[8px] text-muted-foreground">{m.short}</div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ══════ ANALYTICS TAB ══════ */}
        <TabsContent value="analytics">
          <EntAnalyticsTab 
            modeAllData={modeAllData}
            activeMonthsList={activeMonthsList}
            profileSubjects={profileSubjects}
            isAllGroups={isAllGroups}
            activeDisplaySubjects={activeDisplaySubjects}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
