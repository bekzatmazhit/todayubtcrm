import { Users, Filter, TrendingUp, Calendar, BookOpen, Search, Phone, GraduationCap, UserCheck, ArrowUpDown, Download, MessageSquare, Pencil, Save, X, ImagePlus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect, useMemo, useRef } from "react";
import { fetchStudents, fetchGroups, fetchStudent, updateStudent, fetchTeacherFeedbackByStudent, fetchParentFeedback, fetchLessonCommentsByStudent, uploadStudentAvatar, deleteStudentAvatar } from "@/lib/api";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/contexts/AuthContext";
import { formatPhone } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface Group {
  id: number;
  name: string;
  curator_id?: number;
}

interface Student {
  id: number;
  full_name: string;
  phone?: string;
  parent_phone?: string;
  parent_name?: string;
  group_id?: number;
  group_name?: string;
  attendance_rate?: number | null;
  last_ent_score?: number | null;
  status?: string;
}

interface EntResult {
  score: number;
  month: string;
  subject_name: string;
}

interface StudentDetails extends Student {
  attendance_stats?: {
    total_lessons: number;
    present_count: number;
    absent_count: number;
    late_count: number;
    attendance_rate: number;
  };
  recent_attendance?: Array<{
    status: string;
    lateness: string;
    homework: string;
    comment?: string;
    date: string;
    subject_name: string;
  }>;
  ent_results?: EntResult[];
}

type SortKey = "full_name" | "group_name" | "attendance_rate" | "last_ent_score";

type CommentFilter = "all" | "month";

