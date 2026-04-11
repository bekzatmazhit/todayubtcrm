import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, BookOpen, BookX, BookMarked, Save, UserPlus, X as XIcon, Archive, ClipboardList, CheckCheck } from "lucide-react";
import { Lesson, Student } from "@/data/mockSchedule";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { fetchAttendanceByScheduleDate, updateAttendance, fetchStudents, createStudent, archiveStudent, updateStudent, createQuiz } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { GroupPersonAvatar } from "@/components/GroupPersonAvatar";

interface Props {
  lesson: Lesson | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date?: string;
  onSaved?: (info: { schedule_id: number | null; date: string }) => void;
  onStudentArchived?: (studentId: string, groupId: number | undefined) => void;
}

export function ClassManagementModal({ lesson, open, onOpenChange, date, onSaved, onStudentArchived }: Props) {
  const [students, setStudents] = useState<Student[]>([]);
  const [saving, setSaving] = useState(false);
  const { t } = useTranslation();
  const { user } = useAuth();

  const [showQuizPanel, setShowQuizPanel] = useState(false);
  const [quizTitle, setQuizTitle] = useState("");
  const [quizMaxScore, setQuizMaxScore] = useState<string>("100");
  const [quizScores, setQuizScores] = useState<Record<string, string>>({});
  const [savingQuiz, setSavingQuiz] = useState(false);

  const [archiveTarget, setArchiveTarget] = useState<Student | null>(null);
  const [archiving, setArchiving] = useState(false);

  const [showAddStudent, setShowAddStudent] = useState(false);
  const [addMode, setAddMode] = useState<"search" | "new">("search");
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [addStudentSearch, setAddStudentSearch] = useState("");
  const [newStudentForm, setNewStudentForm] = useState({ full_name: "", phone: "", parent_name: "", parent_phone: "" });
  const [creatingStudent, setCreatingStudent] = useState(false);

  useEffect(() => {
    if (lesson && open) {
      setStudents(lesson.students.map((s) => ({ ...s })));
      setShowAddStudent(false);
      setAddMode("search");
      setAddStudentSearch("");
      setNewStudentForm({ full_name: "", phone: "", parent_name: "", parent_phone: "" });
      setShowQuizPanel(false);
      setQuizTitle("");
      setQuizMaxScore("100");
      setQuizScores({});
    }
  }, [lesson?.id, open]);

  useEffect(() => {
    if (open && allStudents.length === 0) {
      fetchStudents().then(setAllStudents);
    }
  }, [open]);

  useEffect(() => {
    if (!lesson || !open) return;
    const scheduleId = getScheduleId();
    if (!scheduleId) return;
    const dateStr = date || new Date().toISOString().slice(0, 10);
    let cancelled = false;
    (async () => {
      const rows = await fetchAttendanceByScheduleDate({ scheduleId, date: dateStr });
      if (cancelled) return;
      const byStudentId = new Map<number, any>();
      for (const r of rows as any[]) {
        if (typeof r?.student_id === "number") byStudentId.set(r.student_id, r);
      }
      setStudents((prev) => prev.map((s) => {
        const sid = getStudentId(s.id);
        if (!sid) return s;
        const rec = byStudentId.get(sid);
        if (!rec) return s;
        return { ...s, attendance: (rec.status as any) || s.attendance, lateness: (rec.lateness as any) || s.lateness, homework: (rec.homework as any) || s.homework, comment: rec.comment ?? "" };
      }));
    })();
    return () => { cancelled = true; };
  }, [lesson?.id, open, date]);

  const updateStudentLocal = (id: string, updates: Partial<Student>) => {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const markAll = (attendance: "present" | "absent") => {
    setStudents((prev) => prev.map((s) => ({ ...s, attendance })));
  };

  const getScheduleId = () => {
    if (!lesson) return null;
    const match = lesson.id.match(/lesson-(\d+)/);
    return match ? parseInt(match[1]) : null;
  };

  const getStudentId = (sid: string) => {
    const match = sid.match(/s-(\d+)/);
    return match ? parseInt(match[1]) : null;
  };

  const handleArchiveConfirm = async () => {
    if (!archiveTarget) return;
    const numericId = getStudentId(archiveTarget.id);
    if (!numericId) {
      setStudents((prev) => prev.filter((s) => s.id !== archiveTarget.id));
      setArchiveTarget(null);
      return;
    }
    setArchiving(true);
    try {
      await archiveStudent(numericId);
      setStudents((prev) => prev.filter((s) => s.id !== archiveTarget.id));
      onStudentArchived?.(archiveTarget.id, (lesson as any)?.group_id);
      toast.success(`${archiveTarget.full_name} переведён в архив`);
    } catch {
      toast.error("Ошибка при архивировании");
    } finally {
      setArchiving(false);
      setArchiveTarget(null);
    }
  };

  const addExtraStudent = (s: any) => {
    const sid = `s-${s.id}`;
    if (students.some(st => st.id === sid)) return;
    setStudents((prev) => [...prev, { id: sid, full_name: s.full_name, attendance: "present" as const, lateness: "on_time" as const, homework: "done" as const, comment: "" }]);
    const groupId = (lesson as any).group_id as number | undefined;
    if (groupId && s.group_id !== groupId) {
      updateStudent(s.id, { group_id: groupId }).catch(() => {});
      toast.success(`${s.full_name} добавлен в группу ${lesson.group_name}`);
    }
    setAddStudentSearch("");
  };

  const handleCreateStudent = async () => {
    if (!newStudentForm.full_name.trim()) return;
    const groupId = (lesson as any).group_id as number | undefined;
    setCreatingStudent(true);
    try {
      const created = await createStudent({ full_name: newStudentForm.full_name.trim(), phone: newStudentForm.phone.trim() || null, parent_name: newStudentForm.parent_name.trim() || null, parent_phone: newStudentForm.parent_phone.trim() || null, group_id: groupId || null, status: "active" });
      if (created?.id) {
        setStudents((prev) => [...prev, { id: `s-${created.id}`, full_name: newStudentForm.full_name.trim(), attendance: "present" as const, lateness: "on_time" as const, homework: "done" as const, comment: "" }]);
        fetchStudents().then(setAllStudents);
        toast.success(`${newStudentForm.full_name.trim()} добавлен в группу`);
        setNewStudentForm({ full_name: "", phone: "", parent_name: "", parent_phone: "" });
        setShowAddStudent(false);
      }
    } catch {
      toast.error("Ошибка создания ученика");
    } finally {
      setCreatingStudent(false);
    }
  };

  const handleSaveQuiz = async () => {
    if (!quizTitle.trim()) { toast.error("Введите название теста"); return; }
    const scheduleId = getScheduleId();
    const dateStr = date || new Date().toISOString().slice(0, 10);
    setSavingQuiz(true);
    try {
      const results = students.map((s) => {
        const numId = getStudentId(s.id);
        const raw = quizScores[s.id];
        const score = raw !== undefined && raw !== "" ? parseFloat(raw) : null;
        return numId ? { student_id: numId, score } : null;
      }).filter(Boolean) as { student_id: number; score: number | null }[];
      await createQuiz({ schedule_id: scheduleId, date: dateStr, title: quizTitle.trim(), results, created_by: Number(user?.id) });
      toast.success("Тест сохранён");
      setShowQuizPanel(false);
      setQuizTitle("");
      setQuizMaxScore("100");
      setQuizScores({});
    } catch {
      toast.error("Ошибка сохранения теста");
    } finally {
      setSavingQuiz(false);
    }
  };

  const handleSave = async () => {
    if (!lesson) return;
    setSaving(true);
    const scheduleId = getScheduleId();
    const dateStr = date || new Date().toISOString().slice(0, 10);
    try {
      const promises = students.map((student) => {
        const studentId = getStudentId(student.id);
        if (!studentId) return Promise.resolve(null);
        return updateAttendance(studentId, 0, { schedule_id: scheduleId, date: dateStr, status: student.attendance, lateness: student.lateness, homework: student.homework, comment: student.comment || null });
      });
      await Promise.all(promises);
      toast.success(t("Attendance saved successfully!"));
      onSaved?.({ schedule_id: scheduleId, date: dateStr });
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving attendance:", error);
      toast.error("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  if (!lesson) return null;

  const presentCount = students.filter(s => s.attendance === "present").length;
  const absentCount = students.filter(s => s.attendance === "absent").length;
  const maxScore = parseFloat(quizMaxScore) || 100;

  const getScoreColor = (val: string) => {
    if (!val) return "";
    const pct = parseFloat(val) / maxScore;
    if (pct >= 0.8) return "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400";
    if (pct >= 0.5) return "border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400";
    return "border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400";
  };

  const getScoreDot = (val: string) => {
    if (!val) return null;
    const pct = parseFloat(val) / maxScore;
    if (pct >= 0.8) return "bg-emerald-500";
    if (pct >= 0.5) return "bg-amber-500";
    return "bg-red-500";
  };

  const currentStudentIds = new Set(students.map(s => s.id));
  const filteredAddList = allStudents
    .filter(s => {
      if (currentStudentIds.has(`s-${s.id}`)) return false;
      if (!addStudentSearch) return true;
      return s.full_name.toLowerCase().includes(addStudentSearch.toLowerCase()) || (s.group_name || "").toLowerCase().includes(addStudentSearch.toLowerCase());
    })
    .slice(0, 20);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] md:max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">{t("Class Management")}</DialogTitle>
          </DialogHeader>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="default" className="flex items-center gap-1.5">
              <GroupPersonAvatar groupName={lesson.group_name} size={16} showTooltip={false} />
              {lesson.group_name}
            </Badge>
            <Badge variant="secondary">{lesson.subject}</Badge>
            <Badge variant="outline">{lesson.room}</Badge>
            <Badge variant="outline">{lesson.time_slot}</Badge>
          </div>

          {/* Top action buttons + stats */}
          <div className="flex flex-wrap items-center justify-between gap-2 py-1">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={showAddStudent ? "default" : "outline"}
                size="sm"
                onClick={() => { setShowAddStudent(v => !v); setShowQuizPanel(false); }}
              >
                <UserPlus className="h-4 w-4 mr-1.5" />
                Добавить ученика
              </Button>
              <Button
                variant={showQuizPanel ? "default" : "outline"}
                size="sm"
                onClick={() => { setShowQuizPanel(v => !v); setShowAddStudent(false); }}
              >
                <ClipboardList className="h-4 w-4 mr-1.5" />
                Контрольный тест
              </Button>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="font-semibold text-foreground">{presentCount}</span>
              </span>
              <span className="flex items-center gap-1">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="font-semibold text-foreground">{absentCount}</span>
              </span>
              <span className="text-xs">{t("Total")}: <strong>{students.length}</strong></span>
            </div>
          </div>

          {/* Add student panel */}
          {showAddStudent && (
            <div className="border rounded-lg p-3 space-y-2 bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    onClick={() => setAddMode("search")}
                    className={`text-sm px-3 py-1 rounded-md font-medium transition-colors ${addMode === "search" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                  >
                    Существующий
                  </button>
                  <button
                    onClick={() => setAddMode("new")}
                    className={`text-sm px-3 py-1 rounded-md font-medium transition-colors ${addMode === "new" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                  >
                    Новый ученик
                  </button>
                </div>
                <button onClick={() => { setShowAddStudent(false); setAddStudentSearch(""); }} className="text-muted-foreground hover:text-foreground">
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
              {addMode === "search" ? (
                <>
                  <Input value={addStudentSearch} onChange={(e) => setAddStudentSearch(e.target.value)} placeholder="Поиск по имени или группе..." className="h-8 text-sm" autoFocus />
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {filteredAddList.length === 0 && addStudentSearch && <p className="text-xs text-muted-foreground text-center py-2">Не найдено</p>}
                    {filteredAddList.map((s) => (
                      <button key={s.id} onClick={() => addExtraStudent(s)} className="w-full text-left px-3 py-2 rounded-md hover:bg-muted text-sm flex items-center justify-between">
                        <span>{s.full_name}</span>
                        {s.group_name && <Badge variant="outline" className="text-xs">{s.group_name}</Badge>}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Input value={newStudentForm.full_name} onChange={(e) => setNewStudentForm(f => ({ ...f, full_name: e.target.value }))} placeholder="ФИО ученика *" className="h-8 text-sm" autoFocus />
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={newStudentForm.phone} onChange={(e) => setNewStudentForm(f => ({ ...f, phone: e.target.value }))} placeholder="Телефон ученика" className="h-8 text-sm" />
                    <Input value={newStudentForm.parent_phone} onChange={(e) => setNewStudentForm(f => ({ ...f, parent_phone: e.target.value }))} placeholder="Телефон родителя" className="h-8 text-sm" />
                  </div>
                  <Input value={newStudentForm.parent_name} onChange={(e) => setNewStudentForm(f => ({ ...f, parent_name: e.target.value }))} placeholder="Имя родителя" className="h-8 text-sm" />
                  <p className="text-xs text-muted-foreground">Ученик будет добавлен в группу <strong>{lesson.group_name}</strong></p>
                  <Button size="sm" onClick={handleCreateStudent} disabled={!newStudentForm.full_name.trim() || creatingStudent} className="w-full">
                    {creatingStudent ? "Создание..." : "Создать и добавить"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Quiz panel */}
          {showQuizPanel && (
            <div className="border-2 border-primary/20 rounded-xl overflow-hidden bg-gradient-to-br from-primary/5 to-primary/0">
              <div className="flex items-center justify-between px-4 py-3 bg-primary/10 border-b border-primary/20">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                    <ClipboardList className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <span className="font-semibold text-sm">Контрольный тест</span>
                </div>
                <button onClick={() => setShowQuizPanel(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex gap-2">
                  <Input
                    className="flex-1 h-9 text-sm font-medium"
                    placeholder="Название теста (напр. «Итоговый тест — Апрель»)..."
                    value={quizTitle}
                    onChange={e => setQuizTitle(e.target.value)}
                    autoFocus
                  />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Макс. балл:</span>
                    <Input
                      type="number"
                      min="1"
                      className="w-20 h-9 text-sm text-center"
                      value={quizMaxScore}
                      onChange={e => setQuizMaxScore(e.target.value)}
                    />
                  </div>
                </div>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/60">
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground w-8">#</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Ученик</th>
                        <th className="text-center px-3 py-2 font-medium text-muted-foreground w-36">Балл / {quizMaxScore || "—"}</th>
                        <th className="text-center px-3 py-2 font-medium text-muted-foreground w-16 hidden sm:table-cell">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((s, idx) => {
                        const val = quizScores[s.id] ?? "";
                        const dot = getScoreDot(val);
                        const pct = val ? Math.round((parseFloat(val) / maxScore) * 100) : null;
                        return (
                          <tr key={s.id} className="border-t border-border/60 hover:bg-muted/20 transition-colors">
                            <td className="px-3 py-2 text-muted-foreground text-xs">{idx + 1}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                {dot && <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />}
                                <span className="font-medium">{s.full_name}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                max={quizMaxScore || undefined}
                                className={`w-full border-2 rounded-md px-2 py-1 text-sm text-center font-semibold bg-background focus:outline-none focus:ring-2 focus:ring-primary transition-colors ${val ? getScoreColor(val) : "border-border"}`}
                                placeholder="—"
                                value={val}
                                onChange={e => setQuizScores(prev => ({ ...prev, [s.id]: e.target.value }))}
                              />
                            </td>
                            <td className="px-3 py-2 text-center hidden sm:table-cell">
                              {pct !== null ? (
                                <span className={`text-xs font-bold ${pct >= 80 ? "text-emerald-600 dark:text-emerald-400" : pct >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                                  {pct}%
                                </span>
                              ) : <span className="text-muted-foreground text-xs">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> ≥80% отлично</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> 50–79% хорошо</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> &lt;50% слабо</span>
                </div>
                <Button onClick={handleSaveQuiz} disabled={savingQuiz || !quizTitle.trim()} className="w-full" size="sm">
                  <Save className="h-4 w-4 mr-1.5" />
                  {savingQuiz ? "Сохранение..." : "Сохранить тест"}
                </Button>
              </div>
            </div>
          )}

          {/* Bulk attendance buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground font-medium">Быстро:</span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5 border-emerald-500/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              onClick={() => markAll("present")}
            >
              <CheckCheck className="h-3.5 w-3.5" /> Все пришли
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5 border-red-500/50 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
              onClick={() => markAll("absent")}
            >
              <XCircle className="h-3.5 w-3.5" /> Все отсутствуют
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5 border-blue-500/50 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
              onClick={() => setStudents(prev => prev.map(s => ({ ...s, homework: "done" as const })))}
            >
              <BookOpen className="h-3.5 w-3.5" /> ДЗ все сделали
            </Button>
          </div>

          {/* Student table */}
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left p-2 md:p-3 font-semibold text-foreground">{t("#")}</th>
                  <th className="text-left p-2 md:p-3 font-semibold text-foreground">{t("Student")}</th>
                  <th className="text-center p-2 md:p-3 font-semibold text-foreground">{t("Attendance")}</th>
                  <th className="text-center p-2 md:p-3 font-semibold text-foreground hidden md:table-cell">{t("Lateness")}</th>
                  <th className="text-center p-2 md:p-3 font-semibold text-foreground hidden sm:table-cell">{t("Homework")}</th>
                  <th className="text-left p-2 md:p-3 font-semibold text-foreground hidden md:table-cell">{t("Comment")}</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {students.map((student, idx) => (
                  <tr key={student.id} className={`border-t border-border transition-colors ${student.attendance === "absent" ? "bg-red-50/40 dark:bg-red-950/10" : "hover:bg-muted/30"}`}>
                    <td className="p-2 md:p-3 text-muted-foreground">{idx + 1}</td>
                    <td className="p-2 md:p-3 font-medium text-foreground">{student.full_name}</td>
                    <td className="p-2 md:p-3 text-center">
                      <button
                        onClick={() => updateStudentLocal(student.id, { attendance: student.attendance === "present" ? "absent" : "present" })}
                        className="transition-transform hover:scale-110"
                      >
                        {student.attendance === "present" ? (
                          <CheckCircle2 className="h-6 w-6 text-success mx-auto" />
                        ) : (
                          <XCircle className="h-6 w-6 text-destructive mx-auto" />
                        )}
                      </button>
                    </td>
                    <td className="p-2 md:p-3 text-center hidden md:table-cell">
                      <Select value={student.lateness} onValueChange={(v) => updateStudentLocal(student.id, { lateness: v as Student["lateness"] })}>
                        <SelectTrigger className="w-28 mx-auto h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="on_time"><span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {t("On time")}</span></SelectItem>
                          <SelectItem value="5m">{t("5 min late")}</SelectItem>
                          <SelectItem value="15m_plus">{t("15+ min late")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2 md:p-3 text-center hidden sm:table-cell">
                      <div className="flex items-center justify-center gap-1">
                        {(["done", "partial", "not_done"] as const).map((status) => {
                          const Icon = status === "done" ? BookOpen : status === "partial" ? BookMarked : BookX;
                          const isActive = student.homework === status;
                          const title = status === "done" ? t("Done") : status === "partial" ? t("Partial") : t("Not done");
                          return (
                            <button
                              key={status}
                              onClick={() => updateStudentLocal(student.id, { homework: status })}
                              className={`p-1.5 rounded-md transition-all ${isActive ? status === "done" ? "bg-success/15 text-success" : status === "partial" ? "bg-warning/15 text-warning" : "bg-destructive/15 text-destructive" : "text-muted-foreground hover:bg-muted"}`}
                              title={title}
                            >
                              <Icon className="h-4 w-4" />
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="p-2 md:p-3 hidden md:table-cell">
                      <Input value={student.comment} onChange={(e) => updateStudentLocal(student.id, { comment: e.target.value })} placeholder={t("Note...")} className="h-8 text-xs" />
                    </td>
                    <td className="p-2 md:p-3">
                      <button onClick={() => setArchiveTarget(student)} className="text-muted-foreground hover:text-destructive transition-colors" title="Убрать из группы (в архив)">
                        <Archive className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end mt-2">
            <Button onClick={handleSave} disabled={saving} size="lg">
              <Save className="mr-2 h-4 w-4" />
              {saving ? t("Saving...") : t("Save Attendance")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!archiveTarget} onOpenChange={(o) => { if (!o) setArchiveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Убрать ученика из группы?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{archiveTarget?.full_name}</strong> будет переведён в архив и удалён из группы <strong>{lesson.group_name}</strong>. Посещаемость сохранится.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchiveConfirm} disabled={archiving} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {archiving ? "Архивирование..." : "Убрать из группы"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
