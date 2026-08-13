import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import {
  CheckCircle2, BarChart3, ClipboardList, MessageSquare, GraduationCap, ImagePlus, Trash2
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/UserAvatar";
import { uploadStudentAvatar, deleteStudentAvatar } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPhone } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  fetchStudentDetails,
  fetchStudentMonthlyStats,
  fetchTeacherFeedbackByStudent,
  fetchLessonCommentsByStudent,
} from "@/lib/api";

const CHART_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#8b5cf6"];

function transformEntHistory(history: { month: string; score: number; subject_name: string }[]) {
  const months = [...new Set(history.map((h) => h.month))].sort();
  const subjects = [...new Set(history.map((h) => h.subject_name))];
  return months.map((month) => {
    const point: Record<string, string | number> = { month };
    subjects.forEach((subject) => {
      const entry = history.find((h) => h.month === month && h.subject_name === subject);
      if (entry) point[subject] = entry.score;
    });
    return point;
  });
}

function getMonthRange(offset = 0): { from: string; to: string; label: string } {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  const y = d.getFullYear();
  const m = d.getMonth();
  const from = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const last = new Date(y, m + 1, 0).getDate();
  const to = `${y}-${String(m + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  const locale = { ru: "ru-RU", kk: "kk-KZ", en: "en-US" }[i18n.language] ?? "ru-RU";
  const label = d.toLocaleDateString(locale, { month: "long", year: "numeric" });
  return { from, to, label };
}

export function StudentDetailDialog({ student, onClose }: { student: any; onClose: () => void }) {
  const { i18n } = useTranslation();
  const locale = { ru: "ru-RU", kk: "kk-KZ", en: "en-US" }[i18n.language] ?? "ru-RU";
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  // Attendance comments state
  const [commentFilter, setCommentFilter] = useState<'all' | 'month'>('all');
  const [lessonComments, setLessonComments] = useState<any[]>([]);
  const [commentsMonth, setCommentsMonth] = useState(() => new Date().toISOString().slice(0, 7));

  useEffect(() => {
    if (!student?.id) return;
    if (commentFilter === 'all') {
      fetchLessonCommentsByStudent({ studentId: student.id, limit: 200 }).then(setLessonComments);
    } else {
      const [y, m] = commentsMonth.split('-');
      const from = `${commentsMonth}-01`;
      const lastDay = new Date(Number(y), Number(m), 0).getDate();
      const to = `${commentsMonth}-${String(lastDay).padStart(2, '0')}`;
      fetchLessonCommentsByStudent({ studentId: student.id, from, to, limit: 200 }).then(setLessonComments);
    }
  }, [student?.id, commentFilter, commentsMonth]);

  // Date range for stats tab
  const [rangeMode, setRangeMode] = useState<string>("current"); // current, prev, custom
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [monthlyStats, setMonthlyStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Teacher feedback for this student
  const [teacherFeedbacks, setTeacherFeedbacks] = useState<any[]>([]);
  const [tfMonth, setTfMonth] = useState(() => new Date().toISOString().slice(0, 7));

  useEffect(() => {
    setLoading(true);
    fetchStudentDetails(student.id).then((d) => { setDetails(d); setLoading(false); });
  }, [student.id]);

  // Load teacher feedbacks for this student
  useEffect(() => {
    fetchTeacherFeedbackByStudent(student.id, tfMonth).then(setTeacherFeedbacks);
  }, [student.id, tfMonth]);

  // Compute date range based on mode
  const dateRange = useMemo(() => {
    if (rangeMode === "current") return getMonthRange(0);
    if (rangeMode === "prev") return getMonthRange(-1);
    if (rangeMode === "custom" && customFrom && customTo) return { from: customFrom, to: customTo, label: `${customFrom} — ${customTo}` };
    return getMonthRange(0);
  }, [rangeMode, customFrom, customTo]);

  // Load monthly stats when range changes
  useEffect(() => {
    if (!dateRange.from || !dateRange.to) return;
    setStatsLoading(true);
    fetchStudentMonthlyStats(student.id, dateRange.from, dateRange.to)
      .then(setMonthlyStats)
      .finally(() => setStatsLoading(false));
  }, [student.id, dateRange.from, dateRange.to]);

  const chartData = useMemo(
    () => (details?.ent_history ? transformEntHistory(details.ent_history) : []),
    [details]
  );
  const subjects = useMemo(
    () => (details?.ent_history ? [...new Set<string>(details.ent_history.map((h: any) => h.subject_name as string))] : []),
    [details]
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <UserAvatar user={student} size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-base">{student.full_name}</span>
                <Badge variant="outline" className="text-xs">{student.group_name}</Badge>
                {student.last_ent_score != null && (
                  <Badge variant="secondary" className="text-xs">ЕНТ: {student.last_ent_score}</Badge>
                )}
              </div>
              <div className="flex gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                {student.parent_name && <span>{student.parent_name}</span>}
                {student.parent_phone && <span>{formatPhone(student.parent_phone)}</span>}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3 mt-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <Tabs defaultValue="stats" className="mt-2">
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="stats" className="gap-1">
                <ClipboardList className="h-3.5 w-3.5" /><span className="hidden sm:inline">Журнал</span>
              </TabsTrigger>
              <TabsTrigger value="ent" className="gap-1">
                <BarChart3 className="h-3.5 w-3.5" />ЕНТ
              </TabsTrigger>
              <TabsTrigger value="absences" className="gap-1">
                <span>Прогулы</span>
                {details?.absences?.length > 0 && (
                  <Badge className="ml-1 h-4 text-xs" variant="destructive">{details.absences.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="attendance-comments" className="gap-1">
                <MessageSquare className="h-3.5 w-3.5" /><span className="hidden sm:inline">Комментарии</span>
              </TabsTrigger>
              <TabsTrigger value="notes" className="gap-1">
                <span>Заметки</span>
              </TabsTrigger>
              <TabsTrigger value="teacher-feedback" className="gap-1">
                <GraduationCap className="h-3.5 w-3.5" /><span className="hidden sm:inline">ОТ устазов</span>
              </TabsTrigger>
            </TabsList>
          {/* ====== ATTENDANCE COMMENTS TAB ====== */}
          <TabsContent value="attendance-comments" className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Select value={commentFilter} onValueChange={v => setCommentFilter(v as 'all' | 'month')}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Фильтр" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="month">За месяц</SelectItem>
                </SelectContent>
              </Select>
              {commentFilter === 'month' && (
                <Input type="month" value={commentsMonth} onChange={e => setCommentsMonth(e.target.value)} className="w-36 h-8" />
              )}
            </div>
            {lessonComments.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">Нет комментариев</p>
              </div>
            ) : (
              <div className="space-y-2">
                {lessonComments.map((c: any, i: number) => (
                  <Card key={i}>
                    <CardContent className="pt-3 pb-3">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-muted-foreground">{c.date}</span>
                        {c.teacher_name && <Badge variant="outline" className="text-[10px]">{c.teacher_name}</Badge>}
                        {c.subject_name && <Badge variant="secondary" className="text-[10px]">{c.subject_name}</Badge>}
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{c.comment}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

            {/* ====== STATS / JOURNAL TAB ====== */}
            <TabsContent value="stats" className="pt-4">
              <div className="flex flex-wrap items-end gap-3 mb-5">
                <div className="flex gap-1.5">
                  <Button variant={rangeMode === "current" ? "default" : "outline"} size="sm" onClick={() => setRangeMode("current")}>
                    Текущий месяц
                  </Button>
                  <Button variant={rangeMode === "prev" ? "default" : "outline"} size="sm" onClick={() => setRangeMode("prev")}>
                    Прошлый месяц
                  </Button>
                  <Button variant={rangeMode === "custom" ? "default" : "outline"} size="sm" onClick={() => setRangeMode("custom")}>
                    Свои даты
                  </Button>
                </div>
                {rangeMode === "custom" && (
                  <div className="flex items-center gap-2">
                    <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-36 h-8 text-xs" />
                    <span className="text-muted-foreground text-xs">—</span>
                    <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-36 h-8 text-xs" />
                  </div>
                )}
                {rangeMode !== "custom" && (
                  <span className="text-xs text-muted-foreground capitalize">{dateRange.label}</span>
                )}
              </div>

              {statsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-40 w-full" />
                </div>
              ) : !monthlyStats?.overall || monthlyStats.overall.total_lessons === 0 ? (
                <div className="flex flex-col items-center py-10 text-muted-foreground">
                  <ClipboardList className="h-10 w-10 mb-2 opacity-30" />
                  <p className="text-sm">Нет данных за выбранный период</p>
                </div>
              ) : (
                <>
                  {/* Overall summary */}
                  <Card className="mb-4">
                    <CardContent className="pt-4 pb-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Посещаемость</p>
                          <p className="text-xl font-bold">
                            {monthlyStats.overall.total_lessons > 0
                              ? Math.round(monthlyStats.overall.present_count / monthlyStats.overall.total_lessons * 100)
                              : 0}%
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {monthlyStats.overall.present_count}/{monthlyStats.overall.total_lessons} уроков
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Пропуски</p>
                          <p className="text-xl font-bold text-red-600">{monthlyStats.overall.absent_count}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Опоздания</p>
                          <p className="text-xl font-bold text-orange-600">{monthlyStats.overall.late_count}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Д/З выполнено</p>
                          <p className="text-xl font-bold">
                            {monthlyStats.overall.total_lessons > 0
                              ? Math.round(monthlyStats.overall.homework_done / monthlyStats.overall.total_lessons * 100)
                              : 0}%
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Per-subject breakdown */}
                  <div className="space-y-2">
                    {monthlyStats.subjects.map((s: any) => {
                      const attPct = s.total_lessons > 0 ? Math.round(s.present_count / s.total_lessons * 100) : 0;
                      const hwPct = s.total_lessons > 0 ? Math.round(s.homework_done / s.total_lessons * 100) : 0;
                      return (
                        <Card key={s.subject_name}>
                          <CardContent className="pt-3 pb-3">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-medium">{s.subject_name}</p>
                              <Badge variant="outline" className="text-xs">{s.present_count}/{s.total_lessons}</Badge>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                              <div>
                                <p className="text-muted-foreground mb-1">Посещ.</p>
                                <Progress value={attPct} className="h-1.5" />
                                <p className="mt-0.5 font-medium">{attPct}%</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground mb-1">Д/З</p>
                                <Progress value={hwPct} className="h-1.5" />
                                <p className="mt-0.5 font-medium">{hwPct}%</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Опоздания</p>
                                <p className="font-medium text-orange-600">{s.late_count}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Пропуски</p>
                                <p className="font-medium text-red-600">{s.absent_count}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="ent" className="pt-4">
              {chartData.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-muted-foreground">
                  <BarChart3 className="h-10 w-10 mb-2 opacity-30" />
                  <p className="text-sm">Нет данных ЕНТ для этого ученика</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 140]} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    {subjects.map((subject, i) => (
                      <Line
                        key={subject}
                        type="monotone"
                        dataKey={subject}
                        stroke={CHART_COLORS[i % CHART_COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </TabsContent>

            <TabsContent value="absences" className="pt-4">
              {details?.absences?.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-muted-foreground">
                  <CheckCircle2 className="h-10 w-10 mb-2 text-green-500 opacity-60" />
                  <p className="text-sm">Прогулов не зафиксировано</p>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Дата</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead>Причина / Комментарий</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {details?.absences?.map((a: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm font-mono">{a.date}</TableCell>
                          <TableCell>
                            <Badge variant="destructive" className="text-xs">Отсутствовал</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{a.comment || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="notes" className="pt-4">
              {/* Avatar section tucked here to avoid crowding dialog header */}
              <div className="flex items-center gap-3 mb-4 pb-4 border-b">
                <UserAvatar user={student} size="lg" />
                <div className="flex flex-col gap-1">
                  <label htmlFor="curator-avatar-upload" className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-primary transition-colors">
                    <ImagePlus className="h-3.5 w-3.5" /> Загрузить фото
                    <input id="curator-avatar-upload" type="file" accept="image/*" className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try { await uploadStudentAvatar(student.id, file); window.location.reload(); }
                        catch { alert("Ошибка загрузки фото"); }
                      }}
                    />
                  </label>
                  {student.avatar_url && (
                    <button className="flex items-center gap-1 text-xs text-destructive hover:underline"
                      onClick={async () => {
                        try { await deleteStudentAvatar(student.id); window.location.reload(); }
                        catch { alert("Ошибка удаления фото"); }
                      }}
                    >
                      <Trash2 className="h-3 w-3" /> Удалить фото
                    </button>
                  )}
                </div>
              </div>
              {details?.notes?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">Заметок по группе нет</p>
              ) : (
                <div className="space-y-3">
                  {details?.notes?.map((n: any, i: number) => (
                    <div key={i} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <span className="text-sm font-medium">{n.title}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{n.date}</span>
                      </div>
                      {n.description && <p className="text-sm text-muted-foreground">{n.description}</p>}
                      <p className="text-xs text-muted-foreground mt-1.5">{n.author}</p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="teacher-feedback" className="pt-4">
              <div className="flex items-center gap-3 mb-4">
                <Label className="text-sm">Месяц:</Label>
                <Input
                  type="month"
                  value={tfMonth}
                  onChange={(e) => setTfMonth(e.target.value)}
                  className="w-44 h-8"
                />
              </div>
              {teacherFeedbacks.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-muted-foreground">
                  <GraduationCap className="h-10 w-10 mb-2 opacity-30" />
                  <p className="text-sm">Нет отзывов учителей за этот месяц</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {teacherFeedbacks.map((fb: any) => (
                    <Card key={fb.id}>
                      <CardContent className="pt-3 pb-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <GraduationCap className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">{fb.teacher_name}</span>
                          </div>
                          {fb.subject_name && (
                            <Badge variant="outline" className="text-xs">{fb.subject_name}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{fb.comment}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
