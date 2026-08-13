import { Users, Filter, Calendar, BookOpen, Search, Phone, GraduationCap, ArrowUpDown, MessageSquare, CheckCircle2, XCircle, Clock, BookX, Star, FileDown, BarChart3, Plus, Upload, UserPlus, Archive } from "lucide-react";
import { GroupPersonAvatar } from "@/components/GroupPersonAvatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { fetchStudentsPaginated, fetchTeacherFeedbackByStudent, fetchLessonCommentsByStudent, bulkArchiveStudents, bulkImportStudents, createStudent } from "@/lib/api";
import { useGroups } from "@/hooks/useGroups";
import { useToast } from "@/hooks/use-toast";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/contexts/AuthContext";
import { formatPhone, cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { BulkImportModal } from "@/components/BulkImportModal";

interface Group { id: number; name: string; curator_id?: number }
interface Student {
  id: number; full_name: string; phone?: string; parent_phone?: string; parent_name?: string;
  group_id?: number; group_name?: string; attendance_rate?: number | null; last_ent_score?: number | null;
  status?: string; avatar_url?: string | null; graduation_year?: string | null;
}
type SortKey = "full_name" | "group_name" | "attendance_rate" | "last_ent_score";

const PAGE_SIZE = 25;

const API_BASE = (import.meta as any).env?.VITE_API_URL || "/api";

function generateMonthOptions() {
  const RU_MONTHS = ["Янв","Фев","Март","Апр","Май","Июнь","Июль","Авг","Сент","Окт","Нояб","Дек"];
  const now = new Date();
  const opts: { value: string; label: string }[] = [];
  // From September of previous year up to current month + 2
  const start = new Date(now.getFullYear() - 1, 8, 1); // Sep prev year
  const end   = new Date(now.getFullYear(), now.getMonth() + 2, 1);
  for (let d = new Date(start); d < end; d.setMonth(d.getMonth() + 1)) {
    const y = d.getFullYear();
    const m = d.getMonth();
    opts.push({ value: `${y}-${String(m + 1).padStart(2, "0")}`, label: `${RU_MONTHS[m]} ${y}` });
  }
  return opts;
}
const MONTH_OPTIONS = generateMonthOptions();

async function fetchStudent360(id: number) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}/student-360/${id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

function getMonthRange(month: string) {
  const [yStr, mStr] = month.split("-");
  const y = Number(yStr); const m = Number(mStr);
  if (!y || !m) return null;
  return { from: `${month}-01`, to: `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}` };
}

/* ═══════ 360 PANEL ═══════ */
function Student360Panel({ data, month, teacherFeedback, lessonComments, loading, onOpenFull }: {
  data: any; month: string; teacherFeedback: any[]; lessonComments: any[]; loading: boolean; onOpenFull?: () => void;
}) {
  const [avatarError, setAvatarError] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Reset avatar error when data changes
  useEffect(() => { setAvatarError(false); }, [data?.id]);

  if (loading) return (
    <div className="space-y-4 p-1">
      <div className="flex gap-3"><Skeleton className="h-14 w-14 rounded-xl shrink-0" /><div className="flex-1 space-y-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-3 w-56" /></div></div>
      {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
    </div>
  );

  if (!data) return <div className="text-center py-12 text-muted-foreground text-sm">Профиль не найден</div>;

  const s = data;
  const h = s.hero || {};
  const initials = s.full_name?.split(" ").map((w: string) => w[0]).slice(0, 2).join("") ?? "";

  // Filter attendance records by month
  const range = getMonthRange(month);
  const monthRecords: any[] = (s.attendance?.records ?? []).filter((r: any) => {
    if (!range || !r.date) return false;
    return r.date >= range.from && r.date <= range.to;
  });

  // Filter ENT by month
  const entMonth = (s.ent?.byMonth ?? []).find((m: any) => m.month === month);

  // Attendance stats for month
  const monthPresent = monthRecords.filter((r: any) => r.status === "present").length;
  const monthAbsent = monthRecords.filter((r: any) => r.status === "absent").length;
  const monthLate = monthRecords.filter((r: any) => r.lateness === "late").length;
  const monthHwDone = monthRecords.filter((r: any) => r.homework === "done").length;
  const monthHwPartial = monthRecords.filter((r: any) => r.homework === "partial").length;
  const monthHwNotDone = monthRecords.filter((r: any) => r.homework !== "done" && r.homework !== "partial").length;
  const monthTotal = monthRecords.length;
  const monthAttRate = monthTotal > 0 ? Math.round(monthPresent / monthTotal * 100) : null;
  const monthHwRate = monthTotal > 0 ? Math.round(monthHwDone / monthTotal * 100) : null;

  // Month label for display
  const monthLabel = MONTH_OPTIONS.find(m => m.value === month)?.label ?? month;

  const exportPDF = async () => {
    setExporting(true);
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      // Load and register Cyrillic fonts
      const [regBuf, boldBuf] = await Promise.all([
        fetch("/fonts/Roboto-Regular.ttf").then(r => r.arrayBuffer()),
        fetch("/fonts/Roboto-Bold.ttf").then(r => r.arrayBuffer()),
      ]);
      const toBase64 = (buf: ArrayBuffer) => {
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
      };
      doc.addFileToVFS("Roboto-Regular.ttf", toBase64(regBuf));
      doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
      doc.addFileToVFS("Roboto-Bold.ttf", toBase64(boldBuf));
      doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");

      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 15;

    // Title
    doc.setFontSize(16);
    doc.setFont("Roboto", "bold");
    doc.text(`360° — ${s.full_name}`, pageWidth / 2, y, { align: "center" });
    y += 7;
    doc.setFontSize(10);
    doc.setFont("Roboto", "normal");
    doc.text(`${s.group?.name ?? ""} | ${monthLabel}`, pageWidth / 2, y, { align: "center" });
    y += 4;
    if (s.phone) { doc.text(`Тел: ${s.phone}`, pageWidth / 2, y, { align: "center" }); y += 4; }
    if (s.parentPhone) { doc.text(`Родитель: ${s.parentName || "—"} — ${s.parentPhone}`, pageWidth / 2, y, { align: "center" }); y += 4; }
    y += 4;

    // Common autoTable font styles for Cyrillic support
    const fontStyles = { font: "Roboto" };

    // ─ Summary stats table ─
    doc.setFontSize(12);
    doc.setFont("Roboto", "bold");
    doc.text("Сводка за месяц", 14, y); y += 2;
    autoTable(doc, {
      startY: y,
      head: [["Показатель", "Значение"]],
      body: [
        ["Всего уроков", String(monthTotal)],
        ["Присутствовал", `${monthPresent} (${monthAttRate ?? 0}%)`],
        ["Отсутствовал", String(monthAbsent)],
        ["Опоздания", String(monthLate)],
        ["ДЗ выполнено", `${monthHwDone} (${monthHwRate ?? 0}%)`],
        ["ДЗ частично", String(monthHwPartial)],
        ["ДЗ не выполнено", String(monthHwNotDone)],
      ],
      theme: "grid",
      styles: fontStyles,
      headStyles: { fillColor: [59, 130, 246], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // ─ ENT scores ─
    if (entMonth && entMonth.subjects?.length > 0) {
      doc.setFontSize(12);
      doc.setFont("Roboto", "bold");
      doc.text("Баллы ЕНТ", 14, y); y += 2;
      autoTable(doc, {
        startY: y,
        head: [["Предмет", "Балл"]],
        body: [
          ...entMonth.subjects.map((sub: any) => [sub.name, String(sub.score)]),
          [{ content: "Итого", styles: { fontStyle: "bold" } }, { content: String(entMonth.total), styles: { fontStyle: "bold" } }],
        ],
        theme: "grid",
        styles: fontStyles,
        headStyles: { fillColor: [99, 102, 241], fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // ─ Attendance table ─
    if (monthTotal > 0) {
      doc.setFontSize(12);
      doc.setFont("Roboto", "bold");
      doc.text("Табель посещения", 14, y); y += 2;
      autoTable(doc, {
        startY: y,
        head: [["Дата", "Статус", "Опоздание", "Предмет", "Учитель"]],
        body: monthRecords.map((r: any) => [
          r.date ?? "—",
          r.status === "present" ? "Присутствовал" : "Отсутствовал",
          r.lateness === "late" ? "Да" : "—",
          r.subject ?? "—",
          r.teacher ?? "—",
        ]),
        theme: "striped",
        styles: fontStyles,
        headStyles: { fillColor: [16, 185, 129], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // ─ Homework table ─
    if (monthTotal > 0) {
      if (y > 250) { doc.addPage(); y = 15; }
      doc.setFontSize(12);
      doc.setFont("Roboto", "bold");
      doc.text("Табель ДЗ", 14, y); y += 2;
      autoTable(doc, {
        startY: y,
        head: [["Дата", "ДЗ", "Предмет", "Комментарий"]],
        body: monthRecords.map((r: any) => [
          r.date ?? "—",
          r.homework === "done" ? "Выполнено" : r.homework === "partial" ? "Частично" : "Не выполнено",
          r.subject ?? "—",
          r.comment ?? "—",
        ]),
        theme: "striped",
        styles: fontStyles,
        headStyles: { fillColor: [245, 158, 11], textColor: [0, 0, 0], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // ─ Teacher feedback ─
    if (teacherFeedback.length > 0) {
      if (y > 250) { doc.addPage(); y = 15; }
      doc.setFontSize(12);
      doc.setFont("Roboto", "bold");
      doc.text("Обратная связь учителей", 14, y); y += 2;
      autoTable(doc, {
        startY: y,
        head: [["Учитель", "Предмет", "Комментарий"]],
        body: teacherFeedback.map((f: any) => [f.teacher_name ?? "—", f.subject_name ?? "—", f.comment ?? "—"]),
        theme: "grid",
        styles: fontStyles,
        headStyles: { fillColor: [168, 85, 247], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
        columnStyles: { 2: { cellWidth: 80 } },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // ─ Lesson notes ─
    if (lessonComments.length > 0) {
      if (y > 250) { doc.addPage(); y = 15; }
      doc.setFontSize(12);
      doc.setFont("Roboto", "bold");
      doc.text("Заметки уроков", 14, y); y += 2;
      autoTable(doc, {
        startY: y,
        head: [["Дата", "Учитель", "Предмет", "Заметка"]],
        body: lessonComments.map((c: any) => [c.date ?? "—", c.teacher_name ?? "—", c.subject_name ?? "—", c.comment ?? "—"]),
        theme: "grid",
        styles: fontStyles,
        headStyles: { fillColor: [107, 114, 128], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
        columnStyles: { 3: { cellWidth: 70 } },
      });
    }

    // Footer
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFontSize(7);
      doc.setFont("Roboto", "normal");
      doc.setTextColor(150);
      doc.text(`Today CRM — 360° отчёт | ${s.full_name} | ${monthLabel}`, 14, doc.internal.pageSize.getHeight() - 8);
      doc.text(`${p} / ${totalPages}`, pageWidth - 14, doc.internal.pageSize.getHeight() - 8, { align: "right" });
      doc.setTextColor(0);
    }

    doc.save(`360_${s.full_name.replace(/\s+/g, "_")}_${month}.pdf`);
    } finally { setExporting(false); }
  };

  const isAllEmpty = monthTotal === 0 && (!entMonth || entMonth.subjects?.length === 0) && lessonComments.length === 0 && teacherFeedback.length === 0;

  return (
    <div className="space-y-4 pb-6">
      {/* ── FIXED STUDENT HEADER ── */}
      <div className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm relative overflow-hidden">
        {/* Subtle decorative background gradient */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
        
        <div className="flex gap-4 items-start relative z-10">
          <div className="relative shrink-0">
            <UserAvatar 
              user={s} 
              size="lg" 
              className="rounded-2xl ring-2 ring-background shadow-sm [&>span]:rounded-2xl [&_img]:rounded-2xl" 
            />
            <span className={cn("absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-card shadow-sm",
              s.status === "active" ? "bg-emerald-500" : "bg-amber-500")} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-foreground leading-tight truncate">{s.full_name}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {s.group?.name && <Badge variant="secondary" className="text-[10px] bg-secondary/60 hover:bg-secondary/80">{s.group.name}</Badge>}
              {s.group?.profileName && <Badge variant="outline" className="text-[10px] border-primary/20 text-primary/80">{s.group.profileName}</Badge>}
              <span className="text-[10px] text-muted-foreground font-medium bg-muted/50 px-1.5 py-0.5 rounded-md">ID: {s.id}</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1 gap-x-3 mt-2 text-[11px] text-muted-foreground font-medium">
              {s.phone && <a href={`tel:${s.phone}`} className="flex items-center gap-1.5 hover:text-foreground transition-colors"><Phone className="h-3 w-3 text-primary/60" />{formatPhone(s.phone)}</a>}
              {s.parentPhone && <span className="flex items-center gap-1.5"><Phone className="h-3 w-3 text-amber-500/80" />{s.parentName || "Родитель"}: {formatPhone(s.parentPhone)}</span>}
            </div>
            {s.group?.curatorName && <p className="text-[11px] text-muted-foreground mt-1 font-medium"><Star className="h-3 w-3 inline text-amber-400 mr-1 pb-0.5" />Куратор: {s.group.curatorName}</p>}
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2 mt-4 relative z-10 pt-3 border-t border-border/40">
          {s.parentPhone && (
            <Button variant="outline" size="sm" className="h-7 px-3 text-[11px] gap-1.5 rounded-lg bg-background/50 backdrop-blur-sm"
              onClick={() => window.open(`https://wa.me/${s.parentPhone.replace(/\D/g, "")}`, "_blank")}>
              <MessageSquare className="h-3.5 w-3.5 text-emerald-500" /> WhatsApp
            </Button>
          )}
          {s.parentPhone && (
            <Button variant="outline" size="sm" className="h-7 px-3 text-[11px] gap-1.5 rounded-lg bg-background/50 backdrop-blur-sm"
              onClick={() => window.open(`tel:${s.parentPhone}`)}>
              <Phone className="h-3.5 w-3.5 text-blue-500" /> Звонок
            </Button>
          )}
          <Button variant="secondary" size="sm" className="h-7 px-3 text-[11px] gap-1.5 rounded-lg ml-auto hover:bg-primary/15 hover:text-primary transition-colors" onClick={exportPDF} disabled={exporting}>
            <FileDown className="h-3.5 w-3.5" /> {exporting ? "..." : "PDF"}
          </Button>
        </div>
        
        {onOpenFull && (
          <Button size="sm" className="w-full mt-2 h-8 text-[11px] font-bold tracking-wide gap-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg shadow-none"
            onClick={onOpenFull}>
            <GraduationCap className="h-4 w-4" /> ОТКРЫТЬ ПОЛНЫЙ ПРОФИЛЬ
          </Button>
        )}
      </div>

      {/* ── KPI ROW ── */}
      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="Посещаемость" value={monthAttRate !== null ? `${monthAttRate}%` : "—"} accent={monthAttRate === null ? "default" : monthAttRate >= 90 ? "green" : monthAttRate >= 75 ? "amber" : "red"} />
        <MiniStat label="ЕНТ" value={entMonth ? String(entMonth.total) : (h.entLastScore != null ? String(h.entLastScore) : "—")} accent="blue" />
        <MiniStat label="ДЗ" value={monthHwRate !== null ? `${monthHwRate}%` : "—"} accent={monthHwRate === null ? "default" : monthHwRate >= 85 ? "green" : monthHwRate >= 60 ? "amber" : "red"} />
      </div>

      {isAllEmpty ? (
        <div className="flex flex-col items-center justify-center py-10 px-4 bg-muted/20 border border-border/40 rounded-2xl border-dashed">
          <Calendar className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground text-center">Нет данных за этот месяц</p>
          <p className="text-xs text-muted-foreground/60 text-center mt-1">Выберите другой месяц в верхнем меню</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* ── MONTHLY SUMMARY STATS ── */}
          <PanelSection title={`Сводка за ${monthLabel}`} icon={<BarChart3 className="h-4 w-4" />} empty={monthTotal === 0}>
            <div className="space-y-3">
              {/* Attendance breakdown */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Посещение</span>
                  <span className="ml-auto text-[10px] font-semibold bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{monthTotal} уроков</span>
                </div>
                <div className="flex gap-0.5 h-3 rounded-full overflow-hidden bg-muted/50 p-0.5">
                  {monthPresent > 0 && <div className="bg-emerald-500 rounded-full transition-all" style={{ width: `${monthPresent / monthTotal * 100}%` }} />}
                  {monthLate > 0 && <div className="bg-amber-500 rounded-full transition-all" style={{ width: `${monthLate / monthTotal * 100}%` }} />}
                  {monthAbsent > 0 && <div className="bg-red-500 rounded-full transition-all" style={{ width: `${monthAbsent / monthTotal * 100}%` }} />}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div>
                    <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{monthPresent}</div>
                    <div className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide">Присутствовал</div>
                  </div>
                  <div>
                    <div className="text-sm font-black text-amber-600 dark:text-amber-400 tabular-nums">{monthLate}</div>
                    <div className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide">Опоздания</div>
                  </div>
                  <div>
                    <div className="text-sm font-black text-red-600 dark:text-red-400 tabular-nums">{monthAbsent}</div>
                    <div className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide">Отсутствовал</div>
                  </div>
                </div>
              </div>
              
              <div className="h-px bg-border/50 w-full" />
              
              {/* Homework breakdown */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Домашнее задание</span>
                </div>
                <div className="flex gap-0.5 h-3 rounded-full overflow-hidden bg-muted/50 p-0.5">
                  {monthHwDone > 0 && <div className="bg-emerald-500 rounded-full transition-all" style={{ width: `${monthHwDone / monthTotal * 100}%` }} />}
                  {monthHwPartial > 0 && <div className="bg-amber-500 rounded-full transition-all" style={{ width: `${monthHwPartial / monthTotal * 100}%` }} />}
                  {monthHwNotDone > 0 && <div className="bg-red-500/60 rounded-full transition-all" style={{ width: `${monthHwNotDone / monthTotal * 100}%` }} />}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div>
                    <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{monthHwDone}</div>
                    <div className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide">Выполнено</div>
                  </div>
                  <div>
                    <div className="text-sm font-black text-amber-600 dark:text-amber-400 tabular-nums">{monthHwPartial}</div>
                    <div className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide">Частично</div>
                  </div>
                  <div>
                    <div className="text-sm font-black text-red-600/70 dark:text-red-400/70 tabular-nums">{monthHwNotDone}</div>
                    <div className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide">Не сделано</div>
                  </div>
                </div>
              </div>
            </div>
          </PanelSection>

          {/* ── ENT SCORES FOR MONTH ── */}
          <PanelSection title="Баллы ЕНТ" icon={<GraduationCap className="h-4 w-4" />} empty={!entMonth || entMonth.subjects?.length === 0}>
            <div className="space-y-1.5">
              {entMonth?.subjects?.map((sub: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm py-1.5 px-3 rounded-lg bg-muted/30 border border-transparent hover:border-border/50 transition-colors">
                  <span className="text-xs font-medium truncate max-w-[160px]">{sub.name}</span>
                  <span className="font-bold text-sm tabular-nums">{sub.score}</span>
                </div>
              ))}
              <div className="flex items-center justify-between text-sm py-2 px-3 mt-2 rounded-lg bg-primary/5 border border-primary/10">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Итого</span>
                <span className="font-black tabular-nums text-primary text-base">{entMonth?.total}</span>
              </div>
            </div>
          </PanelSection>

          {/* ── LESSON NOTES ── */}
          <PanelSection title="Заметки уроков" icon={<MessageSquare className="h-4 w-4" />} empty={lessonComments.length === 0}>
            <div className="space-y-2">
              {lessonComments.map((c: any, i: number) => (
                <div key={i} className="p-3 rounded-xl border border-border/40 bg-muted/20 text-xs space-y-1.5 relative overflow-hidden group hover:border-primary/20 hover:bg-muted/40 transition-colors">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/40 rounded-l-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex items-center flex-wrap gap-2 text-muted-foreground">
                    <span className="tabular-nums font-semibold text-foreground/70">{c.date}</span>
                    <div className="flex gap-1.5 ml-auto">
                      {c.teacher_name && <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-background">{c.teacher_name}</Badge>}
                      {c.subject_name && <Badge variant="secondary" className="text-[9px] h-4 px-1.5">{c.subject_name}</Badge>}
                    </div>
                  </div>
                  <p className="text-foreground leading-relaxed whitespace-pre-wrap">{c.comment}</p>
                </div>
              ))}
            </div>
          </PanelSection>

          {/* ── TEACHER FEEDBACK ── */}
          <PanelSection title="Обратная связь учителей" icon={<Star className="h-4 w-4" />} empty={teacherFeedback.length === 0}>
            <div className="space-y-2">
              {teacherFeedback.map((f: any, i: number) => (
                <div key={i} className="p-3 rounded-xl border border-border/40 bg-muted/20 text-xs space-y-1.5 relative overflow-hidden group hover:border-amber-500/20 hover:bg-muted/40 transition-colors">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500/40 rounded-l-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                      {f.teacher_name.charAt(0)}
                    </div>
                    <span className="font-semibold text-foreground">{f.teacher_name}</span>
                    {f.subject_name && <Badge variant="outline" className="text-[9px] h-4 px-1.5 ml-auto bg-background">{f.subject_name}</Badge>}
                  </div>
                  <p className="text-foreground/90 italic pl-7">&ldquo;{f.comment}&rdquo;</p>
                </div>
              ))}
            </div>
          </PanelSection>

          {/* ── ATTENDANCE TABLE ── */}
          <PanelSection title="Табель посещения" icon={<Calendar className="h-4 w-4" />} count={monthTotal > 0 ? `${monthPresent}/${monthTotal}` : undefined} empty={monthTotal === 0}>
            <div className="space-y-1">
              {monthRecords.map((r: any, i: number) => (
                <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/50 text-xs transition-colors border border-transparent hover:border-border/50">
                  <span className="w-10 shrink-0 font-medium text-foreground/80 tabular-nums">{r.date?.slice(5)}</span>
                  <div className="bg-background rounded-full p-0.5 shadow-sm border border-border/30">
                    {r.status === "present" ? (
                      r.lateness === "late" ? <Clock className="h-4 w-4 text-amber-500 shrink-0" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
                  </div>
                  <span className="flex-1 truncate font-semibold text-foreground/90">{r.subject ?? "—"}</span>
                  {r.teacher && <span className="text-[10px] font-medium bg-muted/60 px-1.5 py-0.5 rounded text-muted-foreground truncate max-w-[80px]">{r.teacher}</span>}
                </div>
              ))}
            </div>
          </PanelSection>

          {/* ── HOMEWORK TABLE ── */}
          <PanelSection title="Табель ДЗ" icon={<BookOpen className="h-4 w-4" />} count={monthTotal > 0 ? `${monthHwDone}/${monthTotal}` : undefined} empty={monthTotal === 0}>
            <div className="space-y-1">
              {monthRecords.map((r: any, i: number) => (
                <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/50 text-xs transition-colors border border-transparent hover:border-border/50">
                  <span className="w-10 shrink-0 font-medium text-foreground/80 tabular-nums">{r.date?.slice(5)}</span>
                  <div className="bg-background rounded-full p-0.5 shadow-sm border border-border/30">
                    {r.homework === "done" ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      : r.homework === "partial" ? <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                      : <BookX className="h-4 w-4 text-muted-foreground/50 shrink-0" />}
                  </div>
                  <span className="flex-1 truncate font-semibold text-foreground/90">{r.subject ?? "—"}</span>
                  {r.comment && <span className="text-[12px] opacity-80 cursor-help transition-opacity hover:opacity-100" title={r.comment}>💬</span>}
                </div>
              ))}
            </div>
          </PanelSection>
        </div>
      )}
    </div>
  );
}

function PanelSection({ title, icon, children, count, empty }: { title: string; icon: React.ReactNode; children: React.ReactNode; count?: string; empty?: boolean }) {
  if (empty) return null;
  return (
    <div className="bg-card border border-border/40 shadow-sm rounded-2xl overflow-hidden group hover:border-border/80 transition-colors">
      <div className="flex items-center gap-2.5 px-4 py-3 bg-muted/20 border-b border-border/30">
        <div className="p-1.5 rounded-lg bg-background shadow-sm text-foreground/70 ring-1 ring-border/50 group-hover:text-primary group-hover:ring-primary/30 transition-all">{icon}</div>
        <h3 className="text-[11px] font-black uppercase tracking-widest text-foreground/80">{title}</h3>
        {count && <Badge variant="secondary" className="ml-auto text-[10px] h-5.5 font-bold bg-background shadow-sm border-border/50">{count}</Badge>}
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent: "green" | "red" | "amber" | "blue" | "default" }) {
  const cls = { default: "text-muted-foreground", green: "text-emerald-600 dark:text-emerald-500", red: "text-red-600 dark:text-red-500", amber: "text-amber-600 dark:text-amber-500", blue: "text-blue-600 dark:text-blue-500" }[accent];
  const bg = { default: "bg-muted/30", green: "bg-emerald-500/10 border-emerald-500/20", red: "bg-red-500/10 border-red-500/20", amber: "bg-amber-500/10 border-amber-500/20", blue: "bg-blue-500/10 border-blue-500/20" }[accent];
  return (
    <div className={cn("rounded-2xl border p-3 flex flex-col items-center justify-center gap-1.5 transition-colors shadow-sm", bg, accent === 'default' ? 'border-border/40' : '')}>
      <div className={cn("text-2xl font-black tabular-nums leading-none tracking-tight", cls)}>{value}</div>
      <div className="text-[10px] text-foreground/60 uppercase font-bold tracking-wider">{label}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground italic text-center py-3">{text}</p>;
}

/* ═══════ MAIN PAGE ═══════ */

export default function StudentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: groupsData } = useGroups();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroupsState] = useState<any[]>([]);
  const groupsToUse = groupsData || groups;
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("full_name");
  const [sortAsc, setSortAsc] = useState(true);
  const { toast } = useToast();
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Advanced Filters
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [attFilter, setAttFilter] = useState<string>("all");
  const [entFilter, setEntFilter] = useState<string>("all");

  const hasFilters = search !== "" || selectedGroup !== "all" || statusFilter !== "active" || attFilter !== "all" || entFilter !== "all";
  const clearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setSelectedGroup("all");
    setStatusFilter("active");
    setAttFilter("all");
    setEntFilter("all");
    setPage(0);
  };

  // 360 Panel state
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelStudentId, setPanelStudentId] = useState<number | null>(null);
  const [panelData, setPanelData] = useState<any>(null);
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelMonth, setPanelMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [teacherFeedback, setTeacherFeedback] = useState<any[]>([]);
  const [lessonComments, setLessonComments] = useState<any[]>([]);
  const [refresh, setRefresh] = useState(0);

  // Modals state
  const [addStudentModalOpen, setAddStudentModalOpen] = useState(false);
  const [newStudent, setNewStudent] = useState({ first_name: "", last_name: "", phone: "", parent_name: "", parent_phone: "", group_id: "" });
  const [importModalOpen, setImportModalOpen] = useState(false);

    const handleAddStudent = async () => {
    if (!newStudent.first_name || !newStudent.last_name) return toast({ title: "Ошибка", description: "Укажите имя и фамилию ученика" });
    try {
      const full_name = `${newStudent.first_name} ${newStudent.last_name}`.trim();
      const data = {
        full_name,
        phone: newStudent.phone || null,
        parent_phone: newStudent.parent_phone || null,
        parent_name: newStudent.parent_name || null,
        group_id: newStudent.group_id ? parseInt(newStudent.group_id) : null,
        status: "active"
      };
      await createStudent(data);
      toast({ title: "Успех", description: "Ученик добавлен" });
      setAddStudentModalOpen(false);
      setRefresh(r => r + 1);
    } catch (e: any) { toast({ title: "Ошибка", description: e.message, variant: "destructive" }); }
  };

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    const isInitial = students.length === 0;
    if (isInitial) setLoading(true); else setFetching(true);
    
    let att_min, att_max, ent_min, ent_max;
    if (attFilter === "high") { att_min = 90; }
    else if (attFilter === "mid") { att_min = 75; att_max = 89.9; }
    else if (attFilter === "low") { att_max = 74.9; }

    if (entFilter === "high") { ent_min = 120; }
    else if (entFilter === "mid") { ent_min = 90; ent_max = 119; }
    else if (entFilter === "low") { ent_max = 89; }

    fetchStudentsPaginated({
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      search: debouncedSearch || undefined,
      group_id: selectedGroup !== "all" ? parseInt(selectedGroup) : undefined,
      status: statusFilter,
      sort: sortKey,
      sort_dir: sortAsc ? "asc" : "desc",
      att_min, att_max, ent_min, ent_max
    }).then(({ students: result, total: t }) => {
      if (!cancelled) { setStudents(Array.isArray(result) ? result : []); setTotal(t ?? 0); setLoading(false); setFetching(false); }
    }).catch(() => {
      if (!cancelled) {
        toast({ title: "Ошибка загрузки учеников", variant: "destructive" });
        setLoading(false); setFetching(false);
      }
    });
    return () => { cancelled = true; };
  }, [page, debouncedSearch, selectedGroup, sortKey, sortAsc, statusFilter, attFilter, entFilter, refresh]);

  // Handle command palette focus=search action
  useEffect(() => {
    if (searchParams.get("focus") === "search") {
      searchParams.delete("focus");
      setSearchParams(searchParams, { replace: true });
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [searchParams, setSearchParams]);

  const openPanel = useCallback(async (studentId: number) => {
    setPanelStudentId(studentId);
    setPanelOpen(true);
    setPanelLoading(true);
    setPanelData(null);
    setTeacherFeedback([]);
    setLessonComments([]);
    try {
      const month = panelMonth;
      const range = getMonthRange(month);
      const [data, tf, lc] = await Promise.all([
        fetchStudent360(studentId),
        fetchTeacherFeedbackByStudent(studentId, month),
        range ? fetchLessonCommentsByStudent({ studentId, from: range.from, to: range.to, limit: 200 }) : Promise.resolve([]),
      ]);
      setPanelData(data);
      setTeacherFeedback(tf || []);
      setLessonComments(lc || []);
    } catch (error) { console.error("Error loading student 360:", error); }
    finally { setPanelLoading(false); }
  }, [panelMonth]);

  // Reload feedback/comments when month changes while panel is open
  useEffect(() => {
    if (!panelOpen || !panelStudentId) return;
    const range = getMonthRange(panelMonth);
    Promise.all([
      fetchTeacherFeedbackByStudent(panelStudentId, panelMonth),
      range ? fetchLessonCommentsByStudent({ studentId: panelStudentId, from: range.from, to: range.to, limit: 200 }) : Promise.resolve([]),
    ]).then(([tf, lc]) => {
      setTeacherFeedback(tf || []);
      setLessonComments(lc || []);
    });
  }, [panelMonth, panelOpen, panelStudentId]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
    setPage(0);
  };

  const rateColor = (rate: number | null | undefined) => {
    if (rate === null || rate === undefined) return "text-muted-foreground";
    if (rate >= 90) return "text-green-600"; if (rate >= 70) return "text-amber-600"; return "text-red-600";
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div><Skeleton className="h-6 w-40" /><Skeleton className="h-4 w-56 mt-1" /></div>
        </div>
        <Skeleton className="h-10 w-full rounded-lg" />
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
      </div>
    );
  }

  return (
    <div>
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Ученики</h1>
          <Badge variant="secondary" className="font-mono text-sm">{total}</Badge>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-1.5 h-8">
                <Plus className="h-3.5 w-3.5" /> Добавить
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setAddStudentModalOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" /> Вручную
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setImportModalOpen(true)}>
                <Upload className="h-4 w-4 mr-2" /> Импорт из Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-3 mb-4">
        {/* Top row: Search and main group select */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="relative flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input ref={searchInputRef} placeholder="Поиск по имени..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9 bg-background" />
          </div>
          <Select value={selectedGroup} onValueChange={(v) => { setSelectedGroup(v); setPage(0); }}>
            <SelectTrigger className="w-full sm:w-48 bg-background">
              <Filter className="h-4 w-4 mr-2" /><SelectValue placeholder="Все группы" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все группы</SelectItem>
              {groupsToUse.map((group) => (
                <SelectItem key={group.id} value={group.id.toString()}>
                  <span className="flex items-center gap-1.5"><GroupPersonAvatar groupName={group.name} avatarUrl={group.avatar_url} size={18} showTooltip={false} />{group.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Bottom row: Advanced filters */}
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[140px] h-8 text-xs bg-muted/50 border-dashed hover:bg-muted/80 transition-colors">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все (включая архив)</SelectItem>
              <SelectItem value="active">Активные</SelectItem>
              <SelectItem value="archived">В архиве</SelectItem>
            </SelectContent>
          </Select>

          <Select value={attFilter} onValueChange={(v) => { setAttFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[180px] h-8 text-xs bg-muted/50 border-dashed hover:bg-muted/80 transition-colors">
              <Calendar className="h-3 w-3 mr-1.5 opacity-70" />
              <SelectValue placeholder="Посещаемость" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Без фильтра</SelectItem>
              <SelectItem value="high">Отличная (≥ 90% за всё время)</SelectItem>
              <SelectItem value="mid">Средняя (75-89% за всё время)</SelectItem>
              <SelectItem value="low">Низкая (&lt; 75% за всё время)</SelectItem>
            </SelectContent>
          </Select>

          <Select value={entFilter} onValueChange={(v) => { setEntFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[180px] h-8 text-xs bg-muted/50 border-dashed hover:bg-muted/80 transition-colors">
              <GraduationCap className="h-3 w-3 mr-1.5 opacity-70" />
              <SelectValue placeholder="Балл ЕНТ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Без фильтра</SelectItem>
              <SelectItem value="high">Высокий (≥ 120, посл. срез)</SelectItem>
              <SelectItem value="mid">Средний (90-119, посл. срез)</SelectItem>
              <SelectItem value="low">Низкий (&lt; 90, посл. срез)</SelectItem>
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs text-muted-foreground hover:text-foreground">
              Сбросить фильтры
            </Button>
          )}
        </div>
      </div>

      {/* Students Table */}
      <Card className={fetching ? "opacity-60 pointer-events-none" : ""}>
        <div className="overflow-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <button onClick={() => handleSort("full_name")} className="flex items-center gap-1 hover:text-foreground">ФИО <ArrowUpDown className="h-3 w-3" /></button>
                </th>
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <button onClick={() => handleSort("group_name")} className="flex items-center gap-1 hover:text-foreground">Группа <ArrowUpDown className="h-3 w-3" /></button>
                </th>
                <th className="text-left p-2 md:p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                  <Phone className="h-3 w-3 inline mr-1" />Телефон
                </th>
                <th className="text-center p-2 md:p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <button onClick={() => handleSort("attendance_rate")} className="flex items-center gap-1 hover:text-foreground mx-auto">
                    <span className="hidden sm:inline">Посещ</span><span className="sm:hidden">%</span> <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="text-center p-2 md:p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                  <button onClick={() => handleSort("last_ent_score")} className="flex items-center gap-1 hover:text-foreground mx-auto">ЕНТ <ArrowUpDown className="h-3 w-3" /></button>
                </th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id}
                  onClick={() => openPanel(student.id)}
                  className="border-b hover:bg-muted/30 cursor-pointer transition-colors">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <UserAvatar user={student} size="sm" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-sm">{student.full_name}</p>
                          {student.status === "archived" && student.graduation_year && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1 py-0">{student.graduation_year}</Badge>
                          )}
                        </div>
                        {student.parent_name && <p className="text-[11px] text-muted-foreground">Родитель: {student.parent_name}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    {student.group_name ? (
                      <Badge variant="outline" className="text-xs flex w-max items-center gap-1.5 px-2 py-0.5">
                        <GroupPersonAvatar groupName={student.group_name} avatarUrl={student.group_avatar} size={14} showTooltip={false} />
                        {student.group_name}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-2 md:p-3 hidden md:table-cell text-sm text-muted-foreground">{student.phone || "—"}</td>
                  <td className="p-2 md:p-3 text-center">
                    {student.attendance_rate !== null && student.attendance_rate !== undefined ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16"><Progress value={student.attendance_rate} className="h-1.5" /></div>
                        <span className={`text-xs font-medium ${rateColor(student.attendance_rate)}`}>{Math.round(student.attendance_rate)}%</span>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="p-2 md:p-3 text-center hidden sm:table-cell">
                    {student.last_ent_score ? <Badge variant="secondary" className="text-xs font-medium">{student.last_ent_score}</Badge>
                      : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && students.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Ученики не найдены</p>
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between mt-3 px-1">
        <p className="text-xs text-muted-foreground">
          {total > 0 ? `Стр. ${page + 1} из ${Math.ceil(total / PAGE_SIZE)} • всего ${total}` : ""}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 0 || fetching}>Назад</Button>
          <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE_SIZE >= total || fetching}>Вперёд</Button>
        </div>
      </div>

      {/* ── 360 PANEL (Sheet) ── */}
      <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md md:max-w-lg overflow-y-auto p-0">
          {/* Panel header with month selector */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-4 py-3 flex items-center justify-between gap-2">
            <SheetTitle className="text-sm font-semibold text-foreground truncate">Профиль 360°</SheetTitle>
            <Select value={panelMonth} onValueChange={setPanelMonth}>
              <SelectTrigger className="w-32 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_OPTIONS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="px-4 py-4">
            <Student360Panel
              data={panelData}
              month={panelMonth}
              teacherFeedback={teacherFeedback}
              lessonComments={lessonComments}
              loading={panelLoading}
              onOpenFull={panelStudentId ? () => { setPanelOpen(false); navigate(`/students/${panelStudentId}`); } : undefined}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* ── MODALS ── */}
      {/* Add Student Manually */}
      <Dialog open={addStudentModalOpen} onOpenChange={setAddStudentModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Добавить ученика</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Имя *</Label><Input value={newStudent.first_name} onChange={e => setNewStudent({...newStudent, first_name: e.target.value})} placeholder="Иван" /></div>
              <div><Label>Фамилия *</Label><Input value={newStudent.last_name} onChange={e => setNewStudent({...newStudent, last_name: e.target.value})} placeholder="Иванов" /></div>
            </div>
            <div><Label>Телефон</Label><Input value={newStudent.phone} onChange={e => setNewStudent({...newStudent, phone: e.target.value})} placeholder="+7 777 123 4567" /></div>
            <div><Label>Группа</Label>
              <Select value={newStudent.group_id} onValueChange={v => setNewStudent({...newStudent, group_id: v})}>
                <SelectTrigger><SelectValue placeholder="Выберите группу" /></SelectTrigger>
                <SelectContent>
                  {groupsToUse.map(g => (
                    <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>ФИО родителя</Label><Input value={newStudent.parent_name} onChange={e => setNewStudent({...newStudent, parent_name: e.target.value})} /></div>
            <div><Label>Телефон родителя</Label><Input value={newStudent.parent_phone} onChange={e => setNewStudent({...newStudent, parent_phone: e.target.value})} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddStudentModalOpen(false)}>Отмена</Button>
            <Button onClick={handleAddStudent}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Excel */}
      <BulkImportModal open={importModalOpen} onOpenChange={setImportModalOpen} onSuccess={() => setRefresh(r => r + 1)} />

    </div>
  );
}
