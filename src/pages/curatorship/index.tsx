import { useState, useEffect, useCallback, useMemo } from "react";
import { GroupPersonAvatar } from "@/components/GroupPersonAvatar";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import {
  Shield, Users, TrendingUp, AlertTriangle, Phone, Calendar,
  ExternalLink, Plus, Trash2, CheckCircle2, RotateCcw, BookOpen, BarChart3, ChevronRight,
  ClipboardList, Clock, PhoneCall, CircleCheck, Circle, MessageSquare, Edit, GraduationCap, MoreHorizontal,
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
import { MetricCard } from "./components/MetricCard";
import { StudentDetailDialog } from "./components/StudentDetailDialog";
import {
  fetchStudentDetails,
  fetchStudentMonthlyStats,
  fetchAttendanceGrid,
  createParentFeedback,
  updateParentFeedback,
  deleteParentFeedback,
  updateCallTask,
  updateTeacherFeedback,
  fetchTeacherFeedbackByStudent,
  fetchLessonCommentsByStudent,
} from "@/lib/api";

import {
  useAdminGroups,
  useCuratorGroups,
  useCuratorStudents,
  useCuratorMetrics,
  useAdminCallSummary,
  useAdminTeacherFeedbackSummary,
  useCallTasks,
  useTeacherFeedback
} from "./hooks/useCuratorshipData";

import { MyStudentsTab } from "./tabs/MyStudentsTab";
import { CallTasksTab } from "./tabs/CallTasksTab";
import { AttendanceGridTab } from "./tabs/AttendanceGridTab";
import { TeacherFeedbackTab } from "./tabs/TeacherFeedbackTab";

export function getWhatsAppLink(phone: string | null | undefined, studentName: string, groupName: string): string | null {
  if (!phone) return null;
  const clean = phone.replace(/\D/g, "");
  if (!clean) return null;
  const text = encodeURIComponent(`Здравствуйте! Это куратор группы ${groupName}. Пишу по поводу ученика ${studentName}.`);
  return `https://wa.me/${clean}?text=${text}`;
}

const generateMonthOptions = () => {
  const options = [];
  const date = new Date();
  date.setDate(1); 
  date.setMonth(date.getMonth() - 6); 

  for (let i = 0; i < 9; i++) { 
    const val = date.toISOString().slice(0, 7);
    const label = date.toLocaleString('ru-RU', { month: 'long', year: 'numeric' });
    options.push({ value: val, label: label.charAt(0).toUpperCase() + label.slice(1) });
    date.setMonth(date.getMonth() + 1);
  }
  return options.reverse();
};
const MONTH_OPTIONS = generateMonthOptions();



// ====================== STUDENT DETAIL DIALOG ======================
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
  const { i18n } = useTranslation();
  const locale = { ru: "ru-RU", kk: "kk-KZ", en: "en-US" }[i18n.language] ?? "ru-RU";
  
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  
  const [adminCallMonth, setAdminCallMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [expandedCuratorId, setExpandedCuratorId] = useState<number | null>(null);
  const [expandedTeacherId, setExpandedTeacherId] = useState<number | null>(null);

  const curatorId = user ? parseInt(user.id) : 0;
  const isAdmin = user?.role === "admin" || user?.role === "umo_head";
  const isTeacher = user?.role === "teacher";

  // Admin Data
  const { data: allGroups = [], isLoading: allGroupsLoading } = useAdminGroups();
  const { data: adminCallSummary, isLoading: adminCallSummaryLoading } = useAdminCallSummary(adminCallMonth);
  const { data: adminTeacherFbSummary, isLoading: adminTeacherFbSummaryLoading } = useAdminTeacherFeedbackSummary(adminCallMonth);

  // Curator / Teacher Data
  const { data: groups = [], isLoading: groupsLoading } = useCuratorGroups(isAdmin ? 0 : curatorId);
  const { data: students = [], isLoading: studentsLoading } = useCuratorStudents(isAdmin ? 0 : curatorId);
  const { data: metrics, isLoading: metricsLoading } = useCuratorMetrics(isAdmin ? 0 : curatorId);
  const { data: callTasksData, isLoading: callTasksLoading, refetch: refetchCallTasks } = useCallTasks(isAdmin ? 0 : curatorId);
  const { data: teacherFbData, isLoading: teacherFbLoading, refetch: refetchTeacherFeedback } = useTeacherFeedback(isAdmin ? 0 : curatorId);

  // For Admin Expanded views
  const { data: expandedCuratorTasks, isLoading: expandedCuratorTasksLoading } = useCallTasks(expandedCuratorId || 0, adminCallMonth);
  const { data: expandedTeacherTasks, isLoading: expandedTeacherTasksLoading } = useTeacherFeedback(expandedTeacherId || 0, adminCallMonth);

  const loading = isAdmin 
    ? allGroupsLoading 
    : (groupsLoading || studentsLoading || metricsLoading);

  // ======== ADMIN / UMO VIEW ========
  if (isAdmin) {
    return (
      <div>
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
              <div className="rounded-md border overflow-x-auto">
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
                <Select value={adminCallMonth} onValueChange={setAdminCallMonth}>
                  <SelectTrigger className="w-48 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_OPTIONS.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
const isExpanded = expandedCuratorId === c.curator_id;
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
                            <div className="flex items-center gap-2">
                              <Badge variant={isDone ? "default" : "outline"} className={isDone ? "bg-green-600" : ""}>
                                {c.completed_tasks}/{c.total_tasks}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => {
                                  if (isExpanded) {
                                    setExpandedCuratorId(null);
                                  } else {
                                    setExpandedCuratorId(c.curator_id);
                                  }
                                }}
                              >
                                {isExpanded ? "Свернуть" : "Подробнее"}
                              </Button>
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
                          {isExpanded && (
                            <div className="mt-3 border-t pt-3">
                              {expandedCuratorTasksLoading ? (
                                <div className="text-xs text-muted-foreground py-2 text-center">Загрузка...</div>
                              ) : expandedCuratorTasks?.tasks?.length ? (
                                <div className="space-y-1.5">
                                  {expandedCuratorTasks.tasks.map((task: any) => (
                                    <div
                                      key={task.id}
                                      className={`flex items-start gap-2 p-2 rounded-md text-xs ${task.status === "completed" ? "bg-green-50 dark:bg-green-900/20" : "bg-muted/40"}`}
                                    >
                                      <div className="mt-0.5 shrink-0">
                                        {task.status === "completed"
                                          ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                                          : <Circle className="h-3.5 w-3.5 text-muted-foreground" />}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium">{task.full_name}</p>
                                        {task.parent_name && <p className="text-muted-foreground">{task.parent_name}</p>}
                                        {task.parent_phone && (
                                          <p className="text-muted-foreground">{task.parent_phone}</p>
                                        )}
                                        {task.status === "completed" && task.call_result && (
                                          <p className="text-green-700 dark:text-green-400 mt-0.5">
                                            Итог: {task.call_result}
                                          </p>
                                        )}
                                        {task.status === "completed" && task.notes && (
                                          <p className="text-muted-foreground mt-0.5 line-clamp-2">{task.notes}</p>
                                        )}
                                      </div>
                                      {task.group_name && (
                                        <Badge variant="outline" className="text-[10px] shrink-0">{task.group_name}</Badge>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground text-center py-2">Нет данных</p>
                              )}
                            </div>
                          )}
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
                <Select value={adminCallMonth} onValueChange={setAdminCallMonth}>
                  <SelectTrigger className="w-48 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_OPTIONS.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                            <div className="flex items-center gap-2">
                              <Badge variant={isDone ? "default" : "outline"} className={isDone ? "bg-green-600" : ""}>
                                {t.completed_tasks}/{t.total_tasks}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => {
                                  if (expandedTeacherId === t.teacher_id) {
                                    setExpandedTeacherId(null);
                                  } else {
                                    setExpandedTeacherId(t.teacher_id);
                                  }
                                }}
                              >
                                {expandedTeacherId === t.teacher_id ? "Свернуть" : "Подробнее"}
                              </Button>
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
                          {expandedTeacherId === t.teacher_id && (
                            <div className="mt-3 border-t pt-3">
                              {expandedTeacherTasksLoading ? (
                                <div className="text-xs text-muted-foreground py-2 text-center">Загрузка...</div>
                              ) : expandedTeacherTasks?.tasks?.length ? (
                                <div className="space-y-1.5">
                                  {expandedTeacherTasks.tasks.map((task: any) => {
                                    const hasComment = task.comment && task.comment.trim().length > 0;
                                    return (
                                      <div
                                        key={task.id}
                                        className={`flex items-start gap-2 p-2 rounded-md text-xs ${hasComment ? "bg-green-50 dark:bg-green-900/20" : "bg-muted/40"}`}
                                      >
                                        <div className="mt-0.5 shrink-0">
                                          {hasComment
                                            ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                                            : <Circle className="h-3.5 w-3.5 text-muted-foreground" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="font-medium">{task.full_name}</p>
                                          <div className="flex items-center gap-2 mt-0.5">
                                            <Badge variant="outline" className="text-[10px]">{task.subject_name}</Badge>
                                            {task.group_name && <span className="text-[10px] text-muted-foreground">{task.group_name}</span>}
                                          </div>
                                          {hasComment && (
                                            <p className="text-muted-foreground mt-1 bg-background/50 p-1.5 rounded line-clamp-2">
                                              {task.comment}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground text-center py-2">Нет данных</p>
                              )}
                            </div>
                          )}
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
          <TeacherFeedbackTab
          teacherFbData={teacherFbData}
          teacherFbLoading={teacherFbLoading}
          locale={locale}
          onUpdate={() => refetchTeacherFeedback()}
        />
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
            <MyStudentsTab students={students} onSelectStudent={setSelectedStudent} />
          </TabsContent>

          {/* ====== CALLS TAB ====== */}
          <TabsContent value="calls">
              <CallTasksTab 
              callTasksData={callTasksData} 
              callTasksLoading={callTasksLoading} 
              locale={locale} 
              onUpdate={() => refetchCallTasks()} 
            />
          </TabsContent>

          {/* ====== ATTENDANCE GRID TAB ====== */}
          <TabsContent value="attendance-grid">
            <AttendanceGridTab groups={groups} locale={locale} />
          </TabsContent>

          {/* ====== TEACHER FEEDBACK TAB (for curator who is also a teacher) ====== */}
          {isTeacher && (
            <TabsContent value="teacher-fb">
              <TeacherFeedbackTab
                teacherFbData={teacherFbData}
                teacherFbLoading={teacherFbLoading}
                locale={locale}
                onUpdate={() => refetchTeacherFeedback()}
              />
            </TabsContent>
          )}
        </Tabs>
      )}

      {/* Call Confirmation Dialog was moved to CallTasksTab */}
    </div>
  );
}

