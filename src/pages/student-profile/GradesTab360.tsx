import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BookOpen, CheckCircle2, XCircle, Clock, Calendar, Star, TrendingUp, AlertTriangle,
  Upload, Download, Trash2, FileText, Award,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line,
} from "recharts";

type Props = { data: any };

const CERT_SLOTS = [
  { type: "1000-01", label: "Январьский ЕНТ",  short: "Янв. ЕНТ" },
  { type: "1000-03", label: "Мартовский ЕНТ",   short: "Мар. ЕНТ" },
  { type: "1001-01", label: "Грантовский ЕНТ 1", short: "Грант 1" },
  { type: "1001-02", label: "Грантовский ЕНТ 2", short: "Грант 2" },
];

function EntCertificates({ studentId, initialCerts }: { studentId: number; initialCerts: any[] }) {
  const [certs, setCerts] = useState<Record<string, any>>(() => {
    const m: Record<string, any> = {};
    for (const c of initialCerts) m[c.exam_type] = c;
    return m;
  });
  const [uploading, setUploading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleUpload = async (examType: string, file: File) => {
    setUploading(examType);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`/api/students/${studentId}/ent-certificates/${examType}`, { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        setCerts(prev => ({ ...prev, [examType]: { ...data, exam_type: examType, original_name: file.name } }));
      }
    } catch {}
    setUploading(null);
  };

  const handleDelete = async (examType: string, certId: number) => {
    setDeleting(examType);
    try {
      const res = await fetch(`/api/ent-certificates/${certId}`, { method: "DELETE" });
      if (res.ok) setCerts(prev => { const n = { ...prev }; delete n[examType]; return n; });
    } catch {}
    setDeleting(null);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Award className="h-4 w-4 text-amber-500" />
          Сертификаты ЕНТ
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {CERT_SLOTS.map(slot => {
            const cert = certs[slot.type];
            const isUploading = uploading === slot.type;
            const isDeleting = deleting === slot.type;
            return (
              <div key={slot.type} className={cn(
                "border rounded-xl p-3 flex flex-col gap-2 min-h-[100px] transition-colors",
                cert ? "border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/10 dark:border-emerald-800" : "border-dashed border-muted-foreground/30 hover:border-muted-foreground/60"
              )}>
                <div className="text-[11px] font-semibold text-muted-foreground">{slot.label}</div>
                {cert ? (
                  <>
                    <div className="flex items-center gap-1.5 flex-1">
                      <FileText className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="text-xs truncate text-foreground" title={cert.original_name}>{cert.original_name}</span>
                    </div>
                    <div className="flex gap-1">
                      <a href={cert.file_path} target="_blank" rel="noopener noreferrer" className="flex-1">
                        <Button variant="outline" size="sm" className="w-full h-7 text-[11px]">
                          <Download className="h-3 w-3 mr-1" />Скачать
                        </Button>
                      </a>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                        disabled={isDeleting} onClick={() => handleDelete(slot.type, cert.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-2">
                    <Upload className="h-5 w-5 text-muted-foreground/50" />
                    <Button variant="outline" size="sm" className="h-7 text-[11px]"
                      disabled={isUploading}
                      onClick={() => fileRefs.current[slot.type]?.click()}>
                      {isUploading ? "Загрузка..." : "Загрузить"}
                    </Button>
                    <input ref={el => { fileRefs.current[slot.type] = el; }} type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(slot.type, f); e.target.value = ""; }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

const hwStatusBadge = (status: string) => {
  if (status === "submitted") return <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">Сдано ✓</Badge>;
  if (status === "overdue")   return <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">Просрочено</Badge>;
  if (status === "missed")    return <Badge variant="destructive" className="text-[10px]">Не сдано</Badge>;
  return null;
};

const attendanceBadge = (status: string) => {
  if (status === "present") return <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">Присутствовал</Badge>;
  return <Badge variant="destructive" className="text-[10px]">Отсутствовал</Badge>;
};

export default function GradesTab360({ data }: Props) {
  const { ent, attendance, teacherFeedback, entCertificates, id: studentId } = data;
  const entResults = ent.byMonth || [];

  const [selectedMonth, setSelectedMonth] = useState(
    entResults.length > 0 ? entResults[entResults.length - 1].month : null
  );

  const currentMonthData = entResults.find((r: any) => r.month === selectedMonth);

  // ENT by subject across all months for line chart
  const allSubjects: string[] = entResults.length > 0 ? entResults[0].subjects.map((s: any) => s.name) : [];
  const lineData = entResults.map((r: any) => {
    const row: Record<string, any> = { month: r.month.slice(0, 7) };
    r.subjects.forEach((s: any) => { row[s.name] = s.score; });
    return row;
  });

  const SUBJECT_COLORS: Record<string, string> = {
    "Математическая грамотность": "#6366f1",
    "Читательская грамотность":   "#0ea5e9",
    "История Казахстана":         "#f59e0b",
    "Физика":                     "#10b981",
    "Математика":                 "#ef4444",
  };

  return (
    <div className="space-y-6">
      {/* ── ENT CERTIFICATES ─────────────────────────────────────────────── */}
      <EntCertificates studentId={studentId} initialCerts={entCertificates || []} />

      {/* ── ENT RESULTS SECTION ─────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Star className="h-4 w-4 text-violet-500" />
              Результаты ЕНТ
            </CardTitle>
            {/* Month pills */}
            <div className="flex flex-wrap gap-1">
              {entResults.map((r: any) => (
                <button
                  key={r.month}
                  onClick={() => setSelectedMonth(r.month)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors",
                    selectedMonth === r.month
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {r.month}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {currentMonthData && (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="text-4xl font-black text-violet-700">{currentMonthData.total}</div>
                <div>
                  <div className="text-sm font-medium">{currentMonthData.month}</div>
                  <div className="text-xs text-muted-foreground">
                    Балл ЕНТ
                  </div>
                </div>
                {/* Delta vs previous */}
                {entResults.indexOf(currentMonthData) > 0 && (() => {
                  const prev = entResults[entResults.indexOf(currentMonthData) - 1];
                  const delta = currentMonthData.total - prev.total;
                  return (
                    <Badge variant="outline" className={cn(
                      "ml-auto",
                      delta > 0 ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                      delta < 0 ? "bg-red-100 text-red-700 border-red-200" :
                      "bg-muted text-muted-foreground"
                    )}>
                      {delta > 0 ? "+" : ""}{delta} vs {prev.month}
                    </Badge>
                  );
                })()}
              </div>

              <div className="space-y-2.5 mb-6">
                {currentMonthData.subjects.map((s: any) => {
                  const maxVal = 40; // Default approximation since max is not stored in ent_results
                  const pct = Math.min(100, Math.round((s.score / maxVal) * 100));
                  
                  // Extract group average from groupBenchmark
                  const groupAvgItem = ent.groupBenchmark?.find((g: any) => g.subject === s.name);
                  const groupAvgScore = groupAvgItem ? groupAvgItem.group_avg : s.score;
                  const avgPct = Math.min(100, Math.round((groupAvgScore / maxVal) * 100));
                  
                  const color = SUBJECT_COLORS[s.name] || "#6366f1";
                  return (
                    <div key={s.name}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium">{s.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground text-[10px]">Группа: {groupAvgScore}</span>
                          <span className="font-bold" style={{ color }}>{s.score}</span>
                          <span className={cn("text-[11px]", pct >= avgPct ? "text-emerald-600" : "text-red-600")}>
                            {pct >= avgPct ? "↑" : "↓"}
                          </span>
                        </div>
                      </div>
                      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="absolute top-0 h-full w-0.5 bg-slate-400/60 z-10"
                          style={{ left: `${avgPct}%` }}
                        />
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Subject Trends Line Chart */}
              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-semibold">Динамика по предметам</span>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={lineData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    {allSubjects.map((subj: string) => (
                      <Line
                        key={subj}
                        type="monotone"
                        dataKey={subj}
                        stroke={SUBJECT_COLORS[subj] || "#6366f1"}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
          {entResults.length === 0 && (
            <div className="text-center py-6 text-sm text-muted-foreground">
              Нет данных по ЕНТ
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── HOMEWORK SECTION (MOCKED until DB tracks HW items properly) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* HW by subject */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-blue-500" />
              ДЗ по предметам
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(attendance.bySubject || []).map((s: any) => (
              <div key={s.subject}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium">{s.subject}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{s.hw_done}/{s.total}</span>
                    <span className={cn("font-semibold", Math.round((s.hw_done/s.total)*100) >= 85 ? "text-emerald-600" : Math.round((s.hw_done/s.total)*100) >= 70 ? "text-amber-600" : "text-red-600")}>
                      {s.total > 0 ? Math.round((s.hw_done/s.total)*100) : 0}%
                    </span>
                  </div>
                </div>
                <Progress
                  value={s.total > 0 ? Math.round((s.hw_done/s.total)*100) : 0}
                  className={cn("h-1.5", (s.total > 0 ? Math.round((s.hw_done/s.total)*100) : 0) < 70 && "[&>div]:bg-red-500")}
                />
              </div>
            ))}
            <div className="pt-2 border-t text-xs flex justify-between">
              <span className="text-muted-foreground">Итого выполнено: {attendance.stats?.hw_done_count || 0}</span>
              <span className="font-bold text-blue-600">{attendance.stats?.homework_rate}%</span>
            </div>
          </CardContent>
        </Card>

        {/* Recent HW list - replaced with recent attendance with HW status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-500" />
              Последние оценки за ДЗ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(attendance.records || []).slice(0, 6).map((hw: any, i: number) => (
              <div key={i} className="flex items-start justify-between gap-2 py-2 border-b last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{hw.subject}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{hw.date}</span>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">{hw.teacher}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {hwStatusBadge(hw.homework === "done" ? "submitted" : "missed")}
                </div>
              </div>
            ))}
            {(attendance.records || []).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Нет записей</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── ATTENDANCE SECTION ──────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-emerald-500" />
              Посещаемость
            </CardTitle>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                {attendance.stats?.present_count || 0} присут.
              </span>
              <span className="flex items-center gap-1">
                <XCircle className="h-3.5 w-3.5 text-red-500" />
                {attendance.stats?.absent_count || 0} пропусков
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                {attendance.stats?.late_count || 0} опозданий
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left p-2 text-muted-foreground font-medium">Дата</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Предмет</th>
                  <th className="text-left p-2 text-muted-foreground font-medium hidden md:table-cell">Учитель</th>
                  <th className="text-center p-2 text-muted-foreground font-medium">Статус</th>
                  <th className="text-center p-2 text-muted-foreground font-medium">ДЗ</th>
                  <th className="text-left p-2 text-muted-foreground font-medium hidden sm:table-cell">Комментарий</th>
                </tr>
              </thead>
              <tbody>
                {(attendance.records || []).map((r: any, i: number) => (
                  <tr key={i} className={cn("border-b", r.status === "absent" && "bg-red-50/30 dark:bg-red-950/10")}>
                    <td className="p-2 font-medium">{r.date?.slice(5) || "—"}</td>
                    <td className="p-2">{r.subject || "—"}</td>
                    <td className="p-2 text-muted-foreground hidden md:table-cell">{r.teacher || "—"}</td>
                    <td className="p-2 text-center">
                      {attendanceBadge(r.status)}
                      {r.late && <Badge variant="outline" className="text-[10px] ml-1 text-amber-600">Опоздал</Badge>}
                    </td>
                    <td className="p-2 text-center">
                      {r.homework === "done" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mx-auto" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-red-400 mx-auto" />
                      )}
                    </td>
                    <td className="p-2 text-muted-foreground hidden sm:table-cell max-w-[200px] truncate">
                      {r.comment || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Absence reasons - hidden for now since the real DB doesn't have reasons */}
        </CardContent>
      </Card>

      {/* ── TEACHERS FEEDBACK SECTION ───────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-400" />
            Отзывы учителей
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(teacherFeedback || []).map((t: any, i: number) => (
              <div key={i} className="border rounded-xl p-3 space-y-2 relative">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{t.teacher_name}</p>
                    <p className="text-xs text-muted-foreground">{t.subject_name || "Общий отзыв"}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{t.month}</Badge>
                </div>
                <blockquote className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-2">
                  "{t.comment}"
                </blockquote>
                <p className="text-[10px] text-muted-foreground">{t.created_at?.slice(0, 10)}</p>
              </div>
            ))}
            {(teacherFeedback || []).length === 0 && (
               <p className="text-sm text-muted-foreground col-span-full text-center py-4">Нет отзывов</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
