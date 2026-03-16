import { useState, useMemo, useEffect, useCallback } from "react";
import { loadLessons, saveLessons } from "@/lib/storage";
import { Lesson } from "@/data/mockSchedule";
import { fetchLessons, fetchTasks, fetchTimeSlots, updateTask, fetchNotes, createNote as createNoteAPI, deleteNoteById, fetchAdhocLessons, createAdhocLesson, deleteAdhocLesson, updateAdhocLessonAttendance, fetchStudents, fetchUsers, fetchSubjects } from "@/lib/api";
import { ClassManagementModal } from "@/components/ClassManagementModal";
import ScheduleConstructor from "@/components/ScheduleConstructor";
import { useAuth } from "@/contexts/AuthContext";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X, Settings2, PanelRightClose, PanelRightOpen, CheckCircle2, Circle, ListTodo, Download, Users as UsersIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { playSuccess } from "@/lib/sounds";
import { toast } from "sonner";
import { format, addDays, startOfWeek, addWeeks, subWeeks, subDays } from "date-fns";
import { useTranslation } from "react-i18next";

const GROUP_COLORS = [
  "border-l-blue-500", "border-l-emerald-500", "border-l-violet-500",
  "border-l-amber-500", "border-l-rose-500", "border-l-cyan-500",
  "border-l-orange-500", "border-l-pink-500", "border-l-teal-500",
  "border-l-indigo-500", "border-l-lime-500", "border-l-red-500",
];
const getGroupColor = (groupId: number) => GROUP_COLORS[(groupId - 1) % GROUP_COLORS.length];

type ViewMode = "day" | "week" | "month" | "report";

interface CalendarNote {
  id: number;
  date: string; // YYYY-MM-DD
  time_slot: string | null;
  title: string;
  description: string | null;
}

