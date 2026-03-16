import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Shield, Users, TrendingUp, AlertTriangle, Phone, Calendar,
  ExternalLink, Plus, Trash2, CheckCircle2, RotateCcw, BookOpen, BarChart3, ChevronRight,
  ClipboardList, Clock, PhoneCall, CircleCheck, Circle, MessageSquare, Edit, GraduationCap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/UserAvatar";
import { ImagePlus } from "lucide-react";
import { uploadStudentAvatar, deleteStudentAvatar } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPhone } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchGroups,
  fetchCuratorGroups,
  fetchCuratorStudents,
  fetchCuratorMetrics,
  fetchStudentDetails,
  fetchStudentMonthlyStats,
  fetchAttendanceGrid,
  fetchParentFeedback,
  createParentFeedback,
  updateParentFeedback,
  deleteParentFeedback,
  generateCallTasks,
  fetchCallTasks,
  updateCallTask,
  fetchCallTasksSummary,
  generateTeacherFeedback,
  fetchTeacherFeedback,
  updateTeacherFeedback,
  fetchTeacherFeedbackByStudent,
  fetchTeacherFeedbackSummary,
  fetchLessonCommentsByStudent,
} from "@/lib/api";

const CHART_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#8b5cf6"];

function getWhatsAppLink(phone: string | null | undefined, studentName: string, groupName: string): string | null {
  if (!phone) return null;
  const clean = phone.replace(/\D/g, "");
  const withCountry = clean.startsWith("7") ? clean : "7" + clean;
  const msg = encodeURIComponent(
    `Здравствуйте! Я куратор группы ${groupName} в образовательном центре TODAY. Хотел(а) обсудить успеваемость вашего ребёнка ${studentName}.`
  );
  return `https://wa.me/${withCountry}?text=${msg}`;
}

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

// ====================== METRIC CARD ======================

