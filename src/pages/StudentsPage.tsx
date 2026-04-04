import { Users, Filter, Calendar, BookOpen, Search, Phone, GraduationCap, ArrowUpDown, MessageSquare, CheckCircle2, XCircle, Clock, BookX, Star, FileDown, BarChart3 } from "lucide-react";
import { GroupPersonAvatar } from "@/components/GroupPersonAvatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchStudents, fetchGroups, fetchTeacherFeedbackByStudent, fetchLessonCommentsByStudent } from "@/lib/api";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/contexts/AuthContext";
import { formatPhone, cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Group { id: number; name: string; curator_id?: number }
interface Student {
  id: number; full_name: string; phone?: string; parent_phone?: string; parent_name?: string;
  group_id?: number; group_name?: string; attendance_rate?: number | null; last_ent_score?: number | null;
  status?: string; avatar_url?: string | null;
}
type SortKey = "full_name" | "group_name" | "attendance_rate" | "last_ent_score";

const API_BASE = (import.meta as any).env?.VITE_API_URL || "/api";

const MONTH_OPTIONS = [
  { value: "2025-09", label: "Сент 2025" }, { value: "2025-10", label: "Окт 2025" },
  { value: "2025-11", label: "Нояб 2025" }, { value: "2025-12", label: "Дек 2025" },
  { value: "2026-01", label: "Янв 2026" }, { value: "2026-02", label: "Фев 2026" },
  { value: "2026-03", label: "Март 2026" }, { value: "2026-04", label: "Апр 2026" },
  { value: "2026-05", label: "Май 2026" },
];

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
function Student360Panel({ data, month, teacherFeedback, lessonComments, loading }: {
  data: any; month: string; teacherFeedback: any[]; lessonComments: any[]; loading: boolean;
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

  return (
    <div className="space-y-5">
      {/* ── FIXED STUDENT HEADER ── */}
      <div className="flex gap-3 items-start">
        <div className="relative shrink-0">
          {s.avatar_url && !avatarError ? (
            <img src={s.avatar_url} alt="" onError={() => setAvatarError(true)}
              className="w-14 h-14 rounded-xl object-cover ring-2 ring-border shadow-sm" />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground ring-1 ring-border">
              {initials}
            </div>
          )}
          <span className={cn("absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background",
            s.status === "active" ? "bg-emerald-500" : "bg-amber-500")} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-foreground leading-tight truncate">{s.full_name}</h2>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            {s.group?.name && <Badge variant="secondary" className="text-[10px]">{s.group.name}</Badge>}
            {s.group?.profileName && <Badge variant="outline" className="text-[10px]">{s.group.profileName}</Badge>}
            <span className="text-[10px] text-muted-foreground">ID: {s.id}</span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[11px] text-muted-foreground">
            {s.phone && <a href={`tel:${s.phone}`} className="flex items-center gap-1 hover:text-foreground"><Phone className="h-3 w-3" />{formatPhone(s.phone)}</a>}
            {s.parentPhone && <span className="flex items-center gap-1"><Phone className="h-3 w-3 text-amber-500" />{s.parentName || "Родитель"}: {formatPhone(s.parentPhone)}</span>}
          </div>
          {s.group?.curatorName && <p className="text-[10px] text-muted-foreground mt-0.5"><Star className="h-2.5 w-2.5 inline text-amber-400 mr-0.5" />Куратор: {s.group.curatorName}</p>}

          {/* Quick actions */}
          <div className="flex gap-1.5 mt-2">
            {s.parentPhone && (
              <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] gap-1"
                onClick={() => window.open(`https://wa.me/${s.parentPhone.replace(/\D/g, "")}`, "_blank")}>
                <MessageSquare className="h-3 w-3 text-emerald-500" /> WhatsApp
              </Button>
            )}
            {s.parentPhone && (
              <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] gap-1"
                onClick={() => window.open(`tel:${s.parentPhone}`)}>
                <Phone className="h-3 w-3" /> Позвонить
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── KPI ROW ── */}
      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="Посещаемость" value={monthAttRate !== null ? `${monthAttRate}%` : "—"} accent={monthAttRate === null ? "default" : monthAttRate >= 90 ? "green" : monthAttRate >= 75 ? "amber" : "red"} />
        <MiniStat label="ЕНТ" value={entMonth ? String(entMonth.total) : (h.entLastScore != null ? String(h.entLastScore) : "—")} accent="blue" />
        <MiniStat label="ДЗ" value={monthHwRate !== null ? `${monthHwRate}%` : "—"} accent={monthHwRate === null ? "default" : monthHwRate >= 85 ? "green" : monthHwRate >= 60 ? "amber" : "red"} />
      </div>

      {/* ── MONTHLY SUMMARY STATS ── */}
      <PanelSection title={`Сводка за ${monthLabel}`} icon={<BarChart3 className="h-3.5 w-3.5" />}>
        {monthTotal > 0 ? (
          <div className="space-y-3">
            {/* Attendance breakdown */}
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Посещение</span>
                <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">{monthTotal} уроков</span>
              </div>
              <div className="flex gap-1 h-2.5 rounded-full overflow-hidden bg-muted">
                {monthPresent > 0 && <div className="bg-emerald-500 transition-all" style={{ width: `${monthPresent / monthTotal * 100}%` }} />}
                {monthLate > 0 && <div className="bg-amber-500 transition-all" style={{ width: `${monthLate / monthTotal * 100}%` }} />}
                {monthAbsent > 0 && <div className="bg-red-500 transition-all" style={{ width: `${monthAbsent / monthTotal * 100}%` }} />}
              </div>
              <div className="grid grid-cols-3 gap-1 text-center">
                <div className="rounded-md bg-emerald-500/10 py-1.5">
                  <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{monthPresent}</div>
                  <div className="text-[9px] text-muted-foreground">Присутствовал</div>
                </div>
                <div className="rounded-md bg-amber-500/10 py-1.5">
                  <div className="text-sm font-bold text-amber-600 dark:text-amber-400 tabular-nums">{monthLate}</div>
                  <div className="text-[9px] text-muted-foreground">Опоздания</div>
                </div>
                <div className="rounded-md bg-red-500/10 py-1.5">
                  <div className="text-sm font-bold text-red-600 dark:text-red-400 tabular-nums">{monthAbsent}</div>
                  <div className="text-[9px] text-muted-foreground">Отсутствовал</div>
                </div>
              </div>
            </div>
            {/* Homework breakdown */}
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center gap-1.5 mb-1">
                <BookOpen className="h-3 w-3 text-muted-foreground" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Домашнее задание</span>
              </div>
              <div className="flex gap-1 h-2.5 rounded-full overflow-hidden bg-muted">
                {monthHwDone > 0 && <div className="bg-emerald-500 transition-all" style={{ width: `${monthHwDone / monthTotal * 100}%` }} />}
                {monthHwPartial > 0 && <div className="bg-amber-500 transition-all" style={{ width: `${monthHwPartial / monthTotal * 100}%` }} />}
                {monthHwNotDone > 0 && <div className="bg-red-500/60 transition-all" style={{ width: `${monthHwNotDone / monthTotal * 100}%` }} />}
              </div>
              <div className="grid grid-cols-3 gap-1 text-center">
                <div className="rounded-md bg-emerald-500/10 py-1.5">
                  <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{monthHwDone}</div>
                  <div className="text-[9px] text-muted-foreground">Выполнено</div>
                </div>
                <div className="rounded-md bg-amber-500/10 py-1.5">
                  <div className="text-sm font-bold text-amber-600 dark:text-amber-400 tabular-nums">{monthHwPartial}</div>
                  <div className="text-[9px] text-muted-foreground">Частично</div>
                </div>
                <div className="rounded-md bg-red-500/10 py-1.5">
                  <div className="text-sm font-bold text-red-600/70 dark:text-red-400/70 tabular-nums">{monthHwNotDone}</div>
                  <div className="text-[9px] text-muted-foreground">Не сделано</div>
                </div>
              </div>
            </div>
          </div>
        ) : <EmptyState text="Нет данных за этот месяц" />}
      </PanelSection>

      {/* ── EXPORT PDF BUTTON ── */}
      <Button variant="outline" className="w-full gap-2" onClick={exportPDF} disabled={exporting}>
        <FileDown className="h-4 w-4" /> {exporting ? "Генерация PDF..." : "Экспорт PDF"}
      </Button>

      {/* ── ENT SCORES FOR MONTH ── */}
      <PanelSection title="Баллы ЕНТ" icon={<GraduationCap className="h-3.5 w-3.5" />}>
        {entMonth && entMonth.subjects?.length > 0 ? (
          <div className="space-y-1.5">
            {entMonth.subjects.map((sub: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm py-1 px-2 rounded-md bg-muted/40">
                <span className="text-xs truncate max-w-[160px]">{sub.name}</span>
                <span className="font-bold text-sm tabular-nums">{sub.score}</span>
              </div>
            ))}
            <div className="flex items-center justify-between text-sm py-1.5 px-2 rounded-md bg-primary/10 font-semibold">
              <span className="text-xs">Итого</span>
              <span className="font-black tabular-nums">{entMonth.total}</span>
            </div>
          </div>
        ) : <EmptyState text="Нет данных ЕНТ за этот месяц" />}
      </PanelSection>

      {/* ── LESSON NOTES ── */}
      <PanelSection title="Заметки уроков" icon={<MessageSquare className="h-3.5 w-3.5" />}>
        {lessonComments.length > 0 ? (
          <div className="space-y-1.5">
            {lessonComments.map((c: any, i: number) => (
              <div key={i} className="p-2 rounded-md border border-border/60 text-xs space-y-0.5">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="tabular-nums">{c.date}</span>
                  {c.teacher_name && <Badge variant="outline" className="text-[9px] h-4 px-1">{c.teacher_name}</Badge>}
                  {c.subject_name && <Badge variant="secondary" className="text-[9px] h-4 px-1">{c.subject_name}</Badge>}
                </div>
                <p className="text-foreground whitespace-pre-wrap">{c.comment}</p>
              </div>
            ))}
          </div>
        ) : <EmptyState text="Нет заметок за этот месяц" />}
      </PanelSection>

      {/* ── TEACHER FEEDBACK ── */}
      <PanelSection title="Обратная связь учителей" icon={<Star className="h-3.5 w-3.5" />}>
        {teacherFeedback.length > 0 ? (
          <div className="space-y-1.5">
            {teacherFeedback.map((f: any, i: number) => (
              <div key={i} className="p-2 rounded-md border border-border/60 text-xs space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-foreground">{f.teacher_name}</span>
                  {f.subject_name && <Badge variant="outline" className="text-[9px] h-4 px-1">{f.subject_name}</Badge>}
                </div>
                <p className="text-muted-foreground italic">&ldquo;{f.comment}&rdquo;</p>
              </div>
            ))}
          </div>
        ) : <EmptyState text="Нет отзывов за этот месяц" />}
      </PanelSection>

      {/* ── ATTENDANCE TABLE ── */}
      <PanelSection title="Табель посещения" icon={<Calendar className="h-3.5 w-3.5" />} count={monthTotal > 0 ? `${monthPresent}/${monthTotal}` : undefined}>
        {monthTotal > 0 ? (
          <div className="space-y-0.5">
            {monthRecords.map((r: any, i: number) => (
              <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/40 text-xs transition-colors">
                <span className="w-14 shrink-0 text-muted-foreground tabular-nums">{r.date?.slice(5)}</span>
                {r.status === "present" ? (
                  r.lateness === "late" ? <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                ) : <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                <span className="flex-1 truncate font-medium">{r.subject ?? "—"}</span>
                {r.teacher && <span className="text-[10px] text-muted-foreground truncate max-w-[60px]">{r.teacher}</span>}
              </div>
            ))}
            {monthLate > 0 && <p className="text-[10px] text-amber-600 mt-1 px-2">Опозданий: {monthLate}</p>}
          </div>
        ) : <EmptyState text="Нет данных о посещении за этот месяц" />}
      </PanelSection>

      {/* ── HOMEWORK TABLE ── */}
      <PanelSection title="Табель ДЗ" icon={<BookOpen className="h-3.5 w-3.5" />} count={monthTotal > 0 ? `${monthHwDone}/${monthTotal}` : undefined}>
        {monthTotal > 0 ? (
          <div className="space-y-0.5">
            {monthRecords.map((r: any, i: number) => (
              <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/40 text-xs transition-colors">
                <span className="w-14 shrink-0 text-muted-foreground tabular-nums">{r.date?.slice(5)}</span>
                {r.homework === "done" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  : r.homework === "partial" ? <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  : <BookX className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />}
                <span className="flex-1 truncate font-medium">{r.subject ?? "—"}</span>
                {r.comment && <span className="text-[10px] text-muted-foreground truncate max-w-[80px]" title={r.comment}>💬</span>}
              </div>
            ))}
          </div>
        ) : <EmptyState text="Нет данных о ДЗ за этот месяц" />}
      </PanelSection>
    </div>
  );
}

function PanelSection({ title, icon, children, count }: { title: string; icon: React.ReactNode; children: React.ReactNode; count?: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        {count && <span className="ml-auto text-[10px] font-medium text-muted-foreground tabular-nums">{count}</span>}
      </div>
      {children}
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent: "green" | "red" | "amber" | "blue" | "default" }) {
  const cls = { default: "text-muted-foreground", green: "text-emerald-600 dark:text-emerald-400", red: "text-red-600 dark:text-red-400", amber: "text-amber-600 dark:text-amber-400", blue: "text-blue-600 dark:text-blue-400" }[accent];
  return (
    <div className="rounded-lg border p-2.5 text-center">
      <div className={cn("text-lg font-bold tabular-nums leading-none", cls)}>{value}</div>
      <div className="text-[9px] text-muted-foreground uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground italic text-center py-3">{text}</p>;
}

/* ═══════ MAIN PAGE ═══════ */

export default function StudentsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("full_name");
  const [sortAsc, setSortAsc] = useState(true);

  // 360 Panel state
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelStudentId, setPanelStudentId] = useState<number | null>(null);
  const [panelData, setPanelData] = useState<any>(null);
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelMonth, setPanelMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [teacherFeedback, setTeacherFeedback] = useState<any[]>([]);
  const [lessonComments, setLessonComments] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [studentsData, groupsData] = await Promise.all([fetchStudents(), fetchGroups()]);
        setStudents(studentsData);
        setGroups(groupsData);
      } catch (error) { console.error("Error loading data:", error); }
      finally { setLoading(false); }
    };
    loadData();
  }, []);

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

  const filteredStudents = useMemo(() => {
    let result = students.filter((student) => {
      const matchesSearch = student.full_name.toLowerCase().includes(search.toLowerCase());
      const matchesGroup = selectedGroup === "all" || student.group_id?.toString() === selectedGroup;
      return matchesSearch && matchesGroup;
    });
    result.sort((a, b) => {
      let av: any = a[sortKey] ?? "";
      let bv: any = b[sortKey] ?? "";
      if (typeof av === "number" && typeof bv === "number") return sortAsc ? av - bv : bv - av;
      if (av === null || av === undefined) av = "";
      if (bv === null || bv === undefined) bv = "";
      return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return result;
  }, [students, search, selectedGroup, sortKey, sortAsc]);

  const stats = useMemo(() => {
    const total = students.length;
    const groupCounts = groups.map(g => ({ ...g, count: students.filter(s => s.group_id === g.id).length }));
    return { total, groupCounts };
  }, [students, groups]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
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
      {/* Group pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {stats.groupCounts.map(g => (
          <button key={g.id}
            onClick={() => setSelectedGroup(selectedGroup === g.id.toString() ? "all" : g.id.toString())}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              selectedGroup === g.id.toString() ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}>
            {g.name} ({g.count})
          </button>
        ))}
        {selectedGroup !== "all" && (
          <button onClick={() => setSelectedGroup("all")} className="px-3 py-1 rounded-full text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20">
            Сбросить
          </button>
        )}
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input ref={searchInputRef} placeholder="Поиск по имени..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={selectedGroup} onValueChange={setSelectedGroup}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="h-4 w-4 mr-2" /><SelectValue placeholder="Все группы" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все группы</SelectItem>
            {groups.map((group) => (
              <SelectItem key={group.id} value={group.id.toString()}>
                <span className="flex items-center gap-1.5"><GroupPersonAvatar groupName={group.name} size={18} showTooltip={false} />{group.name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Students Table */}
      <Card>
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
              {filteredStudents.map((student) => (
                <tr key={student.id}
                  onClick={() => openPanel(student.id)}
                  className="border-b hover:bg-muted/30 cursor-pointer transition-colors">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <UserAvatar user={student} size="sm" />
                      <div>
                        <p className="font-medium text-sm">{student.full_name}</p>
                        {student.parent_name && <p className="text-[11px] text-muted-foreground">Родитель: {student.parent_name}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="p-3"><Badge variant="outline" className="text-xs">{student.group_name || "—"}</Badge></td>
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
        {filteredStudents.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Ученики не найдены</p>
          </div>
        )}
      </Card>

      <p className="text-xs text-muted-foreground mt-2 text-right">Показано {filteredStudents.length} из {students.length}</p>

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
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