export default function StudentsPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<StudentDetails | null>(null);
  const [studentDetailsLoading, setStudentDetailsLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("full_name");
  const [sortAsc, setSortAsc] = useState(true);
  const [teacherFeedback, setTeacherFeedback] = useState<any[]>([]);
  const [parentFeedback, setParentFeedback] = useState<any[]>([]);
  const [lessonComments, setLessonComments] = useState<any[]>([]);
  const [feedbackMonth, setFeedbackMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [commentFilter, setCommentFilter] = useState<CommentFilter>("all");
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ full_name: "", phone: "", parent_phone: "", parent_name: "" });
  const [saving, setSaving] = useState(false);

  const lastTeacherFeedbackKeyRef = useRef<string>("");
  const lastLessonCommentsKeyRef = useRef<string>("");

  const getMonthRange = (month: string) => {
    const [yStr, mStr] = month.split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    if (!y || !m) return null;
    const from = `${month}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const to = `${month}-${String(lastDay).padStart(2, "0")}`;
    return { from, to };
  };

  const curatorGroupIds = useMemo(() => {
    if (!user) return new Set<number>();
    if (user.role === "admin" || user.role === "umo_head") return null; // null = can edit all
    return new Set(groups.filter(g => g.curator_id === parseInt(user.id)).map(g => g.id));
  }, [groups, user]);

  const canEditStudent = (student: Student | StudentDetails) => {
    if (!user) return false;
    if (curatorGroupIds === null) return true; // admin/umo_head
    return !!student.group_id && curatorGroupIds.has(student.group_id);
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const [studentsData, groupsData] = await Promise.all([
          fetchStudents(),
          fetchGroups()
        ]);
        setStudents(studentsData);
        setGroups(groupsData);
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

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
    const withAttendance = students.filter(s => s.attendance_rate !== null && s.attendance_rate !== undefined);
    const avgAttendance = withAttendance.length > 0
      ? Math.round(withAttendance.reduce((sum, s) => sum + (s.attendance_rate || 0), 0) / withAttendance.length)
      : 0;
    const withEnt = students.filter(s => s.last_ent_score && s.last_ent_score > 0);
    const avgEnt = withEnt.length > 0
      ? Math.round(withEnt.reduce((sum, s) => sum + (s.last_ent_score || 0), 0) / withEnt.length)
      : 0;
    const groupCounts = groups.map(g => ({
      ...g,
      count: students.filter(s => s.group_id === g.id).length
    }));
    return { total, avgAttendance, avgEnt, withEnt: withEnt.length, groupCounts };
  }, [students, groups]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const handleStudentClick = async (student: Student) => {
    setModalOpen(true);
    setStudentDetailsLoading(true);
    setTeacherFeedback([]);
    setParentFeedback([]);
    setLessonComments([]);
    try {
      const range = getMonthRange(feedbackMonth);
      const [details, tf, pf] = await Promise.all([
        fetchStudent(student.id.toString()),
        fetchTeacherFeedbackByStudent(student.id, feedbackMonth),
        fetchParentFeedback({ student_id: student.id }),
      ]);
      setSelectedStudent(details);
      setTeacherFeedback(tf || []);
      setParentFeedback(pf || []);

      lastTeacherFeedbackKeyRef.current = `${student.id}:${feedbackMonth}`;

      if (commentFilter === "all") {
        lastLessonCommentsKeyRef.current = `${student.id}:all`;
        const lc = await fetchLessonCommentsByStudent({ studentId: student.id, limit: 200 });
        setLessonComments(lc || []);
      } else if (range) {
        lastLessonCommentsKeyRef.current = `${student.id}:month:${feedbackMonth}`;
        const lc = await fetchLessonCommentsByStudent({ studentId: student.id, from: range.from, to: range.to, limit: 200 });
        setLessonComments(lc || []);
      }
    } catch (error) {
      console.error("Error loading student details:", error);
      setSelectedStudent(student);
    } finally {
      setStudentDetailsLoading(false);
    }
  };

  const startEditing = () => {
    if (!selectedStudent) return;
    setEditForm({
      full_name: selectedStudent.full_name || "",
      phone: selectedStudent.phone ? formatPhone(selectedStudent.phone) : "",
      parent_phone: selectedStudent.parent_phone ? formatPhone(selectedStudent.parent_phone) : "",
      parent_name: selectedStudent.parent_name || "",
    });
    setEditMode(true);
  };

  const cancelEditing = () => {
    setEditMode(false);
  };

  const handleSaveStudent = async () => {
    if (!selectedStudent) return;
    setSaving(true);
    try {
      await updateStudent(selectedStudent.id, editForm);
      const updated = await fetchStudent(selectedStudent.id.toString());
      setSelectedStudent(updated);
      setStudents(prev => prev.map(s => s.id === selectedStudent.id ? { ...s, full_name: editForm.full_name, phone: editForm.phone, parent_phone: editForm.parent_phone, parent_name: editForm.parent_name } : s));
      setEditMode(false);
    } catch (error) {
      console.error("Error saving student:", error);
    } finally {
      setSaving(false);
    }
  };

  const rateColor = (rate: number | null | undefined) => {
    if (rate === null || rate === undefined) return "text-muted-foreground";
    if (rate >= 90) return "text-green-600";
    if (rate >= 70) return "text-amber-600";
    return "text-red-600";
  };

  const rateBg = (rate: number | null | undefined) => {
    if (rate === null || rate === undefined) return "bg-muted";
    if (rate >= 90) return "bg-green-500/10";
    if (rate >= 70) return "bg-amber-500/10";
    return "bg-red-500/10";
  };

  // Reload teacher feedback when month changes
  useEffect(() => {
    if (!selectedStudent || !modalOpen) return;
    const key = `${selectedStudent.id}:${feedbackMonth}`;
    if (lastTeacherFeedbackKeyRef.current === key) return;
    lastTeacherFeedbackKeyRef.current = key;
    fetchTeacherFeedbackByStudent(selectedStudent.id, feedbackMonth).then(setTeacherFeedback);
  }, [feedbackMonth, modalOpen, selectedStudent]);

  // Reload attendance comments when filter/month changes
  useEffect(() => {
    if (!selectedStudent || !modalOpen) return;

    if (commentFilter === "all") {
      const key = `${selectedStudent.id}:all`;
      if (lastLessonCommentsKeyRef.current === key) return;
      lastLessonCommentsKeyRef.current = key;
      fetchLessonCommentsByStudent({ studentId: selectedStudent.id, limit: 200 }).then(setLessonComments);
      return;
    }

    const range = getMonthRange(feedbackMonth);
    if (!range) {
      setLessonComments([]);
      return;
    }
    const key = `${selectedStudent.id}:month:${feedbackMonth}`;
    if (lastLessonCommentsKeyRef.current === key) return;
    lastLessonCommentsKeyRef.current = key;
    fetchLessonCommentsByStudent({ studentId: selectedStudent.id, from: range.from, to: range.to, limit: 200 }).then(setLessonComments);
  }, [commentFilter, feedbackMonth, modalOpen, selectedStudent]);

  const MONTH_OPTIONS = [
    { value: "2025-09", label: "Сентябрь 2025" },
    { value: "2025-10", label: "Октябрь 2025" },
    { value: "2025-11", label: "Ноябрь 2025" },
    { value: "2025-12", label: "Декабрь 2025" },
    { value: "2026-01", label: "Январь 2026" },
    { value: "2026-02", label: "Февраль 2026" },
    { value: "2026-03", label: "Март 2026" },
    { value: "2026-04", label: "Апрель 2026" },
    { value: "2026-05", label: "Май 2026" },
  ];

  const exportStudentPDF = () => {
    if (!selectedStudent) return;
    const s = selectedStudent;
    const stats = s.attendance_stats;
    const monthLabel = MONTH_OPTIONS.find(m => m.value === feedbackMonth)?.label || feedbackMonth;

    const attendanceRows = (s.recent_attendance || [])
      .map(r => `<tr><td>${r.date}</td><td>${r.subject_name || "—"}</td><td class="${r.status === 'present' ? 'present' : 'absent'}">${r.status === 'present' ? 'Присутствовал' : 'Отсутствовал'}</td><td>${r.homework === 'done' ? 'Да' : '—'}</td><td>${r.lateness === 'late' ? 'Да' : '—'}</td></tr>`)
      .join('');

    const entRows = (s.ent_results || [])
      .map(e => `<tr><td>${e.month}</td><td>${e.subject_name}</td><td class="score">${e.score}</td></tr>`)
      .join('');

    const entMonths = [...new Set((s.ent_results || []).map(e => e.month))].sort().reverse();
    const entSummary = entMonths.map(month => {
      const results = (s.ent_results || []).filter(e => e.month === month);
      const total = results.reduce((sum, e) => sum + e.score, 0);
      return `<div class="ent-month"><strong>${month}:</strong> ${results.map(e => `${e.subject_name}: ${e.score}`).join(', ')} — <strong>Итого: ${total}</strong></div>`;
    }).join('');

    const feedbackRows = teacherFeedback
      .map(f => `<div class="feedback-item"><div class="feedback-teacher">${f.teacher_name} · ${f.subject_name || ''}</div><div class="feedback-text">${f.comment}</div></div>`)
      .join('');

    const parentRows = parentFeedback
      .map(f => `<div class="feedback-item"><div class="feedback-teacher">${f.date} · Статус: ${f.status || 'не указан'}</div>${f.notes ? `<div class="feedback-text">${f.notes}</div>` : ''}</div>`)
      .join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Карточка ученика — ${s.full_name}</title><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #000; font-size: 12px; }
      .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; border-bottom: 3px solid #000; padding-bottom: 14px; }
      .logo { font-size: 24px; font-weight: 900; letter-spacing: 2px; }
      .logo span { display: inline-block; width: 6px; height: 6px; background: #000; border-radius: 50%; margin-left: 2px; vertical-align: super; }
      .subtitle { font-size: 11px; color: #555; margin-top: 2px; }
      .student-name { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
      .student-group { font-size: 13px; color: #555; }
      .section { margin: 16px 0; }
      .section-title { font-size: 14px; font-weight: 700; border-left: 4px solid #000; padding-left: 8px; margin-bottom: 8px; }
      .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .info-item label { font-size: 10px; color: #777; text-transform: uppercase; display: block; }
      .info-item p { font-size: 13px; font-weight: 600; }
      .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
      .stat-box { border: 1px solid #ddd; border-radius: 6px; padding: 8px; text-align: center; }
      .stat-box .value { font-size: 20px; font-weight: 700; }
      .stat-box .label { font-size: 9px; color: #777; text-transform: uppercase; }
      table { width: 100%; border-collapse: collapse; margin-top: 6px; }
      th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; font-size: 11px; }
      th { background: #f0f0f0; font-weight: 700; font-size: 10px; text-transform: uppercase; }
      .present { color: #16a34a; font-weight: 600; }
      .absent { color: #dc2626; font-weight: 600; }
      .score { font-weight: 700; text-align: center; }
      .ent-month { margin-bottom: 4px; font-size: 11px; }
      .feedback-item { border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px; margin-bottom: 6px; }
      .feedback-teacher { font-size: 11px; font-weight: 600; color: #555; margin-bottom: 3px; }
      .feedback-text { font-size: 12px; }
      .footer { margin-top: 20px; font-size: 9px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 8px; }
      @media print { body { padding: 15px; } }
    </style></head><body>
    <div class="header">
      <div><div class="logo">TODAY<span></span></div><div class="subtitle">Образовательный центр · Карточка ученика</div></div>
      <div style="text-align:right"><div class="student-name">${s.full_name}</div><div class="student-group">${s.group_name || ''} · ${monthLabel}</div></div>
    </div>

    <div class="section">
      <div class="section-title">Общая информация</div>
      <div class="info-grid">
        <div class="info-item"><label>Группа</label><p>${s.group_name || '—'}</p></div>
        <div class="info-item"><label>Телефон</label><p>${s.phone ? formatPhone(s.phone) : '—'}</p></div>
        <div class="info-item"><label>Родитель</label><p>${s.parent_name || '—'}</p></div>
        <div class="info-item"><label>Тел. родителя</label><p>${s.parent_phone ? formatPhone(s.parent_phone) : '—'}</p></div>
      </div>
    </div>

    ${stats && stats.total_lessons > 0 ? `
    <div class="section">
      <div class="section-title">Посещаемость</div>
      <div class="stats-grid">
        <div class="stat-box"><div class="value">${stats.attendance_rate}%</div><div class="label">Посещаемость</div></div>
        <div class="stat-box"><div class="value">${stats.total_lessons}</div><div class="label">Всего уроков</div></div>
        <div class="stat-box"><div class="value" style="color:#16a34a">${stats.present_count}</div><div class="label">Присутствовал</div></div>
        <div class="stat-box"><div class="value" style="color:#dc2626">${stats.absent_count}</div><div class="label">Отсутствовал</div></div>
      </div>
      ${attendanceRows ? `<table><thead><tr><th>Дата</th><th>Предмет</th><th>Статус</th><th>ДЗ</th><th>Опоздание</th></tr></thead><tbody>${attendanceRows}</tbody></table>` : ''}
    </div>` : ''}

    ${entSummary ? `
    <div class="section">
      <div class="section-title">Результаты ЕНТ</div>
      ${entSummary}
    </div>` : ''}

    ${feedbackRows ? `
    <div class="section">
      <div class="section-title">Отзывы учителей (${monthLabel})</div>
      ${feedbackRows}
    </div>` : ''}

    ${parentRows ? `
    <div class="section">
      <div class="section-title">Обратная связь с родителями</div>
      ${parentRows}
    </div>` : ''}

    <div class="footer">TODAY Education Center · Сгенерировано ${new Date().toLocaleString('ru-RU')}</div>
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
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div><Skeleton className="h-6 w-40" /><Skeleton className="h-4 w-56 mt-1" /></div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-10 w-full rounded-lg" />
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
        <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Users className="h-4 w-4 md:h-5 md:w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg md:text-2xl font-heading font-bold text-foreground">Ученики</h1>
          <p className="text-xs md:text-sm text-muted-foreground">{stats.total} учеников в {groups.length} группах</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Всего учеников</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className={`text-2xl font-bold ${rateColor(stats.avgAttendance)}`}>{stats.avgAttendance}%</p>
                <p className="text-xs text-muted-foreground">Ср. посещаемость</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.avgEnt || "—"}</p>
                <p className="text-xs text-muted-foreground">Ср. балл ЕНТ</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{groups.length}</p>
                <p className="text-xs text-muted-foreground">Групп</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Group pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {stats.groupCounts.map(g => (
          <button
            key={g.id}
            onClick={() => setSelectedGroup(selectedGroup === g.id.toString() ? "all" : g.id.toString())}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              selectedGroup === g.id.toString()
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
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
          <Input
            placeholder="Поиск по имени..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedGroup} onValueChange={setSelectedGroup}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Все группы" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все группы</SelectItem>
            {groups.map((group) => (
              <SelectItem key={group.id} value={group.id.toString()}>{group.name}</SelectItem>
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
                  <button onClick={() => handleSort("full_name")} className="flex items-center gap-1 hover:text-foreground">
                    ФИО <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <button onClick={() => handleSort("group_name")} className="flex items-center gap-1 hover:text-foreground">
                    Группа <ArrowUpDown className="h-3 w-3" />
                  </button>
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
                  <button onClick={() => handleSort("last_ent_score")} className="flex items-center gap-1 hover:text-foreground mx-auto">
                    ЕНТ <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => (
                <tr
                  key={student.id}
                  onClick={() => handleStudentClick(student)}
                  className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <UserAvatar user={student} size="sm" />
                      <div>
                        <p className="font-medium text-sm">{student.full_name}</p>
                        {student.parent_name && (
                          <p className="text-[11px] text-muted-foreground">Родитель: {student.parent_name}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className="text-xs">{student.group_name || "—"}</Badge>
                  </td>
                  <td className="p-2 md:p-3 hidden md:table-cell text-sm text-muted-foreground">
                    {student.phone || "—"}
                  </td>
                  <td className="p-2 md:p-3 text-center">
                    {student.attendance_rate !== null && student.attendance_rate !== undefined ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16">
                          <Progress value={student.attendance_rate} className={`h-1.5 ${rateBg(student.attendance_rate)}`} />
                        </div>
                        <span className={`text-xs font-medium ${rateColor(student.attendance_rate)}`}>
                          {Math.round(student.attendance_rate)}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-2 md:p-3 text-center hidden sm:table-cell">
                    {student.last_ent_score ? (
                      <Badge variant="secondary" className="text-xs font-medium">{student.last_ent_score}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
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

      <p className="text-xs text-muted-foreground mt-2 text-right">
        Показано {filteredStudents.length} из {students.length}
      </p>

      {/* Student Details Modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => { setModalOpen(open); if (!open) setEditMode(false); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <span className="flex-1">{selectedStudent?.full_name}</span>
              {selectedStudent && !editMode && canEditStudent(selectedStudent) && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={startEditing}>
                  <Pencil className="h-3.5 w-3.5" /> Редактировать
                </Button>
              )}
              {selectedStudent && editMode && (
                <>
                  <Button variant="default" size="sm" className="gap-1.5" onClick={handleSaveStudent} disabled={saving}>
                    <Save className="h-3.5 w-3.5" /> {saving ? "..." : "Сохранить"}
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={cancelEditing} disabled={saving}>
                    <X className="h-3.5 w-3.5" /> Отмена
                  </Button>
                </>
              )}
              {selectedStudent && !editMode && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={exportStudentPDF}>
                  <Download className="h-3.5 w-3.5" /> PDF
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          {studentDetailsLoading ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-8 w-full rounded-lg" />
              <div className="grid grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
              </div>
            </div>
          ) : selectedStudent && (
              <Tabs defaultValue="info" className="mt-2">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="info">Информация</TabsTrigger>
                <TabsTrigger value="attendance">Посещаемость</TabsTrigger>
                <TabsTrigger value="ent">ЕНТ</TabsTrigger>
                <TabsTrigger value="teacherReviews">Отзывы учителей</TabsTrigger>
                <TabsTrigger value="comments">Комментарии</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4 mt-4">
                <div className="flex items-center gap-6 mb-4">
                  <UserAvatar user={selectedStudent} size="lg" />
                  {canEditStudent(selectedStudent) && !editMode && (
                    <div className="flex flex-col gap-2">
                      <label htmlFor="student-avatar-upload" className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-primary">
                        <ImagePlus className="h-4 w-4" /> Загрузить фото
                        <input
                          id="student-avatar-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              await uploadStudentAvatar(selectedStudent.id, file);
                              const updated = await fetchStudent(selectedStudent.id.toString());
                              setSelectedStudent(updated);
                              setStudents(prev => prev.map(s => s.id === selectedStudent.id ? { ...s, avatar_url: updated.avatar_url } : s));
                            } catch (err) { alert("Ошибка загрузки фото"); }
                          }}
                        />
                      </label>
                      {selectedStudent.avatar_url && (
                        <button
                          className="flex items-center gap-1 text-xs text-destructive hover:underline"
                          onClick={async () => {
                            try {
                              await deleteStudentAvatar(selectedStudent.id);
                              const updated = await fetchStudent(selectedStudent.id.toString());
                              setSelectedStudent(updated);
                              setStudents(prev => prev.map(s => s.id === selectedStudent.id ? { ...s, avatar_url: null } : s));
                            } catch (err) { alert("Ошибка удаления фото"); }
                          }}
                        >
                          <Trash2 className="h-3 w-3" /> Удалить фото
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {editMode ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">ФИО</label>
                      <Input value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Группа</label>
                      <p className="text-sm font-medium pt-2">{selectedStudent.group_name || "—"}</p>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Телефон</label>
                      <Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: formatPhone(e.target.value) }))} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Родитель</label>
                      <Input value={editForm.parent_name} onChange={e => setEditForm(f => ({ ...f, parent_name: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Тел. родителя</label>
                      <Input value={editForm.parent_phone} onChange={e => setEditForm(f => ({ ...f, parent_phone: formatPhone(e.target.value) }))} />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Группа</label>
                      <p className="text-sm font-medium">{selectedStudent.group_name || "—"}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Телефон</label>
                      <p className="text-sm font-medium">{selectedStudent.phone ? formatPhone(selectedStudent.phone) : "—"}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Родитель</label>
                      <p className="text-sm font-medium">{selectedStudent.parent_name || "—"}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Тел. родителя</label>
                      <p className="text-sm font-medium">{selectedStudent.parent_phone ? formatPhone(selectedStudent.parent_phone) : "—"}</p>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="attendance" className="space-y-4 mt-4">
                {selectedStudent.attendance_stats && selectedStudent.attendance_stats.total_lessons > 0 ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <Card><CardContent className="p-3">
                        <div className={`text-2xl font-bold ${rateColor(selectedStudent.attendance_stats.attendance_rate)}`}>
                          {selectedStudent.attendance_stats.attendance_rate}%
                        </div>
                        <p className="text-xs text-muted-foreground">Посещаемость</p>
                      </CardContent></Card>
                      <Card><CardContent className="p-3">
                        <div className="text-2xl font-bold text-blue-600">{selectedStudent.attendance_stats.total_lessons}</div>
                        <p className="text-xs text-muted-foreground">Всего уроков</p>
                      </CardContent></Card>
                      <Card><CardContent className="p-3">
                        <div className="text-2xl font-bold text-green-600">{selectedStudent.attendance_stats.present_count}</div>
                        <p className="text-xs text-muted-foreground">Присутствовал</p>
                      </CardContent></Card>
                      <Card><CardContent className="p-3">
                        <div className="text-2xl font-bold text-red-600">{selectedStudent.attendance_stats.absent_count}</div>
                        <p className="text-xs text-muted-foreground">Отсутствовал</p>
                      </CardContent></Card>
                    </div>

                    {selectedStudent.recent_attendance && selectedStudent.recent_attendance.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Последние записи</h4>
                        <div className="space-y-1.5">
                          {selectedStudent.recent_attendance.map((record, index) => (
                            <div key={index} className="flex items-center justify-between p-2.5 border rounded-lg text-sm">
                              <div className="flex items-center gap-2">
                                <Badge variant={record.status === 'present' ? 'default' : 'destructive'} className="text-[10px]">
                                  {record.status === 'present' ? 'Был' : 'Нет'}
                                </Badge>
                                <div>
                                  <p className="font-medium text-xs">{record.subject_name || "—"}</p>
                                  <p className="text-[10px] text-muted-foreground">{record.date}</p>
                                  {record.comment && (
                                    <p className="text-[10px] text-muted-foreground/80 truncate max-w-[220px]">
                                      {record.comment}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-1">
                                {record.homework === 'done' && <Badge variant="outline" className="text-[9px]">ДЗ ✓</Badge>}
                                {record.lateness === 'late' && <Badge variant="outline" className="text-[9px] text-amber-600">Опоздал</Badge>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Нет данных о посещаемости</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="ent" className="space-y-4 mt-4">
                {selectedStudent.ent_results && selectedStudent.ent_results.length > 0 ? (() => {
                  const months = [...new Set(selectedStudent.ent_results!.map(e => e.month))].sort().reverse();
                  return (
                    <div className="space-y-4">
                      {months.map(month => {
                        const monthResults = selectedStudent.ent_results!.filter(e => e.month === month);
                        const total = monthResults.reduce((s, e) => s + e.score, 0);
                        return (
                          <div key={month}>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-semibold">{month}</h4>
                              <Badge variant="secondary" className="text-xs">Итого: {total}</Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {monthResults.map((e, i) => (
                                <div key={i} className="flex items-center justify-between p-2 border rounded-lg">
                                  <span className="text-xs">{e.subject_name}</span>
                                  <span className="text-sm font-bold">{e.score}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })() : (
                  <div className="text-center py-8 text-muted-foreground">
                    <GraduationCap className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Нет результатов ЕНТ</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="teacherReviews" className="space-y-4 mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Select value={feedbackMonth} onValueChange={setFeedbackMonth}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Месяц" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTH_OPTIONS.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {teacherFeedback.length > 0 ? (
                  <div>
                    <div className="space-y-2">
                      {teacherFeedback.map((f: any) => (
                        <div key={f.id} className="p-3 border rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-muted-foreground">{f.teacher_name}</span>
                            {f.subject_name && <Badge variant="outline" className="text-[10px]">{f.subject_name}</Badge>}
                          </div>
                          <p className="text-sm">{f.comment}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Нет отзывов учителей за выбранный месяц</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="comments" className="space-y-4 mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Select value={commentFilter} onValueChange={(v) => setCommentFilter(v as CommentFilter)}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Фильтр" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все</SelectItem>
                      <SelectItem value="month">За месяц</SelectItem>
                    </SelectContent>
                  </Select>

                  {commentFilter === "month" && (
                    <Select value={feedbackMonth} onValueChange={setFeedbackMonth}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Месяц" />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTH_OPTIONS.map(m => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {lessonComments.length > 0 ? (
                  <div>
                    <div className="space-y-2">
                      {lessonComments.map((c: any, i: number) => (
                        <div key={`${c.date}-${i}`} className="p-3 border rounded-lg">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-muted-foreground">{c.date}</span>
                            {c.teacher_name && <Badge variant="outline" className="text-[10px]">{c.teacher_name}</Badge>}
                            {c.subject_name && <Badge variant="secondary" className="text-[10px]">{c.subject_name}</Badge>}
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{c.comment}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Нет комментариев</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