function MetricCard({
  icon: Icon, label, value, sub, iconClass,
}: { icon: React.ElementType; label: string; value: string | number | null; sub?: string; iconClass?: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconClass || "bg-primary/10"}`}>
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className="text-2xl font-bold mt-0.5">{value ?? "—"}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ====================== STUDENT DETAIL DIALOG ======================

function getMonthRange(offset = 0): { from: string; to: string; label: string } {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  const y = d.getFullYear();
  const m = d.getMonth();
  const from = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const last = new Date(y, m + 1, 0).getDate();
  const to = `${y}-${String(m + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  const label = d.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  return { from, to, label };
}

function StudentDetailDialog({ student, onClose }: { student: any; onClose: () => void }) {
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
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-4 flex-wrap">
            <UserAvatar user={student} size="lg" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg">{student.full_name}</span>
                <Badge variant="outline" className="text-xs">{student.group_name}</Badge>
              </div>
              <div className="flex gap-4 text-sm text-muted-foreground pt-1 flex-wrap">
                {student.last_ent_score != null && (
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-3.5 w-3.5" />
                    Общий балл ЕНТ: <strong className="text-foreground ml-0.5">{student.last_ent_score}</strong>
                  </span>
                )}
                {student.parent_name && (
                  <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{student.parent_name}</span>
                )}
                {student.parent_phone && (
                  <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{formatPhone(student.parent_phone)}</span>
                )}
              </div>
              {/* upload/delete avatar */}
              <div className="mt-2">
                <label htmlFor="student-avatar-upload-curator" className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-primary">
                  <ImagePlus className="h-4 w-4" /> Загрузить фото
                  <input
                    id="student-avatar-upload-curator"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        await uploadStudentAvatar(student.id, file);
                        window.location.reload();
                      } catch (err) { alert("Ошибка загрузки фото"); }
                    }}
                  />
                </label>
                {student.avatar_url && (
                  <button
                    className="flex items-center gap-1 text-xs text-destructive hover:underline mt-1"
                    onClick={async () => {
                      try {
                        await deleteStudentAvatar(student.id);
                        window.location.reload();
                      } catch (err) { alert("Ошибка удаления фото"); }
                    }}
                  >
                    <Trash2 className="h-3 w-3" /> Удалить фото
                  </button>
                )}
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
              <TabsTrigger value="stats">
                <ClipboardList className="h-3.5 w-3.5 mr-1" />Журнал
              </TabsTrigger>
              <TabsTrigger value="ent">
                <BarChart3 className="h-3.5 w-3.5 mr-1" />ЕНТ
              </TabsTrigger>
              <TabsTrigger value="absences">
                Прогулы
                {details?.absences?.length > 0 && (
                  <Badge className="ml-1.5 h-4 text-xs" variant="destructive">{details.absences.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="attendance-comments">
                <MessageSquare className="h-3.5 w-3.5 mr-1" />Комментарии
              </TabsTrigger>
              <TabsTrigger value="notes">Комментарии</TabsTrigger>
              <TabsTrigger value="teacher-feedback">
                <GraduationCap className="h-3.5 w-3.5 mr-1" />Отзывы учителей
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
                <div className="rounded-md border overflow-hidden">
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

// ====================== ADD FEEDBACK FORM ======================

function AddFeedbackForm({ students, curatorId, onAdded }: { students: any[]; curatorId: number; onAdded: () => void }) {
  const [studentId, setStudentId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("needs_callback");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!studentId || !date) return;
    setSaving(true);
    await createParentFeedback({ student_id: parseInt(studentId), curator_id: curatorId, date, notes, status });
    setStudentId("");
    setNotes("");
    setDate(new Date().toISOString().slice(0, 10));
    setStatus("needs_callback");
    setSaving(false);
    onAdded();
  };

  return (
    <Card className="mb-5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Plus className="h-4 w-4" />Добавить запись звонка
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Ученик *</Label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger><SelectValue placeholder="Выбрать ученика" /></SelectTrigger>
              <SelectContent>
                {students.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.full_name} ({s.group_name})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Дата звонка *</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">О чём договорились</Label>
            <Textarea placeholder="Краткое описание итогов звонка с родителем..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Статус</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="needs_callback">Нужно перезвонить</SelectItem>
                <SelectItem value="resolved">Проблема решена</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={handleSubmit} disabled={!studentId || !date || saving} className="w-full">
              {saving ? "Сохранение..." : "Добавить"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ====================== MAIN PAGE ======================

export default function CuratorshipPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [parentFeedback, setParentFeedback] = useState<any[]>([]);
  const [allGroups, setAllGroups] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Attendance grid state
  const [gridGroupId, setGridGroupId] = useState<string>("");
  const [gridRangeMode, setGridRangeMode] = useState<string>("current");
  const [gridCustomFrom, setGridCustomFrom] = useState("");
  const [gridCustomTo, setGridCustomTo] = useState("");
  const [gridData, setGridData] = useState<any>(null);
  const [gridLoading, setGridLoading] = useState(false);

  // Call tasks state
  const [callTasksData, setCallTasksData] = useState<any>(null);
  const [callTasksLoading, setCallTasksLoading] = useState(false);
  const [callNoteId, setCallNoteId] = useState<number | null>(null);
  const [callNoteText, setCallNoteText] = useState("");
  const [callDialogTask, setCallDialogTask] = useState<any>(null);
  const [callDialogResult, setCallDialogResult] = useState("");
  const [callDialogNotes, setCallDialogNotes] = useState("");

  // Admin call summary state
  const [adminCallSummary, setAdminCallSummary] = useState<any>(null);
  const [adminCallMonth, setAdminCallMonth] = useState(() => new Date().toISOString().slice(0, 7));

  // Teacher feedback state (for non-curator teachers)
  const [teacherFbData, setTeacherFbData] = useState<any>(null);
  const [teacherFbLoading, setTeacherFbLoading] = useState(false);
  const [editingFbId, setEditingFbId] = useState<number | null>(null);
  const [editingFbText, setEditingFbText] = useState("");

  // Admin teacher feedback summary
  const [adminTeacherFbSummary, setAdminTeacherFbSummary] = useState<any>(null);

  const curatorId = user ? parseInt(user.id) : 0;
  const isAdmin = user?.role === "admin" || user?.role === "umo_head";
  const isTeacher = user?.role === "teacher";

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    if (isAdmin) {
      const all = await fetchGroups();
      setAllGroups(all);
    } else {
      const [g, s, m, fb] = await Promise.all([
        fetchCuratorGroups(curatorId),
        fetchCuratorStudents(curatorId),
        fetchCuratorMetrics(curatorId),
        fetchParentFeedback({ curator_id: curatorId }),
      ]);
      setGroups(g);
      setStudents(s);
      setMetrics(m);
      setParentFeedback(fb);
    }
    setLoading(false);
  }, [user, isAdmin, curatorId]);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredStudents = useMemo(
    () => students.filter((s) =>
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (s.group_name || "").toLowerCase().includes(search.toLowerCase())
    ),
    [students, search]
  );

  const handleDeleteFeedback = async (id: number) => {
    await deleteParentFeedback(id);
    loadData();
  };

  const handleToggleStatus = async (fb: any) => {
    await updateParentFeedback(fb.id, { status: fb.status === "resolved" ? "needs_callback" : "resolved" });
    loadData();
  };

  // Auto-select first group for attendance grid
  useEffect(() => {
    if (groups.length > 0 && !gridGroupId) setGridGroupId(String(groups[0].id));
  }, [groups, gridGroupId]);

  const gridDateRange = useMemo(() => {
    if (gridRangeMode === "current") return getMonthRange(0);
    if (gridRangeMode === "prev") return getMonthRange(-1);
    if (gridRangeMode === "custom" && gridCustomFrom && gridCustomTo) return { from: gridCustomFrom, to: gridCustomTo, label: `${gridCustomFrom} — ${gridCustomTo}` };
    return getMonthRange(0);
  }, [gridRangeMode, gridCustomFrom, gridCustomTo]);

  useEffect(() => {
    if (!gridGroupId || !gridDateRange.from || !gridDateRange.to) return;
    setGridLoading(true);
    fetchAttendanceGrid(parseInt(gridGroupId), gridDateRange.from, gridDateRange.to)
      .then(setGridData)
      .finally(() => setGridLoading(false));
  }, [gridGroupId, gridDateRange.from, gridDateRange.to]);

  // Load call tasks for curator
  const loadCallTasks = useCallback(async () => {
    if (!curatorId || isAdmin) return;
    setCallTasksLoading(true);
    await generateCallTasks(curatorId);
    const data = await fetchCallTasks(curatorId);
    setCallTasksData(data);
    setCallTasksLoading(false);
  }, [curatorId, isAdmin]);

  useEffect(() => { loadCallTasks(); }, [loadCallTasks]);

  const handleCompleteCall = async (taskId: number, call_result: string, notes: string) => {
    await updateCallTask(taskId, { status: "completed", call_result, notes });
    loadCallTasks();
  };

  const handleUncompleteCall = async (taskId: number) => {
    await updateCallTask(taskId, { status: "pending" });
    loadCallTasks();
  };

  const openCallDialog = (task: any) => {
    setCallDialogTask(task);
    setCallDialogResult("");
    setCallDialogNotes(task.notes || "");
  };

  const closeCallDialog = () => {
    setCallDialogTask(null);
    setCallDialogResult("");
    setCallDialogNotes("");
  };

  // Admin: load call summary
  useEffect(() => {
    if (!isAdmin) return;
    fetchCallTasksSummary(adminCallMonth).then(setAdminCallSummary);
    fetchTeacherFeedbackSummary(adminCallMonth).then(setAdminTeacherFbSummary);
  }, [isAdmin, adminCallMonth]);

  // Teacher: load feedback tasks
  const loadTeacherFeedback = useCallback(async () => {
    if (!curatorId || isAdmin) return;
    setTeacherFbLoading(true);
    await generateTeacherFeedback(curatorId);
    const data = await fetchTeacherFeedback(curatorId);
    setTeacherFbData(data);
    setTeacherFbLoading(false);
  }, [curatorId, isAdmin]);

  useEffect(() => { loadTeacherFeedback(); }, [loadTeacherFeedback]);

  const handleSaveTeacherFb = async (taskId: number, comment: string) => {
    await updateTeacherFeedback(taskId, comment);
    setEditingFbId(null);
    setEditingFbText("");
    loadTeacherFeedback();
  };

  // ======== ADMIN / UMO VIEW ========
  if (isAdmin) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-4 md:mb-6">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Shield className="h-4 w-4 md:h-5 md:w-5 text-primary" />
          </div>
          <h1 className="text-lg md:text-2xl font-heading font-bold text-foreground">Кураторство</h1>
        </div>

        {loading ? (
          <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        ) : (
          <Tabs defaultValue="groups">
            <TabsList className="mb-5">
              <TabsTrigger value="groups">
                <Users className="h-4 w-4 mr-1.5" />Группы
              </TabsTrigger>
              <TabsTrigger value="calls">
                <PhoneCall className="h-4 w-4 mr-1.5" />Обзвон родителей
              </TabsTrigger>
              <TabsTrigger value="teacher-fb">
                <GraduationCap className="h-4 w-4 mr-1.5" />Отзывы учителей
              </TabsTrigger>
            </TabsList>

            <TabsContent value="groups">
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Группа</TableHead>
                      <TableHead>Профиль</TableHead>
                      <TableHead>Куратор</TableHead>
                      <TableHead className="text-right">Учеников</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allGroups.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-10">Нет групп</TableCell>
                      </TableRow>
                    ) : allGroups.map((g: any) => (
                      <TableRow key={g.id}>
                        <TableCell className="font-medium">{g.name}</TableCell>
                        <TableCell><Badge variant="outline">{g.profile_name || "—"}</Badge></TableCell>
                        <TableCell>
                          {g.curator_name || <span className="text-muted-foreground text-xs italic">Не назначен</span>}
                        </TableCell>
                        <TableCell className="text-right font-medium">{g.students_count ?? 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="calls">
              <div className="flex items-center gap-3 mb-5">
                <Label className="text-sm">Месяц:</Label>
                <Input
                  type="month"
                  value={adminCallMonth}
                  onChange={(e) => setAdminCallMonth(e.target.value)}
                  className="w-44 h-8"
                />
              </div>

              {!adminCallSummary ? (
                <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
              ) : adminCallSummary.summary.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-muted-foreground">
                  <PhoneCall className="h-10 w-10 mb-2 opacity-30" />
                  <p className="text-sm">Нет данных за этот месяц. Кураторы ещё не открывали эту страницу.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {adminCallSummary.summary.map((c: any) => {
                    const pct = c.total_tasks > 0 ? Math.round(c.completed_tasks / c.total_tasks * 100) : 0;
                    const isDone = pct === 100;
                    return (
                      <Card key={c.curator_id} className={isDone ? "border-green-300 bg-green-50/30 dark:border-green-800 dark:bg-green-900/10" : ""}>
                        <CardContent className="pt-4 pb-4">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="font-semibold text-sm">{c.curator_name}</p>
                              {c.group_names && (
                                <p className="text-xs text-muted-foreground">{c.group_names}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <Badge variant={isDone ? "default" : "outline"} className={isDone ? "bg-green-600" : ""}>
                                {c.completed_tasks}/{c.total_tasks}
                              </Badge>
                            </div>
                          </div>
                          <Progress value={pct} className="h-2" />
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-xs text-muted-foreground">{pct}% обзвонено</span>
                            {isDone ? (
                              <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />Выполнено
                              </span>
                            ) : (
                              <span className="text-xs text-orange-600 font-medium">
                                Осталось: {c.total_tasks - c.completed_tasks}
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="teacher-fb">
              <div className="flex items-center gap-3 mb-5">
                <Label className="text-sm">Месяц:</Label>
                <Input
                  type="month"
                  value={adminCallMonth}
                  onChange={(e) => setAdminCallMonth(e.target.value)}
                  className="w-44 h-8"
                />
              </div>

              {!adminTeacherFbSummary ? (
                <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
              ) : adminTeacherFbSummary.summary.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-muted-foreground">
                  <GraduationCap className="h-10 w-10 mb-2 opacity-30" />
                  <p className="text-sm">Нет данных за этот месяц. Учителя ещё не заполняли отзывы.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {adminTeacherFbSummary.summary.map((t: any) => {
                    const pct = t.total_tasks > 0 ? Math.round(t.completed_tasks / t.total_tasks * 100) : 0;
                    const isDone = pct === 100;
                    return (
                      <Card key={t.teacher_id} className={isDone ? "border-green-300 bg-green-50/30 dark:border-green-800 dark:bg-green-900/10" : ""}>
                        <CardContent className="pt-4 pb-4">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="font-semibold text-sm">{t.teacher_name}</p>
                            </div>
                            <div className="text-right">
                              <Badge variant={isDone ? "default" : "outline"} className={isDone ? "bg-green-600" : ""}>
                                {t.completed_tasks}/{t.total_tasks}
                              </Badge>
                            </div>
                          </div>
                          <Progress value={pct} className="h-2" />
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-xs text-muted-foreground">{pct}% заполнено</span>
                            {isDone ? (
                              <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />Выполнено
                              </span>
                            ) : (
                              <span className="text-xs text-orange-600 font-medium">
                                Осталось: {t.total_tasks - t.completed_tasks}
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    );
  }

  // ======== CURATOR / TEACHER VIEW ========
  return (
    <div>
      <div className="flex items-center gap-3 mb-4 md:mb-6">
        <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Shield className="h-4 w-4 md:h-5 md:w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg md:text-2xl font-heading font-bold text-foreground">Кураторство</h1>
          {!loading && groups.length > 0 && (
            <p className="text-sm text-muted-foreground">{groups.map((g) => g.name).join(" · ")}</p>
          )}
        </div>
      </div>

      {selectedStudent && (
        <StudentDetailDialog student={selectedStudent} onClose={() => setSelectedStudent(null)} />
      )}

      {loading ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : groups.length === 0 && isTeacher ? (
        /* ====== TEACHER (non-curator) FEEDBACK VIEW ====== */
        <>
          {teacherFbLoading ? (
            <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
          ) : !teacherFbData || teacherFbData.total === 0 ? (
            <Card className="text-center py-16">
              <CardContent>
                <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground/20 mb-3" />
                <p className="text-muted-foreground">У вас нет учеников по расписанию за текущий месяц</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Progress header */}
              <Card className="mb-5">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold">
                        Отзывы по ученикам за {new Date(teacherFbData.month + "-01").toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Напишите отзыв по каждому ученику — кураторы передадут родителям
                      </p>
                    </div>
                    <Badge
                      variant={teacherFbData.completed === teacherFbData.total ? "default" : "outline"}
                      className={`text-sm px-3 py-1 ${teacherFbData.completed === teacherFbData.total ? "bg-green-600" : ""}`}
                    >
                      {teacherFbData.completed}/{teacherFbData.total}
                    </Badge>
                  </div>
                  <Progress value={teacherFbData.total > 0 ? Math.round(teacherFbData.completed / teacherFbData.total * 100) : 0} className="h-2.5" />
                  <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
                    <span>{Math.round(teacherFbData.completed / teacherFbData.total * 100)}%</span>
                    {teacherFbData.completed === teacherFbData.total
                      ? <span className="text-green-600 font-medium flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Все заполнено!</span>
                      : <span className="text-orange-600">Осталось: {teacherFbData.total - teacherFbData.completed}</span>
                    }
                  </div>
                </CardContent>
              </Card>

              {/* Feedback tasks */}
              <div className="space-y-2">
                {teacherFbData.tasks.map((t: any) => {
                  const hasComment = t.comment && t.comment.trim().length > 0;
                  const isEditing = editingFbId === t.id;
                  return (
                    <Card key={t.id} className={hasComment ? "border-green-300/50 bg-green-50/20 dark:border-green-800/30 dark:bg-green-900/5" : ""}>
                      <CardContent className="pt-3 pb-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {hasComment
                              ? <CircleCheck className="h-4 w-4 text-green-600 shrink-0" />
                              : <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                            }
                            <span className="text-sm font-medium">{t.full_name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{t.group_name}</Badge>
                            {t.subject_name && <Badge variant="secondary" className="text-xs">{t.subject_name}</Badge>}
                          </div>
                        </div>

                        {isEditing ? (
                          <div className="space-y-2 mt-2">
                            <Textarea
                              value={editingFbText}
                              onChange={(e) => setEditingFbText(e.target.value)}
                              placeholder="Напишите отзыв об ученике: успеваемость, поведение, рекомендации..."
                              rows={3}
                              className="text-sm"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleSaveTeacherFb(t.id, editingFbText)}
                                disabled={!editingFbText.trim()}
                              >
                                Сохранить
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setEditingFbId(null); setEditingFbText(""); }}
                              >
                                Отмена
                              </Button>
                            </div>
                          </div>
                        ) : hasComment ? (
                          <div className="mt-1">
                            <p className="text-sm text-muted-foreground">{t.comment}</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-1 h-6 text-xs gap-1 px-2"
                              onClick={() => { setEditingFbId(t.id); setEditingFbText(t.comment); }}
                            >
                              <Edit className="h-3 w-3" />Редактировать
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-1 text-xs gap-1"
                            onClick={() => { setEditingFbId(t.id); setEditingFbText(""); }}
                          >
                            <Edit className="h-3 w-3" />Написать отзыв
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </>
      ) : groups.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <Shield className="h-12 w-12 mx-auto text-muted-foreground/20 mb-3" />
            <p className="text-muted-foreground">За вами не закреплено ни одной группы</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="overview">
          <TabsList className="mb-5">
            <TabsTrigger value="overview">
              <BarChart3 className="h-4 w-4 mr-1.5" />Обзор
            </TabsTrigger>
            <TabsTrigger value="students">
              <Users className="h-4 w-4 mr-1.5" />Мои ученики
              <Badge className="ml-1.5 h-4 min-w-4 text-xs px-1">{students.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="feedback">
              <Phone className="h-4 w-4 mr-1.5" />Связь с родителями
              {parentFeedback.length > 0 && (
                <Badge className="ml-1.5 h-4 min-w-4 text-xs px-1">{parentFeedback.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="calls">
              <PhoneCall className="h-4 w-4 mr-1.5" />Обзвон
              {callTasksData && callTasksData.total > 0 && (
                <Badge
                  className={`ml-1.5 h-4 min-w-4 text-xs px-1 ${
                    callTasksData.completed === callTasksData.total ? "bg-green-600" : ""
                  }`}
                  variant={callTasksData.completed === callTasksData.total ? "default" : "destructive"}
                >
                  {callTasksData.completed}/{callTasksData.total}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="attendance-grid">
              <ClipboardList className="h-4 w-4 mr-1.5" />Посещаемость
            </TabsTrigger>
            {isTeacher && (
              <TabsTrigger value="teacher-fb">
                <GraduationCap className="h-4 w-4 mr-1.5" />Мои отзывы
                {teacherFbData && teacherFbData.total > 0 && (
                  <Badge
                    className={`ml-1.5 h-4 min-w-4 text-xs px-1 ${
                      teacherFbData.completed === teacherFbData.total ? "bg-green-600" : ""
                    }`}
                    variant={teacherFbData.completed === teacherFbData.total ? "default" : "destructive"}
                  >
                    {teacherFbData.completed}/{teacherFbData.total}
                  </Badge>
                )}
              </TabsTrigger>
            )}
          </TabsList>

          {/* ====== OVERVIEW TAB ====== */}
          <TabsContent value="overview">
            <div className="grid gap-4 md:grid-cols-3 mb-8">
              <MetricCard
                icon={Calendar}
                label="Посещаемость (нед.)"
                value={metrics?.attendance != null ? `${metrics.attendance}%` : null}
                sub="по всем моим группам на этой неделе"
                iconClass="bg-blue-500/10"
              />
              <MetricCard
                icon={TrendingUp}
                label="Прогресс ЕНТ"
                value={metrics?.ent_delta != null
                  ? (metrics.ent_delta >= 0 ? `+${metrics.ent_delta} балл.` : `${metrics.ent_delta} балл.`)
                  : null}
                sub="среднее изменение за последний месяц"
                iconClass="bg-green-500/10"
              />
              <MetricCard
                icon={AlertTriangle}
                label="В зоне риска"
                value={metrics?.at_risk ?? 0}
                sub="более 3 прогулов за последние 30 дней"
                iconClass="bg-red-500/10"
              />
            </div>

            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Мои группы</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map((g: any) => (
                <Card key={g.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-base">{g.name}</p>
                        {g.profile_name && (
                          <Badge variant="secondary" className="mt-1.5 text-xs">{g.profile_name}</Badge>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-primary">{g.students_count}</p>
                        <p className="text-xs text-muted-foreground">учеников</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ====== STUDENTS TAB ====== */}
          <TabsContent value="students">
            <div className="mb-4">
              <Input
                placeholder="Поиск по ФИО или группе..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>ФИО</TableHead>
                    <TableHead>Группа</TableHead>
                    <TableHead>Общий балл ЕНТ</TableHead>
                    <TableHead>Имя родителя</TableHead>
                    <TableHead>Тел. родителя</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-10">Нет учеников</TableCell>
                    </TableRow>
                  ) : filteredStudents.map((s: any, i: number) => {
                    const waLink = getWhatsAppLink(s.parent_phone, s.full_name, s.group_name);
                    return (
                      <TableRow
                        key={s.id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => setSelectedStudent(s)}
                      >
                        <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                        <TableCell className="font-medium flex items-center gap-2">
                          <UserAvatar user={s} size="sm" />
                          {s.full_name}
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{s.group_name}</Badge></TableCell>
                        <TableCell>
                          {s.last_ent_score != null ? (
                            <span className={`font-semibold text-sm ${
                              s.last_ent_score >= 100 ? "text-green-600" :
                              s.last_ent_score >= 80 ? "text-yellow-600" : "text-red-600"
                            }`}>{s.last_ent_score}</span>
                          ) : <span className="text-muted-foreground text-xs">нет данных</span>}
                        </TableCell>
                        <TableCell className="text-sm">{s.parent_name || <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                        <TableCell className="text-sm">{s.parent_phone ? formatPhone(s.parent_phone) : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-0.5">
                            {waLink && (
                              <a href={waLink} target="_blank" rel="noopener noreferrer">
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                              </a>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedStudent(s)}>
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ====== PARENT FEEDBACK TAB ====== */}
          <TabsContent value="feedback">
            <AddFeedbackForm students={students} curatorId={curatorId} onAdded={loadData} />

            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Ученик / Группа</TableHead>
                    <TableHead>Итоги звонка</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parentFeedback.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                        Нет записей. Добавьте первый звонок выше.
                      </TableCell>
                    </TableRow>
                  ) : parentFeedback.map((fb: any) => {
                    const waLink = getWhatsAppLink(fb.parent_phone, fb.student_name, fb.group_name || "");
                    return (
                      <TableRow key={fb.id}>
                        <TableCell className="text-sm font-mono whitespace-nowrap">{fb.date}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <UserAvatar user={fb} size="xs" />
                            <p className="font-medium text-sm">{fb.student_name}</p>
                          </div>
                          {fb.group_name && <Badge variant="outline" className="text-xs mt-0.5">{fb.group_name}</Badge>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs">{fb.notes || "—"}</TableCell>
                        <TableCell>
                          <button onClick={() => handleToggleStatus(fb)}>
                            {fb.status === "resolved" ? (
                              <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/25 cursor-pointer border-0 gap-1">
                                <CheckCircle2 className="h-3 w-3" />Решено
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-orange-600 border-orange-300 hover:bg-orange-50 cursor-pointer gap-1">
                                <RotateCcw className="h-3 w-3" />Перезвонить
                              </Badge>
                            )}
                          </button>
                        </TableCell>
                        <TableCell>
                          {waLink ? (
                            <a href={waLink} target="_blank" rel="noopener noreferrer">
                              <Button variant="outline" size="sm" className="h-7 text-xs text-green-700 border-green-300 hover:bg-green-50 gap-1">
                                <ExternalLink className="h-3 w-3" />WhatsApp
                              </Button>
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-xs">нет номера</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive/60 hover:text-destructive"
                            onClick={() => handleDeleteFeedback(fb.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ====== CALLS TAB ====== */}
          <TabsContent value="calls">
            {callTasksLoading ? (
              <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
            ) : !callTasksData || callTasksData.total === 0 ? (
              <div className="flex flex-col items-center py-16 text-muted-foreground">
                <PhoneCall className="h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm">Нет учеников для обзвона</p>
              </div>
            ) : (
              <>
                {/* Progress header */}
                <Card className="mb-5">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-semibold">Обзвон родителей за {new Date(callTasksData.month + "-01").toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}</p>
                        <p className="text-xs text-muted-foreground">Необходимо обзвонить всех родителей каждый месяц</p>
                      </div>
                      <Badge
                        variant={callTasksData.completed === callTasksData.total ? "default" : "outline"}
                        className={`text-sm px-3 py-1 ${callTasksData.completed === callTasksData.total ? "bg-green-600" : ""}`}
                      >
                        {callTasksData.completed}/{callTasksData.total}
                      </Badge>
                    </div>
                    <Progress value={callTasksData.total > 0 ? Math.round(callTasksData.completed / callTasksData.total * 100) : 0} className="h-2.5" />
                    <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
                      <span>{Math.round(callTasksData.completed / callTasksData.total * 100)}%</span>
                      {callTasksData.completed === callTasksData.total
                        ? <span className="text-green-600 font-medium flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Все обзвонены!</span>
                        : <span className="text-orange-600">Осталось: {callTasksData.total - callTasksData.completed}</span>
                      }
                    </div>
                  </CardContent>
                </Card>

                {/* Call tasks list */}
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Ученик</TableHead>
                        <TableHead>Группа</TableHead>
                        <TableHead>Имя родителя</TableHead>
                        <TableHead>Тел. родителя</TableHead>
                        <TableHead>Итог</TableHead>
                        <TableHead>Комментарий</TableHead>
                        <TableHead>WhatsApp</TableHead>
                        <TableHead className="w-24"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {callTasksData.tasks.map((t: any) => {
                        const waLink = getWhatsAppLink(t.parent_phone, t.full_name, t.group_name || "");
                        const isDone = t.status === "completed";
                        return (
                          <TableRow key={t.id} className={isDone ? "bg-green-50/50 dark:bg-green-900/10" : ""}>
                            <TableCell>
                              {isDone
                                ? <CircleCheck className="h-5 w-5 text-green-600" />
                                : <Circle className="h-5 w-5 text-muted-foreground/40" />
                              }
                            </TableCell>
                            <TableCell className={`font-medium text-sm ${isDone ? "line-through text-muted-foreground" : ""}`}>
                              <span className="flex items-center gap-2">
                                <UserAvatar user={t} size="xs" />
                                {t.full_name}
                              </span>
                            </TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{t.group_name}</Badge></TableCell>
                            <TableCell className="text-sm">{t.parent_name || <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                            <TableCell className="text-sm">{t.parent_phone ? formatPhone(t.parent_phone) : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                            <TableCell>
                              {t.call_result ? (
                                <Badge variant={
                                  t.call_result === "Все хорошо" ? "default" :
                                  t.call_result === "Не ответил" ? "secondary" : "outline"
                                } className={`text-xs ${t.call_result === "Все хорошо" ? "bg-green-600" : t.call_result === "Есть проблемы" ? "border-orange-400 text-orange-600" : ""}`}>
                                  {t.call_result}
                                </Badge>
                              ) : null}
                            </TableCell>
                            <TableCell>
                              {t.notes ? (
                                <span className="text-xs text-muted-foreground">{t.notes}</span>
                              ) : null}
                            </TableCell>
                            <TableCell>
                              {waLink ? (
                                <a href={waLink} target="_blank" rel="noopener noreferrer">
                                  <Button variant="outline" size="sm" className="h-7 text-xs text-green-700 border-green-300 hover:bg-green-50 gap-1">
                                    <ExternalLink className="h-3 w-3" />WA
                                  </Button>
                                </a>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {isDone ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs gap-1 text-muted-foreground"
                                  onClick={() => handleUncompleteCall(t.id)}
                                >
                                  <RotateCcw className="h-3 w-3" />Отменить
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                  onClick={() => openCallDialog(t)}
                                >
                                  <PhoneCall className="h-3 w-3" />Обзвонил
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </TabsContent>

          {/* ====== ATTENDANCE GRID TAB ====== */}
          <TabsContent value="attendance-grid">
            <div className="flex flex-wrap items-end gap-3 mb-5">
              <div className="space-y-1">
                <Label className="text-xs">Группа</Label>
                <Select value={gridGroupId} onValueChange={setGridGroupId}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Группа" /></SelectTrigger>
                  <SelectContent>
                    {groups.map((g: any) => (
                      <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-1.5">
                <Button variant={gridRangeMode === "current" ? "default" : "outline"} size="sm" onClick={() => setGridRangeMode("current")}>
                  Текущий месяц
                </Button>
                <Button variant={gridRangeMode === "prev" ? "default" : "outline"} size="sm" onClick={() => setGridRangeMode("prev")}>
                  Прошлый месяц
                </Button>
                <Button variant={gridRangeMode === "custom" ? "default" : "outline"} size="sm" onClick={() => setGridRangeMode("custom")}>
                  Свои даты
                </Button>
              </div>
              {gridRangeMode === "custom" && (
                <div className="flex items-center gap-2">
                  <Input type="date" value={gridCustomFrom} onChange={(e) => setGridCustomFrom(e.target.value)} className="w-36 h-8 text-xs" />
                  <span className="text-muted-foreground text-xs">—</span>
                  <Input type="date" value={gridCustomTo} onChange={(e) => setGridCustomTo(e.target.value)} className="w-36 h-8 text-xs" />
                </div>
              )}
              {gridRangeMode !== "custom" && (
                <span className="text-xs text-muted-foreground capitalize">{gridDateRange.label}</span>
              )}
            </div>

            {gridLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
              </div>
            ) : !gridData || gridData.dates?.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-muted-foreground">
                <ClipboardList className="h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm">Нет данных посещаемости за выбранный период</p>
              </div>
            ) : (
              <ScrollArea className="w-full">
                <div className="rounded-md border overflow-hidden min-w-max">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-background z-10 min-w-[180px]">Ученик</TableHead>
                        {gridData.dates.map((d: string) => {
                          const day = new Date(d + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
                          const weekday = new Date(d + "T00:00:00").toLocaleDateString("ru-RU", { weekday: "short" });
                          return (
                            <TableHead key={d} className="text-center min-w-[48px] px-1">
                              <div className="text-xs leading-tight">
                                <div>{day}</div>
                                <div className="text-muted-foreground font-normal">{weekday}</div>
                              </div>
                            </TableHead>
                          );
                        })}
                        <TableHead className="text-center min-w-[60px] sticky right-0 bg-background z-10">Итого</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gridData.students.map((s: any) => (
                        <TableRow key={s.id}>
                          <TableCell className="sticky left-0 bg-background z-10 font-medium text-sm whitespace-nowrap">
                            {s.full_name}
                          </TableCell>
                          {gridData.dates.map((d: string) => {
                            const val = s.attendance[d];
                            return (
                              <TableCell key={d} className="text-center px-1 py-1.5">
                                {val === "present" && (
                                  <div className="w-6 h-6 mx-auto rounded bg-green-500/20 text-green-700 flex items-center justify-center text-xs font-bold">+</div>
                                )}
                                {val === "late" && (
                                  <div className="w-6 h-6 mx-auto rounded bg-orange-500/20 text-orange-700 flex items-center justify-center">
                                    <Clock className="h-3 w-3" />
                                  </div>
                                )}
                                {val === "absent" && (
                                  <div className="w-6 h-6 mx-auto rounded bg-red-500/20 text-red-700 flex items-center justify-center text-xs font-bold">−</div>
                                )}
                                {!val && (
                                  <div className="w-6 h-6 mx-auto rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">·</div>
                                )}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center sticky right-0 bg-background z-10">
                            <Badge variant="outline" className="text-xs font-mono">{s.total}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            )}
          </TabsContent>

          {/* ====== TEACHER FEEDBACK TAB (for curator who is also a teacher) ====== */}
          {isTeacher && (
            <TabsContent value="teacher-fb">
              {teacherFbLoading ? (
                <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
              ) : !teacherFbData || teacherFbData.total === 0 ? (
                <div className="flex flex-col items-center py-16 text-muted-foreground">
                  <GraduationCap className="h-10 w-10 mb-2 opacity-30" />
                  <p className="text-sm">У вас нет учеников по расписанию за текущий месяц</p>
                </div>
              ) : (
                <>
                  <Card className="mb-5">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-sm font-semibold">
                            Отзывы по ученикам за {new Date(teacherFbData.month + "-01").toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}
                          </p>
                          <p className="text-xs text-muted-foreground">Напишите отзыв по каждому ученику — кураторы передадут родителям</p>
                        </div>
                        <Badge
                          variant={teacherFbData.completed === teacherFbData.total ? "default" : "outline"}
                          className={`text-sm px-3 py-1 ${teacherFbData.completed === teacherFbData.total ? "bg-green-600" : ""}`}
                        >
                          {teacherFbData.completed}/{teacherFbData.total}
                        </Badge>
                      </div>
                      <Progress value={teacherFbData.total > 0 ? Math.round(teacherFbData.completed / teacherFbData.total * 100) : 0} className="h-2.5" />
                    </CardContent>
                  </Card>

                  <div className="space-y-2">
                    {teacherFbData.tasks.map((t: any) => {
                      const hasComment = t.comment && t.comment.trim().length > 0;
                      const isEditing = editingFbId === t.id;
                      return (
                        <Card key={t.id} className={hasComment ? "border-green-300/50 bg-green-50/20 dark:border-green-800/30 dark:bg-green-900/5" : ""}>
                          <CardContent className="pt-3 pb-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {hasComment
                                  ? <CircleCheck className="h-4 w-4 text-green-600 shrink-0" />
                                  : <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                                }
                                <span className="text-sm font-medium">{t.full_name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">{t.group_name}</Badge>
                                {t.subject_name && <Badge variant="secondary" className="text-xs">{t.subject_name}</Badge>}
                              </div>
                            </div>
                            {isEditing ? (
                              <div className="space-y-2 mt-2">
                                <Textarea
                                  value={editingFbText}
                                  onChange={(e) => setEditingFbText(e.target.value)}
                                  placeholder="Напишите отзыв об ученике: успеваемость, поведение, рекомендации..."
                                  rows={3}
                                  className="text-sm"
                                />
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={() => handleSaveTeacherFb(t.id, editingFbText)} disabled={!editingFbText.trim()}>Сохранить</Button>
                                  <Button variant="ghost" size="sm" onClick={() => { setEditingFbId(null); setEditingFbText(""); }}>Отмена</Button>
                                </div>
                              </div>
                            ) : hasComment ? (
                              <div className="mt-1">
                                <p className="text-sm text-muted-foreground">{t.comment}</p>
                                <Button variant="ghost" size="sm" className="mt-1 h-6 text-xs gap-1 px-2" onClick={() => { setEditingFbId(t.id); setEditingFbText(t.comment); }}>
                                  <Edit className="h-3 w-3" />Редактировать
                                </Button>
                              </div>
                            ) : (
                              <Button variant="outline" size="sm" className="mt-1 text-xs gap-1" onClick={() => { setEditingFbId(t.id); setEditingFbText(""); }}>
                                <Edit className="h-3 w-3" />Написать отзыв
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </>
              )}
            </TabsContent>
          )}
        </Tabs>
      )}

      {/* Call Confirmation Dialog */}
      {callDialogTask && (
        <Dialog open onOpenChange={(open) => !open && closeCallDialog()}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PhoneCall className="h-5 w-5 text-primary" />
                Подтверждение обзвона
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <p className="text-sm font-medium">{callDialogTask.full_name}</p>
                <p className="text-xs text-muted-foreground">{callDialogTask.group_name}</p>
                {callDialogTask.parent_name && (
                  <p className="text-xs text-muted-foreground">Родитель: {callDialogTask.parent_name}</p>
                )}
                {callDialogTask.parent_phone && (
                  <p className="text-xs text-muted-foreground">Тел: {formatPhone(callDialogTask.parent_phone)}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Итог обзвона <span className="text-red-500">*</span></Label>
                <Select value={callDialogResult} onValueChange={setCallDialogResult}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите итог..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Все хорошо">Все хорошо</SelectItem>
                    <SelectItem value="Есть проблемы">Есть проблемы</SelectItem>
                    <SelectItem value="Не ответил">Не ответил</SelectItem>
                    <SelectItem value="Перезвонить">Перезвонить</SelectItem>
                    <SelectItem value="Номер недоступен">Номер недоступен</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Комментарий <span className="text-red-500">*</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    ({callDialogNotes.trim().length}/20 мин.)
                  </span>
                </Label>
                <Textarea
                  value={callDialogNotes}
                  onChange={(e) => setCallDialogNotes(e.target.value)}
                  placeholder="Опишите результат разговора с родителем (минимум 20 символов)..."
                  rows={3}
                  className="text-sm"
                />
                {callDialogNotes.trim().length > 0 && callDialogNotes.trim().length < 20 && (
                  <p className="text-xs text-red-500">Минимум 20 символов</p>
                )}
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button variant="ghost" onClick={closeCallDialog}>Отмена</Button>
                <Button
                  disabled={!callDialogResult || callDialogNotes.trim().length < 20}
                  onClick={async () => {
                    await handleCompleteCall(callDialogTask.id, callDialogResult, callDialogNotes.trim());
                    closeCallDialog();
                  }}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Подтвердить
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

