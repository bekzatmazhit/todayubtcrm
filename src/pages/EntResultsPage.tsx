import { useState, useEffect, useMemo, useCallback } from "react";
import {
  BarChart3, Users, TrendingUp, Edit, ArrowUp, ArrowDown, Minus,
  Trophy, Medal, Crown, Filter, ChevronsUpDown, ChevronUp, ChevronDown,
  Target, Star, Award, Flame, Hash, BookOpen,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Area, AreaChart, BarChart, Bar,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Cell, LabelList,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { fetchEntResults, fetchGroups, saveEntResultsBatch } from "@/lib/api";

/* ══════ Constants ══════ */

const TOTAL_MAX = 140; // 20 + 10 + 10 + 50 + 50

const ACADEMIC_MONTHS = [
  { value: "2025-09", label: "Сентябрь", short: "Сен" },
  { value: "2025-10", label: "Октябрь", short: "Окт" },
  { value: "2025-11", label: "Ноябрь", short: "Ноя" },
  { value: "2025-12", label: "Декабрь", short: "Дек" },
  { value: "2026-01", label: "Январь", short: "Янв" },
  { value: "2026-02", label: "Февраль", short: "Фев" },
  { value: "2026-03", label: "Март", short: "Мар" },
  { value: "2026-04", label: "Апрель", short: "Апр" },
  { value: "2026-05", label: "Май", short: "Май" },
];

const MONTH_LABELS: Record<string, string> = {};
const MONTH_SHORT: Record<string, string> = {};
for (const m of ACADEMIC_MONTHS) { MONTH_LABELS[m.value] = m.label; MONTH_SHORT[m.value] = m.short; }

// Profile → 5 ENT subjects (3 mandatory + 2 profile)
// История: max 20, Чтение: max 10, Мат.грам: max 10, Профильные: max 50
const ENT_PROFILE_SUBJECTS: Record<number, { id: number; name: string; short: string; max: number }[]> = {
  1: [ // Мат-Инфо (ИНФМАТ)
    { id: 1, name: "История Казахстана", short: "ИК", max: 20 },
    { id: 8, name: "Грамотность чтения", short: "ГЧ", max: 10 },
    { id: 3, name: "Мат. грамотность", short: "МГ", max: 10 },
    { id: 2, name: "Математика", short: "Мат", max: 50 },
    { id: 4, name: "Информатика", short: "Инф", max: 50 },
  ],
  2: [ // Мат-Физ (ФМ)
    { id: 1, name: "История Казахстана", short: "ИК", max: 20 },
    { id: 8, name: "Грамотность чтения", short: "ГЧ", max: 10 },
    { id: 3, name: "Мат. грамотность", short: "МГ", max: 10 },
    { id: 2, name: "Математика", short: "Мат", max: 50 },
    { id: 5, name: "Физика", short: "Физ", max: 50 },
  ],
  3: [ // Био-Хим (ХБ)
    { id: 1, name: "История Казахстана", short: "ИК", max: 20 },
    { id: 8, name: "Грамотность чтения", short: "ГЧ", max: 10 },
    { id: 3, name: "Мат. грамотность", short: "МГ", max: 10 },
    { id: 6, name: "Биология", short: "Био", max: 50 },
    { id: 7, name: "Химия", short: "Хим", max: 50 },
  ],
};

const MANDATORY_SUBJECTS = [
  { id: 1, name: "История Казахстана", short: "ИК", max: 20 },
  { id: 8, name: "Грамотность чтения", short: "ГЧ", max: 10 },
  { id: 3, name: "Мат. грамотность", short: "МГ", max: 10 },
];

const CHART_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#3b82f6"];

function getScoreColor(score: number, max: number) {
  const pct = score / max;
  if (pct >= 0.8) return "text-green-600 font-semibold";
  if (pct >= 0.6) return "text-foreground";
  if (pct >= 0.4) return "text-orange-600 font-medium";
  return "text-red-600 font-medium";
}

function getScoreBg(score: number, max: number) {
  const pct = score / max;
  if (pct >= 0.8) return "bg-green-500";
  if (pct >= 0.6) return "bg-blue-500";
  if (pct >= 0.4) return "bg-orange-500";
  return "bg-red-500";
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta > 0) return <span className="inline-flex items-center text-[11px] text-green-600 font-medium"><ArrowUp className="h-3 w-3" />+{delta}</span>;
  if (delta < 0) return <span className="inline-flex items-center text-[11px] text-red-600 font-medium"><ArrowDown className="h-3 w-3" />{delta}</span>;
  return <span className="inline-flex items-center text-[11px] text-muted-foreground"><Minus className="h-3 w-3" /></span>;
}