export default function CalendarPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewMode, _setViewMode] = useState<ViewMode>(() => {
    try { const v = localStorage.getItem("today_cal_viewMode"); if (v === "day" || v === "week" || v === "month") return v; } catch {} return "day";
  });
  const setViewMode = (v: ViewMode) => { _setViewMode(v); try { localStorage.setItem("today_cal_viewMode", v); } catch {} };
  const [currentDate, setCurrentDate] = useState(new Date());
  const [notes, setNotes] = useState<CalendarNote[]>([]);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  
  const [allLessons, setAllLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [TIME_SLOTS, setTIME_SLOTS] = useState<string[]>([]);
  const [ROOMS, setROOMS] = useState<string[]>([]);
  const [allTimeSlots, setAllTimeSlots] = useState<{ id: number; start_time: string; end_time: string; label: string }[]>([]);
  
  const [newNote, setNewNote] = useState({ title: "", description: "", time_slot: "", date: "" });
  const [showConstructor, setShowConstructor] = useState(false);
  const [showTaskPanel, _setShowTaskPanel] = useState(() => {
    try { const v = localStorage.getItem("today_cal_taskPanel"); if (v !== null) return v === "true"; } catch {} return true;
  });
  const setShowTaskPanel = (v: boolean | ((prev: boolean) => boolean)) => {
    _setShowTaskPanel(prev => { const next = typeof v === "function" ? v(prev) : v; try { localStorage.setItem("today_cal_taskPanel", String(next)); } catch {} return next; });
  };
  const [tasks, setTasks] = useState<any[]>([]);
  const [scheduleViewMode, _setScheduleViewMode] = useState<"teachers" | "groups">(() => {
    try { const v = localStorage.getItem("today_cal_scheduleView"); if (v === "teachers" || v === "groups") return v; } catch {} return "teachers";
  });
  const setScheduleViewMode = (v: "teachers" | "groups") => { _setScheduleViewMode(v); try { localStorage.setItem("today_cal_scheduleView", v); } catch {} };

  // Report filters
  const [reportDateFrom, setReportDateFrom] = useState(() => format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [reportDateTo, setReportDateTo] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [reportTeacherFilter, setReportTeacherFilter] = useState<string>("all");

  // Ad-hoc lessons
  const [adhocLessons, setAdhocLessons] = useState<any[]>([]);
  const [adhocModalOpen, setAdhocModalOpen] = useState(false);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [allSubjects, setAllSubjects] = useState<any[]>([]);
  const [adhocForm, setAdhocForm] = useState({ title: "", teacher_id: "", subject_id: "", room: "", time_slot: "", description: "" });
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [adhocGroupFilter, setAdhocGroupFilter] = useState<string>("all");
  const [adhocAttendanceModal, setAdhocAttendanceModal] = useState<any>(null);

  // Load lessons from API on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // For teachers, fetch only their lessons; for others, fetch all
        const teacherId = user?.role === "teacher" ? user.id : undefined;
        const [data, slots, notesFromDB] = await Promise.all([
          fetchLessons(teacherId),
          fetchTimeSlots(),
          user?.id ? fetchNotes(parseInt(user.id)) : Promise.resolve([]),
        ]);
        // Transform API data to match Lesson interface
        const transformed = data.map((item: any) => ({
          id: `lesson-${item.id}`,
          group_id: item.group_id,
          subject_id: item.subject_id,
          teacher_id: item.teacher_id,
          time_slot: item.start_time,
          room: item.room_name,
          group_name: item.group_name,
          subject: item.subject_name,
          teacher_name: item.teacher_name,
          students: item.students.map((s: any) => ({
            id: `s-${s.id}`,
            full_name: s.full_name,
            attendance: "present",
            lateness: "on_time",
            homework: "done",
            comment: "",
          })),
          cycle: item.cycle,
          dates: item.dates,
        }));
        setAllLessons(transformed);

        const uniqueTimeSlots = [...new Set(transformed.map((l: any) => l.time_slot))].sort();
        const uniqueRooms = [...new Set(transformed.map((l: any) => l.room))];
        setTIME_SLOTS(uniqueTimeSlots);
        setROOMS(uniqueRooms);
        setAllTimeSlots(slots);
        setNotes(notesFromDB);
        setNewNote({ title: "", description: "", time_slot: "", date: "" });

      } catch (error) {
        console.error("Error loading lessons:", error);
        toast.error(t("Failed to load schedule"));
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user, t, toast]);

  // Load tasks
  const loadTasksData = useCallback(async () => {
    try {
      const data = await fetchTasks();
      setTasks(data);
    } catch (e) { console.error("Error loading tasks:", e); }
  }, []);

  useEffect(() => { loadTasksData(); }, [loadTasksData]);

  // Load ad-hoc lessons
  const loadAdhocData = useCallback(async () => {
    try {
      const dateStr = format(currentDate, "yyyy-MM-dd");
      const data = await fetchAdhocLessons(dateStr);
      setAdhocLessons(data);
    } catch (e) { console.error("Error loading adhoc lessons:", e); }
  }, [currentDate]);
  useEffect(() => { loadAdhocData(); }, [loadAdhocData]);

  // Load students/users/subjects for adhoc modal (lazy)
  const openAdhocModal = async () => {
    if (allStudents.length === 0) {
      const [students, users, subjects] = await Promise.all([fetchStudents(), fetchUsers(), fetchSubjects()]);
      setAllStudents(students);
      setAllUsers(users.filter((u: any) => u.role === "teacher" || u.role === "admin"));
      setAllSubjects(subjects);
    }
    setAdhocForm({ title: "", teacher_id: user?.id || "", subject_id: "", room: "", time_slot: "", description: "" });
    setSelectedStudentIds([]);
    setAdhocGroupFilter("all");
    setAdhocModalOpen(true);
  };

  const handleCreateAdhoc = async () => {
    if (!adhocForm.title || !adhocForm.teacher_id || !adhocForm.time_slot || selectedStudentIds.length === 0) {
      toast.error("Заполните название, учителя, время и выберите учеников");
      return;
    }
    await createAdhocLesson({
      ...adhocForm,
      teacher_id: Number(adhocForm.teacher_id),
      subject_id: adhocForm.subject_id ? Number(adhocForm.subject_id) : undefined,
      date: format(currentDate, "yyyy-MM-dd"),
      student_ids: selectedStudentIds,
      created_by: Number(user?.id),
    });
    setAdhocModalOpen(false);
    loadAdhocData();
    toast.success("Сборный урок создан");
  };

  const todayTasks = useMemo(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    return tasks.filter(t => {
      if (t.status === "done") return false;
      if (t.due_date && t.due_date <= todayStr) return true;
      if (!t.due_date) return true;
      return false;
    });
  }, [tasks]);

  const toggleTaskDone = async (taskId: number) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const newStatus = task.status === "done" ? "todo" : "done";
    if (newStatus === "done") playSuccess();
    await updateTask(taskId, { status: newStatus });
    await loadTasksData();
  };

  const lessons = useMemo(() => {
    const currentDateStr = format(currentDate, "yyyy-MM-dd");
    return allLessons.filter((lesson) => lesson.dates && lesson.dates.includes(currentDateStr));
  }, [allLessons, currentDate]);

  const groupedByTime = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const l of lessons) {
      const key = l.time_slot || "—";
      if (!groups[key]) groups[key] = [];
      groups[key].push(l);
    }
    return groups;
  }, [lessons]);
  
  const getLessonForCell = (timeSlot: string, room: string) => {
    return lessons.find((l) => l.time_slot === timeSlot && l.room === room);
  };

  const getLessonForTeacherSlot = (teacherId: number, timeSlotStart: string) =>
    lessons.find((l) => l.teacher_id === teacherId && l.time_slot === timeSlotStart);

  const allTeachers = useMemo(() => {
    const map = new Map<number, string>();
    allLessons.forEach((l) => { if (!map.has(l.teacher_id)) map.set(l.teacher_id, l.teacher_name); });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allLessons]);

  const allGroups = useMemo(() => {
    const map = new Map<number, string>();
    allLessons.forEach((l) => { if (!map.has(l.group_id)) map.set(l.group_id, l.group_name); });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allLessons]);

  const getLessonForGroupSlot = (groupId: number, timeSlotStart: string) =>
    lessons.find((l) => l.group_id === groupId && l.time_slot === timeSlotStart);

  const handleCellClick = (lesson: Lesson) => {
    setSelectedLesson(lesson);
    setModalOpen(true);
  };

  const navigateDate = (direction: number) => {
    if (viewMode === "day") setCurrentDate((d) => addDays(d, direction));
    else if (viewMode === "week") setCurrentDate((d) => direction > 0 ? addWeeks(d, 1) : subWeeks(d, 1));
    else setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + direction, 1));
  };
  
  const goToTomorrow = () => {
    setCurrentDate(addDays(new Date(), 1));
    setViewMode("day");
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setViewMode("day");
  };

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = startOfWeek(firstDay, { weekStartsOn: 1 });
    const days: Date[] = [];
    let d = startDay;
    while (d <= lastDay || days.length % 7 !== 0) {
      days.push(new Date(d));
      d = addDays(d, 1);
    }
    return days;
  }, [currentDate]);

  const getNotesForDate = (date: string) => notes.filter((n) => n.date === date);

  const getLessonsForDate = (date: string) => {
    return allLessons.filter((lesson) => lesson.dates && lesson.dates.includes(date));
  };

  const openAddNote = (date?: Date) => {
    setNewNote({
      title: "",
      description: "",
      time_slot: "",
      date: format(date || currentDate, "yyyy-MM-dd"),
    });
    setNoteModalOpen(true);
  };

  const saveNote = async () => {
    if (!newNote.title.trim() || !user) return;
    const result = await createNoteAPI({ user_id: parseInt(user.id), ...newNote });
    if (result) {
      const notesData = await fetchNotes(parseInt(user.id));
      setNotes(notesData);
      setNoteModalOpen(false);
      toast.success(t("Note added!"));
    }
  };

  const deleteNote = (id: number) => {
    const deleted = notes.find((n) => n.id === id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
    const timer = setTimeout(() => deleteNoteById(id), 5000);
    toast(t("Note removed"), {
      duration: 5000,
      action: { label: t("Undo"), onClick: () => { clearTimeout(timer); if (deleted) setNotes((prev) => [...prev, deleted]); } },
    });
  };

  const dateLabel = useMemo(() => {
    if (viewMode === "day") return format(currentDate, "EEEE, MMMM d, yyyy");
    if (viewMode === "week") return `${format(weekDays[0], "MMM d")} — ${format(weekDays[6], "MMM d, yyyy")}`;
    return format(currentDate, "MMMM yyyy");
  }, [viewMode, currentDate, weekDays]);

  const exportSchedulePDF = () => {
    const cols = scheduleViewMode === "teachers" ? allTeachers : allGroups;
    const colLabel = scheduleViewMode === "teachers" ? "Преподаватель" : "Группа";

    const pdfStyles = `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Times New Roman', 'Georgia', serif; padding: 20mm 15mm; color: #000; background: #fff; font-size: 11pt; }
      .header { margin-bottom: 20px; padding-bottom: 12px; border-bottom: 3px double #000; text-align: center; }
      .org-name { font-size: 14pt; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px; }
      .doc-title { font-size: 16pt; font-weight: bold; text-transform: uppercase; margin: 8px 0; letter-spacing: 1px; }
      .header-meta { font-size: 10pt; color: #333; margin-top: 4px; }
      .header-meta span { font-weight: bold; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th, td { padding: 6px 8px; text-align: center; font-size: 9pt; border: 1px solid #000; }
      th { background: #f0f0f0; font-weight: bold; text-transform: uppercase; font-size: 8pt; letter-spacing: 0.5px; }
      td.time { font-weight: bold; white-space: nowrap; width: 80px; background: #f5f5f5; font-size: 9pt; }
      .subject { font-weight: bold; font-size: 9pt; }
      .group { font-size: 8pt; color: #333; margin-top: 1px; }
      .teacher { font-size: 8pt; color: #555; margin-top: 1px; }
      .empty { color: #999; }
      .footer { margin-top: 24px; font-size: 9pt; color: #333; border-top: 1px solid #000; padding-top: 10px; display: flex; justify-content: space-between; }
      .footer-left { text-align: left; }
      .footer-right { text-align: right; }
      .signature-line { margin-top: 30px; display: flex; justify-content: space-between; font-size: 9pt; }
      .signature-block { width: 200px; text-align: center; }
      .signature-block .line { border-top: 1px solid #000; margin-top: 30px; padding-top: 4px; font-size: 8pt; color: #555; }
      .day-header { font-size: 12pt; font-weight: bold; margin: 18px 0 6px; padding: 6px 12px; background: #f0f0f0; border: 1px solid #000; text-transform: uppercase; letter-spacing: 0.5px; }
      .day-header:first-of-type { margin-top: 6px; }
      @media print {
        body { padding: 10mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @page { size: landscape; margin: 10mm; }
        .day-header { break-before: auto; }
      }
    `;

    const headerHtml = (titleDate: string, modeLabel: string) => `
      <div class="header">
        <div class="org-name">Образовательный центр «TODAY»</div>
        <div class="doc-title">Расписание занятий</div>
        <div class="header-meta"><span>Дата:</span> ${titleDate} &nbsp;&nbsp;|&nbsp;&nbsp; <span>Вид:</span> ${modeLabel}</div>
      </div>`;

    const buildDayTable = (dateStr: string, dateLessons: any[]) => {
      const getLessonForCol = (colId: number, slotStart: string) => {
        return dateLessons.find((l: any) =>
          scheduleViewMode === "teachers"
            ? l.teacher_id === colId && l.time_slot === slotStart
            : l.group_id === colId && l.time_slot === slotStart
        );
      };

      const rows = allTimeSlots.map(slot => {
        const cells = cols.map(c => {
          const lesson = getLessonForCol(c.id, slot.start_time);
          if (!lesson) return '<td class="empty">—</td>';
          const info = scheduleViewMode === "teachers"
            ? `<div class="subject">${lesson.group_name}</div><div class="group">${lesson.subject}</div>`
            : `<div class="subject">${lesson.subject}</div><div class="teacher">${lesson.teacher_name}</div>`;
          return `<td>${info}</td>`;
        }).join('');
        return `<tr><td class="time">${slot.start_time}${slot.end_time ? '<br>' + slot.end_time : ''}</td>${cells}</tr>`;
      }).join('');

      return `<table><thead><tr><th>Время</th>${cols.map(c => `<th>${c.name}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
    };

    let bodyContent = '';

    if (viewMode === "day") {
      const dateStr = format(currentDate, "dd.MM.yyyy");
      bodyContent = headerHtml(dateStr, colLabel) + buildDayTable(format(currentDate, "yyyy-MM-dd"), lessons);
    } else if (viewMode === "week") {
      const weekStart = format(weekDays[0], "dd.MM.yyyy");
      const weekEnd = format(weekDays[6], "dd.MM.yyyy");
      bodyContent = headerHtml(`${weekStart} — ${weekEnd}`, colLabel);
      const DAY_NAMES_RU = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
      weekDays.forEach((day, i) => {
        const ds = format(day, "yyyy-MM-dd");
        const dayLessons = allLessons.filter((l: any) => l.dates && l.dates.includes(ds));
        if (dayLessons.length === 0) return;
        bodyContent += `<div class="day-header">${DAY_NAMES_RU[i]} — ${format(day, "dd.MM.yyyy")}</div>`;
        bodyContent += buildDayTable(ds, dayLessons);
      });
    } else {
      // month - export current week as fallback
      const dateStr = format(currentDate, "MMMM yyyy");
      bodyContent = headerHtml(dateStr, colLabel);
      const DAY_NAMES_RU = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      Array.from({ length: 7 }, (_, i) => addDays(start, i)).forEach((day, i) => {
        const ds = format(day, "yyyy-MM-dd");
        const dayLessons = allLessons.filter((l: any) => l.dates && l.dates.includes(ds));
        if (dayLessons.length === 0) return;
        bodyContent += `<div class="day-header">${DAY_NAMES_RU[i]} — ${format(day, "dd.MM.yyyy")}</div>`;
        bodyContent += buildDayTable(ds, dayLessons);
      });
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Расписание TODAY</title><style>${pdfStyles}</style></head><body>
      ${bodyContent}
      <div class="footer">
        <div class="footer-left">Образовательный центр «TODAY»</div>
        <div class="footer-right">Сформировано: ${new Date().toLocaleString('ru-RU')}</div>
      </div>
      <div class="signature-line">
        <div class="signature-block"><div class="line">Подпись ответственного</div></div>
        <div class="signature-block"><div class="line">Дата утверждения</div></div>
      </div>
    </body></html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
  };

  if (loading) {
    return (
      <div className="flex gap-0">
        <div className="flex-1 min-w-0 space-y-4">
          <div className="h-16 bg-muted/50 rounded-xl animate-pulse" />
          <div className="h-10 w-64 bg-muted/50 rounded-lg animate-pulse" />
          <div className="h-[400px] bg-muted/30 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-0">
      {/* Main calendar area */}
      <div className={`flex-1 min-w-0 transition-all duration-300 ${showTaskPanel ? 'pr-0' : ''}`}>
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-border pb-3 md:pb-4 mb-4 md:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <CalendarIcon className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg md:text-2xl font-heading font-bold text-foreground">{t("Live Calendar")}</h1>
              <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">{t("Click any class to manage attendance")}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="h-7 md:h-8 text-xs" onClick={goToToday}>{t("Today")}</Button>
            <Button variant="outline" size="sm" className="h-7 md:h-8 text-xs" onClick={goToTomorrow}>{t("Tomorrow")}</Button>
            {user?.role === "admin" && (
              <Button variant={showConstructor ? "default" : "outline"} size="sm" className="h-7 md:h-8 text-xs" onClick={() => setShowConstructor(!showConstructor)}>
                <Settings2 className="h-4 w-4 md:mr-1" /> <span className="hidden md:inline">{t("Schedule Constructor")}</span>
              </Button>
            )}
            {user?.role === "admin" && viewMode === "day" && !showConstructor && (
              <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
                <button
                  onClick={() => setScheduleViewMode("teachers")}
                  className={`px-2 py-1 text-[11px] md:text-xs rounded-md font-medium transition-all ${
                    scheduleViewMode === "teachers" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >{t("По учителям")}</button>
                <button
                  onClick={() => setScheduleViewMode("groups")}
                  className={`px-2 py-1 text-[11px] md:text-xs rounded-md font-medium transition-all ${
                    scheduleViewMode === "groups" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >{t("По группам")}</button>
              </div>
            )}
            <Button variant="outline" size="sm" className="h-7 md:h-8 text-xs" onClick={exportSchedulePDF}>
              <Download className="h-4 w-4 md:mr-1" /> <span className="hidden md:inline">Скачать PDF</span>
            </Button>
            <Button size="sm" className="h-7 md:h-8 text-xs" onClick={() => openAddNote()}>
              <Plus className="h-4 w-4 md:mr-1" /> <span className="hidden sm:inline">{t("Add Note")}</span>
            </Button>
            <Button variant="outline" size="sm" className="h-7 md:h-8 text-xs" onClick={openAdhocModal}>
              <UsersIcon className="h-4 w-4 md:mr-1" /> <span className="hidden md:inline">Сборный урок</span>
            </Button>
            {user?.role === "admin" && (
              <Button variant={viewMode === "report" ? "default" : "outline"} size="sm" className="h-7 md:h-8 text-xs" onClick={() => setViewMode("report")}>
                <ListTodo className="h-4 w-4 md:mr-1" /> <span className="hidden md:inline">Отчет учителей</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      <>

      {/* Schedule Constructor for admin */}
      {showConstructor && user?.role === "admin" ? (
        <ScheduleConstructor onClose={() => { setShowConstructor(false); /* reload lessons */ window.location.reload(); }} />
      ) : (
      <>

      {/* View controls + navigation */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {(["day", "week", "month"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 text-sm rounded-md font-medium transition-all capitalize ${
                viewMode === mode ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(mode)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigateDate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-foreground min-w-[200px] text-center">{dateLabel}</span>
          <Button variant="ghost" size="icon" onClick={() => navigateDate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Day View — grid */}
      {viewMode === "day" && (
        <>
          {/* Notes for today */}
          {getNotesForDate(format(currentDate, "yyyy-MM-dd")).length > 0 && (
            <div className="mb-4 space-y-2">
              {getNotesForDate(format(currentDate, "yyyy-MM-dd")).map((note) => (
                <div key={note.id} className="flex items-center gap-3 p-3 rounded-lg bg-accent/10 border border-accent/20">
                  <Badge variant="secondary" className="text-xs">{note.time_slot}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{note.title}</p>
                    {note.description && <p className="text-xs text-muted-foreground truncate">{note.description}</p>}
                  </div>
                  <button onClick={() => deleteNote(note.id)} className="text-muted-foreground hover:text-destructive">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {/* Ad-hoc lessons for today */}
          {adhocLessons.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Сборные уроки</p>
              {adhocLessons.map((al) => (
                <div key={al.id} className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20 cursor-pointer hover:bg-primary/10 transition-colors"
                  onClick={() => setAdhocAttendanceModal(al)}>
                  <Badge variant="outline" className="text-xs shrink-0">{al.time_slot}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{al.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {al.teacher_name} {al.teacher_surname} · {al.students?.length || 0} уч.
                      {al.subject_name && ` · ${al.subject_name}`}
                    </p>
                  </div>
                  <UsersIcon className="h-4 w-4 text-primary shrink-0" />
                </div>
              ))}
            </div>
          )}
          {user?.role === "admin" ? (
            /* Admin view: switchable between teachers and groups */
            <div className="rounded-xl border border-border bg-card overflow-auto shadow-sm">
              {scheduleViewMode === "teachers" ? (
              <table className="w-full border-collapse" style={{ minWidth: `${allTeachers.length * 160 + 140}px` }}>
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-muted p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-r border-border w-36">
                      {t("Time")}
                    </th>
                    {allTeachers.map((teacher) => (
                      <th key={teacher.id} className="bg-muted p-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-r border-border min-w-[160px]">
                        {teacher.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allTimeSlots.map((slot) => (
                    <tr key={slot.id}>
                      <td className="sticky left-0 z-10 bg-card p-3 text-sm font-medium text-foreground border-b border-r border-border whitespace-nowrap">
                        <span>{slot.start_time}</span>
                        {slot.end_time && <span className="block text-[11px] text-muted-foreground">{slot.end_time}</span>}
                      </td>
                      {allTeachers.map((teacher) => {
                        const lesson = getLessonForTeacherSlot(teacher.id, slot.start_time);
                        return (
                          <td key={teacher.id} className="p-1.5 border-b border-r border-border">
                            {lesson ? (
                              <button
                                onClick={() => handleCellClick(lesson)}
                                className={`w-full text-left p-2.5 rounded-lg bg-primary/8 hover:bg-primary/15 border border-l-4 ${getGroupColor(lesson.group_id)} border-primary/20 transition-all hover:shadow-md cursor-pointer`}
                              >
                                <p className="text-xs font-semibold text-primary truncate">{lesson.group_name}</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{lesson.subject}</p>
                              </button>
                            ) : (
                              <div className="h-16" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              ) : (
              /* Groups view */
              <table className="w-full border-collapse" style={{ minWidth: `${allGroups.length * 160 + 140}px` }}>
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-muted p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-r border-border w-36">
                      {t("Time")}
                    </th>
                    {allGroups.map((group) => (
                      <th key={group.id} className="bg-muted p-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-r border-border min-w-[160px]">
                        {group.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allTimeSlots.map((slot) => (
                    <tr key={slot.id}>
                      <td className="sticky left-0 z-10 bg-card p-3 text-sm font-medium text-foreground border-b border-r border-border whitespace-nowrap">
                        <span>{slot.start_time}</span>
                        {slot.end_time && <span className="block text-[11px] text-muted-foreground">{slot.end_time}</span>}
                      </td>
                      {allGroups.map((group) => {
                        const lesson = getLessonForGroupSlot(group.id, slot.start_time);
                        return (
                          <td key={group.id} className="p-1.5 border-b border-r border-border">
                            {lesson ? (
                              <button
                                onClick={() => handleCellClick(lesson)}
                                className={`w-full text-left p-2.5 rounded-lg bg-primary/8 hover:bg-primary/15 border border-l-4 ${getGroupColor(lesson.group_id)} border-primary/20 transition-all hover:shadow-md cursor-pointer`}
                              >
                                <p className="text-xs font-semibold text-primary truncate">{lesson.subject}</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{lesson.teacher_name}</p>
                                <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">{lesson.room}</p>
                              </button>
                            ) : (
                              <div className="h-16" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
            </div>
          ) : (
            /* Teacher / umo_head view: rooms grid */
            <div className="rounded-xl border border-border bg-card overflow-auto shadow-sm">
              <table className="w-full border-collapse min-w-[900px]">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-muted p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-r border-border w-36">
                      {t("Time")}
                    </th>
                    {ROOMS.map((room) => (
                      <th key={room} className="bg-muted p-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-r border-border min-w-[150px]">
                        {room}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TIME_SLOTS.map((slot) => (
                    <tr key={slot}>
                      <td className="sticky left-0 z-10 bg-card p-3 text-sm font-medium text-foreground border-b border-r border-border whitespace-nowrap">
                        {slot}
                      </td>
                      {ROOMS.map((room) => {
                        const lesson = getLessonForCell(slot, room);
                        return (
                          <td key={room} className="p-1.5 border-b border-r border-border">
                            {lesson ? (
                              <button
                                onClick={() => handleCellClick(lesson)}
                                className={`w-full text-left p-2.5 rounded-lg bg-primary/8 hover:bg-primary/15 border border-l-4 ${getGroupColor(lesson.group_id)} border-primary/20 transition-all hover:shadow-md cursor-pointer`}
                              >
                                <p className="text-xs font-semibold text-primary truncate">{lesson.group_name}</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{lesson.subject}</p>
                                <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">{lesson.teacher_name}</p>
                              </button>
                            ) : (
                              <div className="h-16" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Week View */}
      {viewMode === "week" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const isToday = format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
            const dayNotes = getNotesForDate(dateStr);
            const dayLessons = getLessonsForDate(dateStr);

            return (
              <div
                key={dateStr}
                className={`rounded-xl border p-3 min-h-[200px] ${
                  isToday ? "border-primary bg-primary/5" : "border-border bg-card"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-semibold ${isToday ? "text-primary" : "text-foreground"}`}>
                    {format(day, "EEE d")}
                  </span>
                  <button onClick={() => openAddNote(day)} className="text-muted-foreground hover:text-primary">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="space-y-1">
                  {dayNotes.map((note) => (
                    <div key={note.id} className="p-1.5 rounded bg-accent/15 border border-accent/20 text-[11px] group/note relative">
                      <p className="font-medium text-accent truncate">{note.time_slot ? `${note.time_slot} ` : ""}{note.title}</p>
                      <button onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}
                        className="absolute top-0.5 right-0.5 opacity-0 group-hover/note:opacity-100 text-muted-foreground hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {dayLessons.slice(0, 3).map((lesson) => (
                    <button
                      key={lesson.id + dateStr}
                      onClick={() => handleCellClick(lesson)}
                      className={`w-full text-left p-1.5 rounded border border-l-4 ${getGroupColor(lesson.group_id)} border-primary/15 bg-primary/8 text-[11px] hover:bg-primary/15 transition-colors`}
                    >
                      <p className="font-medium text-primary truncate">{lesson.group_name}</p>
                      <p className="text-muted-foreground truncate">{lesson.subject}</p>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Month View */}
      {viewMode === "month" && (
        <div>
          <div className="grid grid-cols-7 gap-0 border border-border rounded-xl overflow-hidden overflow-x-auto bg-card">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="p-1.5 md:p-2 text-center text-[10px] md:text-xs font-semibold text-muted-foreground bg-muted border-b border-border min-w-[44px]">
                {t(d)}
              </div>
            ))}
            {monthDays.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const isCurrentMonth = day.getMonth() === currentDate.getMonth();
              const isToday = dateStr === format(new Date(), "yyyy-MM-dd");
              const dayNotes = getNotesForDate(dateStr);
              const dayLessons = getLessonsForDate(dateStr);

              return (
                <div
                  key={dateStr}
                  className={`min-h-[60px] md:min-h-[90px] p-1 md:p-2 border-b border-r border-border ${
                    isCurrentMonth ? "" : "opacity-40"
                  } ${isToday ? "bg-primary/5" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium ${isToday ? "text-primary font-bold" : "text-foreground"}`}>
                      {format(day, "d")}
                    </span>
                    {isCurrentMonth && (
                      <button onClick={() => openAddNote(day)} className="text-muted-foreground hover:text-primary opacity-0 hover:opacity-100 transition-opacity">
                        <Plus className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  {dayLessons.slice(0, 2).map((lesson) => (
                    <button
                      key={lesson.id + dateStr}
                      onClick={() => handleCellClick(lesson)}
                      className={`mt-1 w-full text-left p-1 rounded border-l-2 ${getGroupColor(lesson.group_id).replace('border-l-', 'border-l-')} bg-primary/5 text-[10px] truncate hover:bg-primary/10 transition-colors`}
                    >
                      <span className="font-medium text-primary">{lesson.group_name}</span>
                      <span className="text-muted-foreground ml-1">{lesson.subject}</span>
                    </button>
                  ))}
                  {dayLessons.length > 2 && (
                    <p className="text-[9px] text-muted-foreground mt-0.5 pl-1">+{dayLessons.length - 2} ещё</p>
                  )}
                  {dayNotes.map((note) => (
                    <div key={note.id} className="mt-1 p-1 rounded bg-accent/15 text-[10px] font-medium text-accent truncate group/mnote relative">
                      {note.time_slot ? `${note.time_slot} ` : ""}{note.title}
                      <button onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}
                        className="absolute top-0 right-0.5 opacity-0 group-hover/mnote:opacity-100 text-muted-foreground hover:text-destructive">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Teacher Report View */}
      {viewMode === "report" && user?.role === "admin" && (
        <div className="space-y-4">
          {/* Report filters */}
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>От даты</Label>
                  <Input type="date" value={reportDateFrom} onChange={(e) => setReportDateFrom(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>До даты</Label>
                  <Input type="date" value={reportDateTo} onChange={(e) => setReportDateTo(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Учитель</Label>
                  <Select value={reportTeacherFilter} onValueChange={setReportTeacherFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все учителя</SelectItem>
                      {allTeachers.map(t => (
                        <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Report table */}
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-semibold">Учитель</th>
                      <th className="px-4 py-3 text-left font-semibold">Дата</th>
                      <th className="px-4 py-3 text-left font-semibold">Уроки</th>
                      <th className="px-4 py-3 text-left font-semibold">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allLessons
                      .filter((lesson) => {
                        const lessonDate = lesson.dates?.[0];
                        if (!lessonDate) return false;
                        const fromOk = lessonDate >= reportDateFrom;
                        const toOk = lessonDate <= reportDateTo;
                        const teacherOk = reportTeacherFilter === "all" || lesson.teacher_id === parseInt(reportTeacherFilter);
                        return fromOk && toOk && teacherOk;
                      })
                      .reduce((acc: any[], lesson) => {
                        const date = lesson.dates?.[0];
                        const key = `${lesson.teacher_id}-${date}`;
                        const existing = acc.find(r => r.key === key);
                        if (!existing) {
                          acc.push({
                            key,
                            teacher_id: lesson.teacher_id,
                            teacher_name: lesson.teacher_name,
                            date: date,
                            lessons: [lesson],
                          });
                        } else {
                          existing.lessons.push(lesson);
                        }
                        return acc;
                      }, [])
                      .map((row: any, idx) => (
                        <tr key={row.key} className={`border-b ${idx % 2 ? "bg-muted/20" : ""}`}>
                          <td className="px-4 py-3 font-medium">{row.teacher_name}</td>
                          <td className="px-4 py-3">{format(new Date(row.date), "dd.MM.yyyy")}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {row.lessons.map((l: any) => (
                                <Badge key={l.id} variant="outline" className="text-xs">
                                  {l.time_slot} - {l.group_name}
                                </Badge>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/40 dark:text-green-300">
                              Заполнено
                            </Badge>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Note Modal */}
      <Dialog open={noteModalOpen} onOpenChange={setNoteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">{t("Add Calendar Note")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("Title")}</Label>
              <Input
                value={newNote.title}
                onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                placeholder="e.g. Буду делать материалы"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("Date")}</Label>
              <Input
                type="date"
                value={newNote.date}
                onChange={(e) => setNewNote({ ...newNote, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("Time")}</Label>
              <Input
                type="time"
                value={newNote.time_slot}
                onChange={(e) => setNewNote({ ...newNote, time_slot: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("Description (optional)")}</Label>
              <Textarea
                value={newNote.description}
                onChange={(e) => setNewNote({ ...newNote, description: e.target.value })}
                placeholder="Details..."
                rows={3}
              />
            </div>
            <Button onClick={saveNote} className="w-full">{t("Save Note")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ClassManagementModal lesson={selectedLesson} open={modalOpen} onOpenChange={setModalOpen} date={format(currentDate, "yyyy-MM-dd")} />

      {/* Ad-hoc lesson creation modal */}
      <Dialog open={adhocModalOpen} onOpenChange={setAdhocModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <UsersIcon className="h-5 w-5" /> Сборный урок
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Название</Label>
                <Input value={adhocForm.title} onChange={e => setAdhocForm({...adhocForm, title: e.target.value})} placeholder="Общий урок по математике" />
              </div>
              <div className="space-y-1.5">
                <Label>Время</Label>
                <Input type="time" value={adhocForm.time_slot} onChange={e => setAdhocForm({...adhocForm, time_slot: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <Label>Учитель</Label>
                <Select value={adhocForm.teacher_id} onValueChange={v => setAdhocForm({...adhocForm, teacher_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                  <SelectContent>
                    {allUsers.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name} {u.surname}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Предмет (опционально)</Label>
                <Select value={adhocForm.subject_id} onValueChange={v => setAdhocForm({...adhocForm, subject_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                  <SelectContent>
                    {allSubjects.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Кабинет (опционально)</Label>
                <Input value={adhocForm.room} onChange={e => setAdhocForm({...adhocForm, room: e.target.value})} placeholder="Каб. 101" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Описание (опционально)</Label>
              <Textarea value={adhocForm.description} onChange={e => setAdhocForm({...adhocForm, description: e.target.value})} rows={2} />
            </div>

            {/* Student selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Ученики ({selectedStudentIds.length} выбрано)</Label>
                <Select value={adhocGroupFilter} onValueChange={setAdhocGroupFilter}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все группы</SelectItem>
                    {[...new Set(allStudents.filter(s => s.group_name).map(s => s.group_name))].sort().map(gn =>
                      <SelectItem key={gn} value={gn}>{gn}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="border rounded-lg max-h-48 overflow-y-auto p-2 space-y-1">
                {allStudents
                  .filter(s => s.status === "active" && (adhocGroupFilter === "all" || s.group_name === adhocGroupFilter))
                  .map(s => (
                    <label key={s.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer">
                      <Checkbox
                        checked={selectedStudentIds.includes(s.id)}
                        onCheckedChange={(checked) => {
                          setSelectedStudentIds(prev => checked ? [...prev, s.id] : prev.filter(id => id !== s.id));
                        }}
                      />
                      <span className="text-sm flex-1">{s.full_name}</span>
                      <span className="text-xs text-muted-foreground">{s.group_name || "—"}</span>
                    </label>
                  ))}
              </div>
            </div>
            <Button onClick={handleCreateAdhoc} className="w-full" disabled={!adhocForm.title || !adhocForm.time_slot || selectedStudentIds.length === 0}>
              Создать сборный урок
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ad-hoc attendance modal */}
      <Dialog open={!!adhocAttendanceModal} onOpenChange={(v) => { if (!v) setAdhocAttendanceModal(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">{adhocAttendanceModal?.title}</DialogTitle>
          </DialogHeader>
          {adhocAttendanceModal && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {adhocAttendanceModal.time_slot} · {adhocAttendanceModal.teacher_name} {adhocAttendanceModal.teacher_surname}
                {adhocAttendanceModal.subject_name && ` · ${adhocAttendanceModal.subject_name}`}
              </p>
              <div className="space-y-1">
                {(adhocAttendanceModal.students || []).map((s: any) => (
                  <div key={s.student_id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">{s.full_name}</p>
                      <p className="text-xs text-muted-foreground">{s.group_name || "—"}</p>
                    </div>
                    <Select
                      value={s.status || "present"}
                      onValueChange={(val) => {
                        setAdhocAttendanceModal((prev: any) => ({
                          ...prev,
                          students: prev.students.map((st: any) =>
                            st.student_id === s.student_id ? { ...st, status: val } : st
                          ),
                        }));
                      }}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="present">Присутствует</SelectItem>
                        <SelectItem value="absent">Отсутствует</SelectItem>
                        <SelectItem value="late">Опоздал</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <Button className="w-full" onClick={async () => {
                await updateAdhocLessonAttendance(
                  adhocAttendanceModal.id,
                  adhocAttendanceModal.students.map((s: any) => ({
                    student_id: s.student_id,
                    status: s.status || "present",
                    lateness: s.lateness || "on_time",
                    homework: s.homework || "done",
                  }))
                );
                toast.success("Посещаемость сохранена");
                setAdhocAttendanceModal(null);
                loadAdhocData();
              }}>
                Сохранить посещаемость
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </>
      )}
      </>
      </div>

      {/* Task Panel Toggle Button (always visible) */}
      <button
        onClick={() => setShowTaskPanel(!showTaskPanel)}
        className="sticky top-20 self-start z-30 items-center justify-center w-6 h-12 my-auto mt-20 bg-muted hover:bg-muted/80 border border-border rounded-l-md transition-colors hidden md:flex"
        title={showTaskPanel ? t("Hide tasks") : t("Show tasks")}
      >
        {showTaskPanel ? <PanelRightClose className="h-3.5 w-3.5 text-muted-foreground" /> : <PanelRightOpen className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {/* Tasks Sidebar */}
      <div className={`sticky top-0 self-start h-[calc(100vh-2rem)] transition-all duration-300 overflow-hidden hidden md:block ${
        showTaskPanel ? 'w-72 opacity-100' : 'w-0 opacity-0'
      }`}>
        <div className="w-72 h-full flex flex-col border-l border-border bg-card/50 rounded-xl ml-1">
          {/* Panel Header */}
          <div className="flex items-center gap-2 p-3 border-b border-border">
            <ListTodo className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground flex-1">{t("Tasks for Today")}</h3>
            <Badge variant="secondary" className="text-[10px] px-1.5">{todayTasks.length}</Badge>
          </div>

          {/* Task List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {todayTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-xs">{t("No tasks for today")}</p>
              </div>
            ) : (
              todayTasks.map(task => (
                <div
                  key={task.id}
                  className={`flex items-start gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors group ${
                    task.status === 'done' ? 'opacity-50' : ''
                  }`}
                >
                  <Checkbox
                    checked={task.status === 'done'}
                    onCheckedChange={() => toggleTaskDone(task.id)}
                    className="mt-0.5 h-4 w-4"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium leading-tight ${
                      task.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'
                    }`}>{task.title}</p>
                    {task.description && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{task.description}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-1">
                      {task.priority && (
                        <span className={`text-[9px] px-1 py-0.5 rounded font-medium ${
                          task.priority === 'high' ? 'bg-destructive/10 text-destructive' :
                          task.priority === 'medium' ? 'bg-amber-500/10 text-amber-600' :
                          'bg-muted text-muted-foreground'
                        }`}>{task.priority}</span>
                      )}
                      {task.due_date && (
                        <span className="text-[9px] text-muted-foreground">{task.due_date}</span>
                      )}
                      {task.assignee_name && (
                        <span className="text-[9px] text-muted-foreground truncate">{task.assignee_name}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
