import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchGroups, fetchAttendanceReport, fetchEntReport, fetchGroupPerformance,
} from "@/lib/api";
import * as XLSX from "xlsx";
import { addExcelWatermarkSheet } from "@/lib/watermark";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  FileSpreadsheet, Download, CalendarDays, Users, GraduationCap,
  BarChart3, Loader2,
} from "lucide-react";

export default function ExportReportsPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<any[]>([]);

  // Attendance report state
  const [attMonth, setAttMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [attGroupId, setAttGroupId] = useState<string>("all");
  const [attLoading, setAttLoading] = useState(false);

  // ENT report state
  const [entGroupId, setEntGroupId] = useState<string>("all");
  const [entFromMonth, setEntFromMonth] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [entToMonth, setEntToMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [entLoading, setEntLoading] = useState(false);

  // Group performance state
  const [perfGroupId, setPerfGroupId] = useState<string>("");
  const [perfMonths, setPerfMonths] = useState("3");
  const [perfLoading, setPerfLoading] = useState(false);

  useEffect(() => {
    fetchGroups().then(setGroups).catch(() => []);
  }, []);

  // ——————— ATTENDANCE REPORT ———————
  const exportAttendance = async () => {
    setAttLoading(true);
    try {
      const gid = attGroupId !== "all" ? parseInt(attGroupId) : undefined;
      const data = await fetchAttendanceReport(attMonth, gid);

      const wb = XLSX.utils.book_new();

      // Sheet 1: Детализация
      if (data.rows.length > 0) {
        const detailRows = data.rows.map((r: any) => ({
          "Группа": r.group_name || "—",
          "ФИО ученика": r.student_name,
          "Предмет": r.subject_name || "—",
          "Учитель": r.teacher_name || "—",
          "Дата": r.date,
          "Статус": r.status === "present" ? "Присутствует" : r.status === "absent" ? "Отсутствует" : r.status,
          "Опоздание": r.lateness === "late" ? "Да" : "Нет",
          "ДЗ": r.homework === "done" ? "Выполнено" : "Не выполнено",
          "Комментарий": r.comment || "",
        }));
        const ws1 = XLSX.utils.json_to_sheet(detailRows);
        // Auto-width
        const maxWidths = Object.keys(detailRows[0]).map(key =>
          Math.max(key.length, ...detailRows.map((r: any) => String(r[key] || "").length))
        );
        ws1["!cols"] = maxWidths.map(w => ({ wch: Math.min(w + 2, 40) }));
        XLSX.utils.book_append_sheet(wb, ws1, "Детализация");
      }

      // Sheet 2: Сводка по группам
      if (data.summary.length > 0) {
        const summaryRows = data.summary.map((s: any) => ({
          "Группа": s.group_name || "—",
          "Всего записей": s.total,
          "Присутствие": s.present,
          "Отсутствие": s.absent,
          "Опоздания": s.late,
          "Посещаемость %": s.total > 0 ? Math.round((s.present / s.total) * 100) : 0,
        }));
        const ws2 = XLSX.utils.json_to_sheet(summaryRows);
        ws2["!cols"] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(wb, ws2, "Сводка по группам");
      }

      // Sheet 3: Pivot — ученик × дата
      if (data.rows.length > 0) {
        const studentMap = new Map<string, Map<string, string>>();
        const dates = new Set<string>();
        for (const r of data.rows) {
          const key = `${r.group_name}|${r.student_name}`;
          if (!studentMap.has(key)) studentMap.set(key, new Map());
          dates.add(r.date);
          const existing = studentMap.get(key)!.get(r.date);
          const mark = r.status === "present" ? "+" : r.status === "absent" ? "Н" : r.status;
          if (!existing) studentMap.get(key)!.set(r.date, mark);
        }
        const sortedDates = [...dates].sort();
        const pivotRows = [...studentMap.entries()].map(([key, datesMap]) => {
          const [group, name] = key.split("|");
          const row: any = { "Группа": group, "ФИО": name };
          for (const d of sortedDates) {
            row[d] = datesMap.get(d) || "";
          }
          // Count
          const vals = [...datesMap.values()];
          row["Всего"] = vals.length;
          row["Присут."] = vals.filter(v => v === "+").length;
          row["Отсут."] = vals.filter(v => v === "Н").length;
          return row;
        });
        if (pivotRows.length > 0) {
          const ws3 = XLSX.utils.json_to_sheet(pivotRows);
          XLSX.utils.book_append_sheet(wb, ws3, "Ученик × Дата");
        }
      }

      const groupName = attGroupId !== "all"
        ? groups.find(g => g.id === parseInt(attGroupId))?.name || ""
        : "все_группы";
      addExcelWatermarkSheet(XLSX, wb);
      XLSX.writeFile(wb, `Посещаемость_${attMonth}_${groupName}.xlsx`);
      toast.success("Отчёт по посещаемости скачан");
    } catch (e: any) {
      toast.error("Ошибка: " + (e.message || "не удалось загрузить"));
    } finally {
      setAttLoading(false);
    }
  };

  // ——————— ENT REPORT ———————
  const exportEnt = async () => {
    setEntLoading(true);
    try {
      const gid = entGroupId !== "all" ? parseInt(entGroupId) : undefined;
      const data = await fetchEntReport(gid, entFromMonth, entToMonth);

      const wb = XLSX.utils.book_new();

      // Sheet 1: Все результаты
      if (data.rows.length > 0) {
        const rows = data.rows.map((r: any) => ({
          "Группа": r.group_name || "—",
          "ФИО ученика": r.student_name,
          "Предмет": r.subject_name,
          "Балл": r.score,
          "Месяц": r.month,
        }));
        const ws1 = XLSX.utils.json_to_sheet(rows);
        ws1["!cols"] = [{ wch: 20 }, { wch: 30 }, { wch: 25 }, { wch: 8 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, ws1, "Результаты ЕНТ");
      }

      // Sheet 2: Средние по группам
      if (data.groupAvg.length > 0) {
        const avgRows = data.groupAvg.map((r: any) => ({
          "Группа": r.group_name || "—",
          "Месяц": r.month,
          "Средний балл": r.avg_score,
          "Мин. балл": r.min_score,
          "Макс. балл": r.max_score,
          "Учеников": r.students_count,
        }));
        const ws2 = XLSX.utils.json_to_sheet(avgRows);
        ws2["!cols"] = [{ wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, ws2, "Средние по группам");
      }

      // Sheet 3: Pivot — ученик × месяц (один предмет → суммарный балл за месяц)
      if (data.rows.length > 0) {
        const studentScores = new Map<string, Map<string, number>>();
        const months = new Set<string>();
        for (const r of data.rows) {
          const key = `${r.group_name}|${r.student_name}`;
          if (!studentScores.has(key)) studentScores.set(key, new Map());
          months.add(r.month);
          // Sum all subjects for that month
          const prev = studentScores.get(key)!.get(r.month) || 0;
          studentScores.get(key)!.set(r.month, prev + r.score);
        }
        const sortedMonths = [...months].sort();
        const pivotRows = [...studentScores.entries()].map(([key, mMap]) => {
          const [group, name] = key.split("|");
          const row: any = { "Группа": group, "ФИО": name };
          for (const m of sortedMonths) row[m] = mMap.get(m) ?? "";
          // Trend
          const scores = sortedMonths.map(m => mMap.get(m)).filter(Boolean) as number[];
          if (scores.length >= 2) {
            row["Динамика"] = scores[scores.length - 1] - scores[0] > 0
              ? `+${scores[scores.length - 1] - scores[0]}`
              : String(scores[scores.length - 1] - scores[0]);
          }
          return row;
        });
        if (pivotRows.length > 0) {
          const ws3 = XLSX.utils.json_to_sheet(pivotRows);
          XLSX.utils.book_append_sheet(wb, ws3, "Ученик × Месяц");
        }
      }

      addExcelWatermarkSheet(XLSX, wb);
      XLSX.writeFile(wb, `ЕНТ_динамика_${entFromMonth}_${entToMonth}.xlsx`);
      toast.success("Отчёт по ЕНТ скачан");
    } catch (e: any) {
      toast.error("Ошибка: " + (e.message || "не удалось загрузить"));
    } finally {
      setEntLoading(false);
    }
  };

  // ——————— GROUP PERFORMANCE ———————
  const exportGroupPerformance = async () => {
    if (!perfGroupId) return toast.error("Выберите группу");
    setPerfLoading(true);
    try {
      const gid = parseInt(perfGroupId);
      const data = await fetchGroupPerformance(gid, parseInt(perfMonths));

      const wb = XLSX.utils.book_new();

      // Sheet 1: Посещаемость по ученикам
      const attMap = new Map<number, any>();
      for (const a of data.attendanceByStudent) attMap.set(a.student_id, a);

      const studentRows = data.students.map((s: any) => {
        const att = attMap.get(s.id) || { present: 0, absent: 0, late: 0, total: 0 };
        return {
          "ФИО": s.full_name,
          "Всего уроков": att.total,
          "Присутствие": att.present,
          "Отсутствие": att.absent,
          "Опоздания": att.late,
          "Посещаемость %": att.total > 0 ? Math.round((att.present / att.total) * 100) : 0,
        };
      });

      if (studentRows.length > 0) {
        const ws1 = XLSX.utils.json_to_sheet(studentRows);
        ws1["!cols"] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(wb, ws1, "Посещаемость");
      }

      // Sheet 2: ЕНТ баллы
      if (data.entByStudent.length > 0) {
        const entRows = data.entByStudent.map((e: any) => {
          const student = data.students.find((s: any) => s.id === e.student_id);
          return {
            "ФИО": student?.full_name || `ID ${e.student_id}`,
            "Предмет": e.subject_name,
            "Балл": e.score,
            "Месяц": e.month,
          };
        });
        const ws2 = XLSX.utils.json_to_sheet(entRows);
        ws2["!cols"] = [{ wch: 30 }, { wch: 25 }, { wch: 8 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, ws2, "ЕНТ баллы");
      }

      // Sheet 3: Сводная (student + attendance rate + latest ENT total)
      const latestEntByStudent = new Map<number, number>();
      // Group ENT by student, get latest month's total
      for (const e of data.entByStudent) {
        if (!latestEntByStudent.has(e.student_id)) latestEntByStudent.set(e.student_id, 0);
        // We take the latest entry per student (they're ordered by month DESC)
        latestEntByStudent.set(e.student_id, (latestEntByStudent.get(e.student_id) || 0) + e.score);
      }

      const summaryRows = data.students.map((s: any) => {
        const att = attMap.get(s.id) || { present: 0, absent: 0, total: 0 };
        return {
          "ФИО": s.full_name,
          "Посещаемость %": att.total > 0 ? Math.round((att.present / att.total) * 100) : 0,
          "Отсутствий": att.absent,
          "Последний ЕНТ (сумма)": latestEntByStudent.get(s.id) ?? "—",
        };
      });

      if (summaryRows.length > 0) {
        const ws3 = XLSX.utils.json_to_sheet(summaryRows);
        ws3["!cols"] = [{ wch: 30 }, { wch: 18 }, { wch: 14 }, { wch: 22 }];
        XLSX.utils.book_append_sheet(wb, ws3, "Сводная");
      }

      const groupName = data.group?.name || perfGroupId;
      addExcelWatermarkSheet(XLSX, wb);
      XLSX.writeFile(wb, `Успеваемость_${groupName}_${perfMonths}мес.xlsx`);
      toast.success("Отчёт по группе скачан");
    } catch (e: any) {
      toast.error("Ошибка: " + (e.message || "не удалось загрузить"));
    } finally {
      setPerfLoading(false);
    }
  };

  const monthLabel = (m: string) => {
    const [y, mo] = m.split("-");
    const names = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
    return `${names[parseInt(mo) - 1]} ${y}`;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Report */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-blue-500" />
              Посещаемость за месяц
            </CardTitle>
            <CardDescription>
              Детальный отчёт: каждый ученик, каждый день. Сводка и pivot-таблица.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Месяц</label>
              <Input
                type="month"
                value={attMonth}
                onChange={e => setAttMonth(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Группа</label>
              <Select value={attGroupId} onValueChange={setAttGroupId}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все группы</SelectItem>
                  {groups.map(g => (
                    <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-1 pt-1">
              <Badge variant="outline" className="text-[10px]">3 листа Excel</Badge>
              <Badge variant="outline" className="text-[10px]">Детализация</Badge>
              <Badge variant="outline" className="text-[10px]">Сводка</Badge>
              <Badge variant="outline" className="text-[10px]">Ученик × Дата</Badge>
            </div>
          </CardContent>
          <div className="p-4 pt-0">
            <Button onClick={exportAttendance} disabled={attLoading} className="w-full">
              {attLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              Скачать .xlsx
            </Button>
          </div>
        </Card>

        {/* ENT Report */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-500" />
              ЕНТ-динамика
            </CardTitle>
            <CardDescription>
              Результаты ЕНТ за период: по ученикам, средние по группам, pivot.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Группа</label>
              <Select value={entGroupId} onValueChange={setEntGroupId}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все группы</SelectItem>
                  {groups.map(g => (
                    <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">От</label>
                <Input type="month" value={entFromMonth} onChange={e => setEntFromMonth(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">До</label>
                <Input type="month" value={entToMonth} onChange={e => setEntToMonth(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div className="flex flex-wrap gap-1 pt-1">
              <Badge variant="outline" className="text-[10px]">3 листа Excel</Badge>
              <Badge variant="outline" className="text-[10px]">Результаты</Badge>
              <Badge variant="outline" className="text-[10px]">Средние</Badge>
              <Badge variant="outline" className="text-[10px]">Ученик × Месяц</Badge>
            </div>
          </CardContent>
          <div className="p-4 pt-0">
            <Button onClick={exportEnt} disabled={entLoading} className="w-full">
              {entLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              Скачать .xlsx
            </Button>
          </div>
        </Card>

        {/* Group Performance Report */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-green-500" />
              Успеваемость группы
            </CardTitle>
            <CardDescription>
              Комбинированный отчёт: посещаемость + ЕНТ баллы каждого ученика.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Группа</label>
              <Select value={perfGroupId} onValueChange={setPerfGroupId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Выберите группу" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map(g => (
                    <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Период</label>
              <Select value={perfMonths} onValueChange={setPerfMonths}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 месяц</SelectItem>
                  <SelectItem value="3">3 месяца</SelectItem>
                  <SelectItem value="6">6 месяцев</SelectItem>
                  <SelectItem value="12">12 месяцев</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-1 pt-1">
              <Badge variant="outline" className="text-[10px]">3 листа Excel</Badge>
              <Badge variant="outline" className="text-[10px]">Посещаемость</Badge>
              <Badge variant="outline" className="text-[10px]">ЕНТ баллы</Badge>
              <Badge variant="outline" className="text-[10px]">Сводная</Badge>
            </div>
          </CardContent>
          <div className="p-4 pt-0">
            <Button onClick={exportGroupPerformance} disabled={perfLoading || !perfGroupId} className="w-full">
              {perfLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              Скачать .xlsx
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