/* ══════ Types ══════ */

interface RawEntResult {
  id: number; student_id: number; subject_id: number; score: number;
  month: string; student_name: string; subject_name: string;
  group_id: number; group_name: string;
}

interface StudentRow {
  id: number; full_name: string; group_name: string; group_id: number;
  scores: Record<number, number>; total: number;
}

/* ══════ Score Editor Dialog ══════ */

function ScoreEditorDialog({ student, month, profileId, currentScores, onSave, onClose }: {
  student: { id: number; full_name: string } | null;
  month: string; profileId: number;
  currentScores: Record<number, number>;
  onSave: (scores: { student_id: number; subject_id: number; score: number; month: string }[]) => Promise<void>;
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

  if (!student) return null;

  return (
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
          <Button variant="outline" onClick={onClose}>Отмена</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ══════ Main Page ══════ */

export default function EntResultsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "umo_head";

  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("2026-02");
  const [search, setSearch] = useState("");
  const [rawData, setRawData] = useState<RawEntResult[]>([]);
  const [allData, setAllData] = useState<RawEntResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartStudentId, setChartStudentId] = useState("avg");
  const [editStudent, setEditStudent] = useState<{ id: number; full_name: string } | null>(null);

  // ── Enhanced filters & sorting ──
  const [sortColumn, setSortColumn] = useState<string>("total");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [scoreRange, setScoreRange] = useState<[number, number]>([0, TOTAL_MAX]);
  const [performanceFilter, setPerformanceFilter] = useState<string>("all"); // all | high | medium | low | critical
  const [showFilters, setShowFilters] = useState(false);
  const [profileFilter, setProfileFilter] = useState<string>("all"); // all | 1 | 2 | 3

  useEffect(() => {
    fetchGroups().then(g => { setGroups(g); setSelectedGroupId("all"); });
  }, []);

  useEffect(() => {
    if (!selectedGroupId) return;
    const gid = selectedGroupId === "all" ? undefined : parseInt(selectedGroupId);
    fetchEntResults(undefined, gid).then((data: RawEntResult[]) => {
      setAllData(data);
      const months = [...new Set(data.map(r => r.month))].sort();
      if (months.length > 0) setSelectedMonth(months[months.length - 1]);
    });
  }, [selectedGroupId]);

  useEffect(() => {
    if (!selectedGroupId || !selectedMonth) return;
    setLoading(true);
    const gid = selectedGroupId === "all" ? undefined : parseInt(selectedGroupId);
    fetchEntResults(selectedMonth, gid).then((data: RawEntResult[]) => { setRawData(data); setLoading(false); });
  }, [selectedMonth, selectedGroupId]);

  const isAllGroups = selectedGroupId === "all";
  const selectedGroup = useMemo(() => groups.find(g => String(g.id) === selectedGroupId), [groups, selectedGroupId]);
  const profileId: number = selectedGroup?.profile_id || 1;
  const profileSubjects = ENT_PROFILE_SUBJECTS[profileId] || ENT_PROFILE_SUBJECTS[1];

  // Map group_id → profile_id for looking up per-student profiles
  const groupProfileMap = useMemo(() => {
    const m: Record<number, number> = {};
    for (const g of groups) m[g.id] = g.profile_id;
    return m;
  }, [groups]);

  // All available months with data
  const availableMonths = useMemo(() => {
    const ms = new Set<string>(); for (const r of allData) ms.add(r.month);
    return ACADEMIC_MONTHS.filter(m => ms.has(m.value));
  }, [allData]);

  // Previous month key
  const prevMonth = useMemo(() => {
    const idx = availableMonths.findIndex(m => m.value === selectedMonth);
    return idx > 0 ? availableMonths[idx - 1].value : null;
  }, [availableMonths, selectedMonth]);

  // Pivot raw data → student rows for current month
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

  const handleSort = useCallback((col: string) => {
    if (sortColumn === col) setSortDirection(d => d === "asc" ? "desc" : "asc");
    else { setSortColumn(col); setSortDirection("desc"); }
  }, [sortColumn]);

  function SortIcon({ col }: { col: string }) {
    if (sortColumn !== col) return <ChevronsUpDown className="h-3 w-3 ml-0.5 opacity-30" />;
    return sortDirection === "asc" ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />;
  }

  // Summary averages
  const averages = useMemo(() => {
    if (filtered.length === 0) return null;
    const displaySubjects = isAllGroups ? MANDATORY_SUBJECTS : profileSubjects;
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

  // ──── All-students progress data ────
  const allStudentsProgress = useMemo(() => {
    // Per student: first total, last total, all month-totals
    const studentMonths: Record<number, Record<string, number>> = {};
    const studentNames: Record<number, string> = {};
    for (const r of allData) {
      studentNames[r.student_id] = r.student_name;
      if (!studentMonths[r.student_id]) studentMonths[r.student_id] = {};
      if (!studentMonths[r.student_id][r.month]) studentMonths[r.student_id][r.month] = 0;
      studentMonths[r.student_id][r.month] += r.score;
    }
    const months = availableMonths.map(m => m.value);
    return Object.entries(studentMonths).map(([sid, mScores]) => {
      const id = parseInt(sid);
      const sortedMonths = months.filter(m => mScores[m] > 0);
      const first = sortedMonths.length > 0 ? mScores[sortedMonths[0]] : 0;
      const last = sortedMonths.length > 0 ? mScores[sortedMonths[sortedMonths.length - 1]] : 0;
      const growth = last - first;
      const monthData = months.map(m => mScores[m] || 0);
      return { id, name: studentNames[id], first, last, growth, monthData, sortedMonths };
    }).sort((a, b) => b.last - a.last);
  }, [allData, availableMonths]);

  // ──── Total chart data ────
  const chartData = useMemo(() => {
    const studentMonths: Record<string, Record<string, number>> = {};
    const studentNames: Record<number, string> = {};
    for (const r of allData) {
      studentNames[r.student_id] = r.student_name;
      const sid = String(r.student_id);
      if (!studentMonths[sid]) studentMonths[sid] = {};
      if (!studentMonths[sid][r.month]) studentMonths[sid][r.month] = 0;
      studentMonths[sid][r.month] += r.score;
    }
    const months = availableMonths.map(m => m.value);
    const avgByMonth: Record<string, { sum: number; count: number }> = {};
    for (const sid of Object.keys(studentMonths)) for (const m of months) { const t = studentMonths[sid]?.[m] || 0; if (t === 0) continue; if (!avgByMonth[m]) avgByMonth[m] = { sum: 0, count: 0 }; avgByMonth[m].sum += t; avgByMonth[m].count++; }

    if (chartStudentId === "avg") {
      return months.filter(m => avgByMonth[m]).map(m => ({
        month: MONTH_SHORT[m] || m, monthFull: MONTH_LABELS[m] || m,
        ["Средний балл"]: avgByMonth[m] ? Math.round(avgByMonth[m].sum / avgByMonth[m].count) : 0,
      }));
    }
    const sid = chartStudentId;
    const name = studentNames[parseInt(sid)] || "Ученик";
    return months.filter(m => (studentMonths[sid]?.[m] || 0) > 0 || avgByMonth[m]).map(m => {
      const pt: Record<string, string | number> = { month: MONTH_SHORT[m] || m, monthFull: MONTH_LABELS[m] || m };
      const st = studentMonths[sid]?.[m] || 0;
      if (st > 0) pt[name] = st;
      if (avgByMonth[m]) pt["Средний по группе"] = Math.round(avgByMonth[m].sum / avgByMonth[m].count);
      return pt;
    });
  }, [allData, chartStudentId, availableMonths]);

  // Per-subject chart data for individual student
  const subjectChartData = useMemo(() => {
    if (chartStudentId === "avg") return [];
    const sid = parseInt(chartStudentId);
    const studentData = allData.filter(r => r.student_id === sid);
    const months = [...new Set(studentData.map(r => r.month))].sort();
    return months.map(m => {
      const point: Record<string, string | number> = { month: MONTH_SHORT[m] || m };
      for (const s of profileSubjects) {
        const entry = studentData.find(r => r.month === m && r.subject_id === s.id);
        if (entry) point[s.short] = entry.score;
      }
      return point;
    });
  }, [allData, chartStudentId, profileSubjects]);

  // Stacked bar chart data: subjects stacked by month for a student
  const stackedChartData = useMemo(() => {
    if (chartStudentId === "avg") {
      // Average per subject per month across group
      const months = availableMonths.map(m => m.value);
      const subjectSums: Record<string, Record<number, { sum: number; count: number }>> = {};
      for (const r of allData) {
        if (!subjectSums[r.month]) subjectSums[r.month] = {};
        if (!subjectSums[r.month][r.subject_id]) subjectSums[r.month][r.subject_id] = { sum: 0, count: 0 };
        subjectSums[r.month][r.subject_id].sum += r.score;
        subjectSums[r.month][r.subject_id].count++;
      }
      const displaySubjects = isAllGroups ? MANDATORY_SUBJECTS : profileSubjects;
      return months.filter(m => subjectSums[m]).map(m => {
        const point: Record<string, string | number> = { month: MONTH_SHORT[m] || m, monthFull: MONTH_LABELS[m] || m };
        let total = 0;
        for (const s of displaySubjects) {
          const val = subjectSums[m]?.[s.id] ? Math.round(subjectSums[m][s.id].sum / subjectSums[m][s.id].count) : 0;
          point[s.short] = val;
          total += val;
        }
        point["Итого"] = total;
        return point;
      });
    }
    const sid = parseInt(chartStudentId);
    const studentData = allData.filter(r => r.student_id === sid);
    const months = [...new Set(studentData.map(r => r.month))].sort();
    return months.map(m => {
      const point: Record<string, string | number> = { month: MONTH_SHORT[m] || m, monthFull: MONTH_LABELS[m] || m };
      let total = 0;
      for (const s of profileSubjects) {
        const entry = studentData.find(r => r.month === m && r.subject_id === s.id);
        const val = entry ? entry.score : 0;
        point[s.short] = val;
        total += val;
      }
      point["Итого"] = total;
      return point;
    });
  }, [allData, chartStudentId, availableMonths, profileSubjects, isAllGroups]);

  // Radar chart data: latest month subject breakdown
  const radarData = useMemo(() => {
    if (stackedChartData.length === 0) return [];
    const latest = stackedChartData[stackedChartData.length - 1];
    const displaySubjects = (chartStudentId === "avg" && isAllGroups) ? MANDATORY_SUBJECTS : profileSubjects;
    return displaySubjects.map(s => ({
      subject: s.short,
      fullName: s.name,
      score: (latest[s.short] as number) || 0,
      max: s.max,
      percent: Math.round(((latest[s.short] as number) || 0) / s.max * 100),
    }));
  }, [stackedChartData, profileSubjects, isAllGroups, chartStudentId]);

  const chartStudentsList = useMemo(() => {
    const names: Record<number, string> = {};
    for (const r of allData) names[r.student_id] = r.student_name;
    return Object.entries(names).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [allData]);

  // ══════ TOPS / LEADERBOARD DATA ══════

  // Top by total for current month
  const topByTotal = useMemo(() =>
    [...studentsTable].sort((a, b) => b.total - a.total).slice(0, 10),
    [studentsTable]);

  // Top by each subject for current month
  const topBySubject = useMemo(() => {
    const displaySubjects = isAllGroups ? MANDATORY_SUBJECTS : profileSubjects;
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
    // Build per-student per-month totals from allData
    const studentMonths: Record<number, Record<string, number>> = {};
    const studentNames: Record<number, string> = {};
    const studentGroups: Record<number, number> = {};
    for (const r of allData) {
      studentNames[r.student_id] = r.student_name;
      studentGroups[r.student_id] = r.group_id;
      if (!studentMonths[r.student_id]) studentMonths[r.student_id] = {};
      if (!studentMonths[r.student_id][r.month]) studentMonths[r.student_id][r.month] = 0;
      studentMonths[r.student_id][r.month] += r.score;
    }
    const months = availableMonths.map(m => m.value);
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
  }, [allData, availableMonths]);

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
    const displaySubjects = isAllGroups ? MANDATORY_SUBJECTS : profileSubjects;
    const months = availableMonths.map(m => m.value);
    if (months.length === 0 || allData.length === 0) return [];

    return displaySubjects.map(subj => {
      // Per-month stats
      const monthlyStats = months.map(m => {
        const scores = allData.filter(r => r.month === m && r.subject_id === subj.id).map(r => r.score);
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
      const currentScores = allData.filter(r => r.month === selectedMonth && r.subject_id === subj.id);
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
  }, [allData, availableMonths, profileSubjects, isAllGroups, selectedMonth]);

  // Profile-specific subjects analysis (for "all groups" mode)
  const profileSubjectAnalysis = useMemo(() => {
    if (!isAllGroups) return [];
    const allProfileSubjects = new Map<number, { id: number; name: string; short: string; max: number }>();
    for (const pid of [1, 2, 3]) {
      for (const s of (ENT_PROFILE_SUBJECTS[pid] || []).slice(3)) {
        if (!allProfileSubjects.has(s.id)) allProfileSubjects.set(s.id, s);
      }
    }
    const months = availableMonths.map(m => m.value);
    return [...allProfileSubjects.values()].map(subj => {
      const monthlyStats = months.map(m => {
        const scores = allData.filter(r => r.month === m && r.subject_id === subj.id).map(r => r.score);
        if (scores.length === 0) return { month: m, monthShort: MONTH_SHORT[m] || m, monthLabel: MONTH_LABELS[m] || m, avg: 0, max: 0, min: 0, count: 0, pct: 0 };
        const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        return { month: m, monthShort: MONTH_SHORT[m] || m, monthLabel: MONTH_LABELS[m] || m, avg, max: Math.max(...scores), min: Math.min(...scores), count: scores.length, pct: Math.round(avg / subj.max * 100) };
      }).filter(s => s.count > 0);
      const currentScores = allData.filter(r => r.month === selectedMonth && r.subject_id === subj.id);
      const top5 = [...currentScores].sort((a, b) => b.score - a.score).slice(0, 5).map(r => ({ name: r.student_name, score: r.score, group: r.group_name }));
      const currentMonth = monthlyStats.find(m => m.month === selectedMonth) || monthlyStats[monthlyStats.length - 1];
      const prevIdx = monthlyStats.length >= 2 ? monthlyStats.length - 2 : -1;
      const delta = currentMonth && prevIdx >= 0 ? currentMonth.avg - monthlyStats[prevIdx].avg : null;
      return { subject: subj, monthlyStats, currentMonth, delta, top5, totalStudents: currentScores.length };
    });
  }, [allData, availableMonths, isAllGroups, selectedMonth]);

  const chartLines = useMemo(() => {
    if (chartStudentId === "avg") return ["Средний балл"];
    const student = chartStudentsList.find(s => s.id === chartStudentId);
    return [student?.name || "Ученик", "Средний по группе"];
  }, [chartStudentId, chartStudentsList]);

  const handleSaveScores = useCallback(async (scores: { student_id: number; subject_id: number; score: number; month: string }[]) => {
    await saveEntResultsBatch(scores);
    const gid = selectedGroupId === "all" ? undefined : parseInt(selectedGroupId);
    if (selectedGroupId && selectedMonth) { const data = await fetchEntResults(selectedMonth, gid); setRawData(data); }
    const ad = await fetchEntResults(undefined, gid);
    setAllData(ad);
  }, [selectedGroupId, selectedMonth]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 md:mb-6">
        <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <BarChart3 className="h-4 w-4 md:h-5 md:w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg md:text-2xl font-heading font-bold text-foreground">Результаты ЕНТ</h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            Баллы учеников по предметам и месяцам
            {selectedGroup && <span> · <strong>{selectedGroup.profile_name}</strong></span>}
            {isAllGroups && <span> · <strong>Все группы</strong></span>}
          </p>
        </div>
      </div>

      {/* Group & search filters */}
      <div className="flex flex-wrap gap-2 md:gap-3 mb-3">
        <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
          <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Группа" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все группы</SelectItem>
            {groups.map((g: any) => (
              <SelectItem key={g.id} value={String(g.id)}>{g.name} <span className="text-muted-foreground ml-1">({g.profile_name})</span></SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isAllGroups && (
          <Select value={profileFilter} onValueChange={setProfileFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Направление" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все направления</SelectItem>
              <SelectItem value="1">Мат-Инфо</SelectItem>
              <SelectItem value="2">Мат-Физ</SelectItem>
              <SelectItem value="3">Био-Хим</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Input placeholder="Поиск по имени..." value={search} onChange={e => setSearch(e.target.value)} className="w-full sm:max-w-[200px]" />
        <Button variant={showFilters ? "default" : "outline"} size="sm" onClick={() => setShowFilters(f => !f)} className="gap-1.5">
          <Filter className="h-3.5 w-3.5" />Фильтры
          {(performanceFilter !== "all" || scoreRange[0] > 0 || scoreRange[1] < TOTAL_MAX || profileFilter !== "all") && (
            <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center text-[10px]">!</Badge>
          )}
        </Button>
        {(performanceFilter !== "all" || scoreRange[0] > 0 || scoreRange[1] < TOTAL_MAX || profileFilter !== "all") && (
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => { setPerformanceFilter("all"); setScoreRange([0, TOTAL_MAX]); setProfileFilter("all"); }}>
            Сбросить фильтры
          </Button>
        )}
      </div>

      {/* Advanced filters panel */}
      {showFilters && (
        <Card className="mb-5">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium">Диапазон баллов: {scoreRange[0]} — {scoreRange[1]}</Label>
                <Slider min={0} max={TOTAL_MAX} step={5} value={scoreRange} onValueChange={v => setScoreRange(v as [number, number])} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Уровень</Label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { val: "all", label: "Все", icon: null },
                    { val: "high", label: "≥80%", icon: "🟢" },
                    { val: "medium", label: "60-79%", icon: "🔵" },
                    { val: "low", label: "40-59%", icon: "🟠" },
                    { val: "critical", label: "<40%", icon: "🔴" },
                  ].map(f => (
                    <Button key={f.val} variant={performanceFilter === f.val ? "default" : "outline"} size="sm" className="text-xs h-7"
                      onClick={() => setPerformanceFilter(f.val)}>
                      {f.icon && <span className="mr-1">{f.icon}</span>}{f.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {editStudent && (() => {
        const editStudentRow = studentsTable.find(s => s.id === editStudent.id);
        const editProfileId = editStudentRow ? (groupProfileMap[editStudentRow.group_id] || profileId) : profileId;
        return (
          <ScoreEditorDialog student={editStudent} month={selectedMonth} profileId={editProfileId}
            currentScores={editStudentRow?.scores || {}}
            onSave={handleSaveScores} onClose={() => setEditStudent(null)} />
        );
      })()}

      <Tabs defaultValue="table">
        <TabsList className="mb-5">
          <TabsTrigger value="table"><Users className="h-4 w-4 mr-1.5" />Таблица баллов</TabsTrigger>
          <TabsTrigger value="tops"><Trophy className="h-4 w-4 mr-1.5" />Топы</TabsTrigger>
          <TabsTrigger value="subjects"><BookOpen className="h-4 w-4 mr-1.5" />Предметы</TabsTrigger>
          <TabsTrigger value="progress"><TrendingUp className="h-4 w-4 mr-1.5" />ЕНТ Результаты</TabsTrigger>
          <TabsTrigger value="chart"><BarChart3 className="h-4 w-4 mr-1.5" />Динамика</TabsTrigger>
        </TabsList>

        {/* ══════ TABLE TAB ══════ */}
        <TabsContent value="table">
          <div className="flex flex-wrap gap-1.5 mb-5">
            {(availableMonths.length > 0 ? availableMonths : ACADEMIC_MONTHS.slice(0, 6)).map(m => (
              <Button key={m.value} variant={selectedMonth === m.value ? "default" : "outline"} size="sm" onClick={() => setSelectedMonth(m.value)}>{m.short}</Button>
            ))}
          </div>

          {averages && (
            <div className="grid gap-3 grid-cols-3 md:grid-cols-4 lg:grid-cols-7 mb-5">
              {averages.subjects.map(s => (
                <Card key={s.id}><CardContent className="p-3 text-center">
                  <p className="text-[10px] text-muted-foreground mb-0.5 truncate" title={s.name}>{s.short}</p>
                  <p className={`text-xl font-bold ${getScoreColor(s.avg, s.max)}`}>{s.avg}</p>
                  <p className="text-[10px] text-muted-foreground">/ {s.max}</p>
                </CardContent></Card>
              ))}
              {isAllGroups && (
                <>
                  <Card><CardContent className="p-3 text-center">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Проф. 1</p>
                    <p className={`text-xl font-bold ${getScoreColor(averages.prof1Avg, 50)}`}>{averages.prof1Avg}</p>
                    <p className="text-[10px] text-muted-foreground">/ 50</p>
                  </CardContent></Card>
                  <Card><CardContent className="p-3 text-center">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Проф. 2</p>
                    <p className={`text-xl font-bold ${getScoreColor(averages.prof2Avg, 50)}`}>{averages.prof2Avg}</p>
                    <p className="text-[10px] text-muted-foreground">/ 50</p>
                  </CardContent></Card>
                </>
              )}
              <Card className="bg-primary/5 border-primary/20"><CardContent className="p-3 text-center">
                <p className="text-[10px] text-muted-foreground mb-0.5">Итого</p>
                <p className="text-xl font-bold text-primary">{averages.totalAvg}</p>
                <p className="text-[10px] text-muted-foreground">/ {TOTAL_MAX}</p>
              </CardContent></Card>
            </div>
          )}

          {loading ? (
            <div className="space-y-2">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
          ) : filtered.length === 0 ? (
            <Card className="text-center py-16"><CardContent>
              <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/20 mb-3" />
              <p className="text-muted-foreground">Нет данных ЕНТ за {MONTH_LABELS[selectedMonth] || selectedMonth}</p>
            </CardContent></Card>
          ) : (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-10">#</TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleSort("name")}>
                      <span className="inline-flex items-center">Ученик<SortIcon col="name" /></span>
                    </TableHead>
                    {isAllGroups && <TableHead>Группа</TableHead>}
                    {(isAllGroups ? MANDATORY_SUBJECTS : profileSubjects).map(s => (
                      <TableHead key={s.id} className="text-center min-w-[50px] cursor-pointer select-none" title={s.name}
                        onClick={() => handleSort(String(s.id))}>
                        <span className="inline-flex items-center justify-center">{s.short}<SortIcon col={String(s.id)} /></span>
                      </TableHead>
                    ))}
                    {isAllGroups && <TableHead className="text-center min-w-[60px]">Проф. 1</TableHead>}
                    {isAllGroups && <TableHead className="text-center min-w-[60px]">Проф. 2</TableHead>}
                    <TableHead className="text-center min-w-[70px] font-bold text-primary cursor-pointer select-none" onClick={() => handleSort("total")}>
                      <span className="inline-flex items-center justify-center">Итого<SortIcon col="total" /></span>
                    </TableHead>
                    <TableHead className="text-center w-[60px]">+/-</TableHead>
                    {isAdmin && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((st, idx) => {
                    const delta = prevMonth != null && prevTotals[st.id] != null ? st.total - prevTotals[st.id] : null;
                    const rowProfileId = groupProfileMap[st.group_id] || 1;
                    const rowSubjects = isAllGroups ? MANDATORY_SUBJECTS : profileSubjects;
                    // Profile subjects for "all groups"
                    const rowProfileSubs = isAllGroups ? (ENT_PROFILE_SUBJECTS[rowProfileId] || []).slice(3) : [];
                    return (
                      <TableRow key={st.id} className="hover:bg-muted/30">
                        <TableCell className="text-muted-foreground text-sm">{idx + 1}</TableCell>
                        <TableCell className="font-medium text-sm">{st.full_name}</TableCell>
                        {isAllGroups && <TableCell className="text-sm text-muted-foreground">{st.group_name}</TableCell>}
                        {rowSubjects.map(s => {
                          const score = st.scores[s.id];
                          return <TableCell key={s.id} className={`text-center text-sm ${score != null ? getScoreColor(score, s.max) : "text-muted-foreground"}`}>{score != null ? score : "—"}</TableCell>;
                        })}
                        {isAllGroups && rowProfileSubs.map(s => {
                          const score = st.scores[s.id];
                          return (
                            <TableCell key={s.id} className="text-center text-sm" title={s.name}>
                              <span className={score != null ? getScoreColor(score, s.max) : "text-muted-foreground"}>{score != null ? score : "—"}</span>
                              <span className="text-[8px] text-muted-foreground ml-0.5 block">{s.short}</span>
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center">
                          <span className={`font-bold text-sm ${getScoreColor(st.total, TOTAL_MAX)}`}>{st.total}</span>
                          <span className="text-[10px] text-muted-foreground ml-0.5">/{TOTAL_MAX}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          {delta != null ? <DeltaBadge delta={delta} /> : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditStudent({ id: st.id, full_name: st.full_name })}>
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {isAdmin && studentsTable.length > 0 && (
            <div className="mt-4 text-sm text-muted-foreground">
              Нажмите <Edit className="h-3.5 w-3.5 inline" /> чтобы редактировать баллы ученика
            </div>
          )}
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
                      <Tooltip contentStyle={{ fontSize: 13, borderRadius: 8 }} formatter={(v: number) => [v, "Учеников"]} />
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
                      <Tooltip contentStyle={{ fontSize: 13, borderRadius: 8 }}
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
                            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }}
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
                                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number) => [v, "Средний"]} />
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
                            {score > 0 && <div className={`w-full rounded-sm ${getScoreBg(score, TOTAL_MAX)} opacity-80`} style={{ height: h }} title={`${availableMonths[i]?.label || ""}: ${score}`} />}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-0.5 mt-0.5">
                      {availableMonths.map((m, i) => (
                        <div key={m.value} className="flex-1 text-center text-[8px] text-muted-foreground">{m.short}</div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ══════ CHART TAB ══════ */}
        <TabsContent value="chart">
          <div className="flex flex-wrap items-end gap-3 mb-5">
            <div className="space-y-1">
              <Label className="text-xs">Ученик</Label>
              <Select value={chartStudentId} onValueChange={setChartStudentId}>
                <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="avg">📊 Среднее по группе</SelectItem>
                  {chartStudentsList.map(s => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {stackedChartData.length === 0 ? (
            <Card className="text-center py-16"><CardContent>
              <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground/20 mb-3" />
              <p className="text-muted-foreground">Нет данных для графика</p>
            </CardContent></Card>
          ) : (
            <>
              {/* Stacked bar chart: subjects breakdown by month */}
              <Card className="mb-5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Баллы по предметам · {chartStudentId === "avg" ? "Среднее по группе" : chartStudentsList.find(s => s.id === chartStudentId)?.name}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Каждый столбец показывает вклад предмета в общий балл</p>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={stackedChartData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, TOTAL_MAX]} tick={{ fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{ fontSize: 13, borderRadius: 8 }}
                        labelFormatter={label => { const pt = stackedChartData.find((d: any) => d.month === label) as any; return pt?.monthFull || label; }}
                        formatter={(value: number, name: string) => [value, name]}
                      />
                      <Legend />
                      {((chartStudentId === "avg" && isAllGroups) ? MANDATORY_SUBJECTS : profileSubjects).map((s, i) => (
                        <Bar key={s.id} dataKey={s.short} name={s.name} stackId="total"
                          fill={CHART_COLORS[i % CHART_COLORS.length]} radius={i === ((chartStudentId === "avg" && isAllGroups) ? MANDATORY_SUBJECTS : profileSubjects).length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}>
                          {i === ((chartStudentId === "avg" && isAllGroups) ? MANDATORY_SUBJECTS : profileSubjects).length - 1 && (
                            <LabelList dataKey="Итого" position="top" fontSize={11} fontWeight={700} fill="#6366f1" />
                          )}
                        </Bar>
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Radar chart: latest month subject breakdown */}
                {radarData.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Профиль предметов (последний месяц)</CardTitle>
                      <p className="text-xs text-muted-foreground">Процент от максимума по каждому предмету</p>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
                          <PolarGrid stroke="hsl(var(--border))" />
                          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fontWeight: 600 }} />
                          <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} angle={90} />
                          <Tooltip
                            contentStyle={{ fontSize: 13, borderRadius: 8 }}
                            formatter={(value: number, _name: string, props: any) => [`${props.payload.score}/${props.payload.max} (${value}%)`, props.payload.fullName]}
                          />
                          <Radar dataKey="percent" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} strokeWidth={2} dot={{ r: 4, fill: "#6366f1" }} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Total score trend line */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Динамика общего балла</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <defs>
                          <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, TOTAL_MAX]} tick={{ fontSize: 12 }} />
                        <Tooltip contentStyle={{ fontSize: 13, borderRadius: 8 }}
                          labelFormatter={label => { const pt = chartData.find((d: any) => d.month === label) as any; return pt?.monthFull || label; }} />
                        <Legend />
                        {chartLines.map((name, i) => (
                          <Area key={name} type="monotone" dataKey={name}
                            stroke={i === 0 ? "#6366f1" : "#94a3b8"} strokeWidth={i === 0 ? 3 : 1.5}
                            fill={i === 0 ? "url(#colorTotal)" : "url(#colorAvg)"}
                            dot={{ r: i === 0 ? 5 : 3, fill: i === 0 ? "#6366f1" : "#94a3b8" }} connectNulls />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Per-subject line chart for individual student */}
              {chartStudentId !== "avg" && subjectChartData.length > 0 && (
                <Card className="mt-5">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Динамика по предметам</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={subjectChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, 50]} tick={{ fontSize: 12 }} />
                        <Tooltip contentStyle={{ fontSize: 13, borderRadius: 8 }} />
                        <Legend />
                        {profileSubjects.map((s, i) => (
                          <Line key={s.id} type="monotone" dataKey={s.short} name={`${s.name} (/${s.max})`}
                            stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2.5}
                            dot={{ r: 4, fill: CHART_COLORS[i % CHART_COLORS.length] }} connectNulls />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
