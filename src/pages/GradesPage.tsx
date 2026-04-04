import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardCheck, Search, ChevronDown, ChevronUp, FileText, Users, TrendingUp } from "lucide-react";
import { fetchQuizzes, fetchGroups, fetchSubjects } from "@/lib/api";

interface QuizResult { student_id: number; score: number | null; student_name: string }
interface Quiz {
  id: number; title: string; date: string; created_at: string;
  teacher_name: string | null; subject_name: string | null; group_name: string | null; group_id: number | null;
  results: QuizResult[];
}

export default function GradesPage() {
  const { t } = useTranslation();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [groups, setGroups] = useState<{ id: number; name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);

  useEffect(() => {
    Promise.all([fetchQuizzes(), fetchGroups(), fetchSubjects()])
      .then(([q, g, s]) => { setQuizzes(q); setGroups(g); setSubjects(s); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return quizzes.filter(q => {
      if (groupFilter !== "all" && String(q.group_id) !== groupFilter) return false;
      if (subjectFilter !== "all" && q.subject_name !== subjects.find(s => String(s.id) === subjectFilter)?.name) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!q.title.toLowerCase().includes(s) && !(q.subject_name || "").toLowerCase().includes(s) && !(q.teacher_name || "").toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [quizzes, groupFilter, subjectFilter, search, subjects]);

  const stats = useMemo(() => {
    const total = quizzes.length;
    const allScores = quizzes.flatMap(q => q.results?.map(r => r.score).filter((s): s is number => s != null) || []);
    const avgScore = allScores.length ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1) : "—";
    const totalStudentResults = allScores.length;
    return { total, avgScore, totalStudentResults };
  }, [quizzes]);

  const quizStats = (q: Quiz) => {
    const scores = (q.results || []).map(r => r.score).filter((s): s is number => s != null);
    if (!scores.length) return { avg: "—", max: "—", min: "—", count: 0, total: q.results?.length || 0 };
    return {
      avg: (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1),
      max: Math.max(...scores),
      min: Math.min(...scores),
      count: scores.length,
      total: q.results?.length || 0,
    };
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
    } catch { return d; }
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in duration-300">
      {/* Header */}


      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 md:p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><FileText className="h-4 w-4 text-primary" /></div>
            <div>
              <p className="text-lg md:text-2xl font-bold">{stats.total}</p>
              <p className="text-[11px] text-muted-foreground">Всего тестов</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10"><TrendingUp className="h-4 w-4 text-green-600" /></div>
            <div>
              <p className="text-lg md:text-2xl font-bold">{stats.avgScore}</p>
              <p className="text-[11px] text-muted-foreground">Средний балл</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10"><Users className="h-4 w-4 text-blue-600" /></div>
            <div>
              <p className="text-lg md:text-2xl font-bold">{stats.totalStudentResults}</p>
              <p className="text-[11px] text-muted-foreground">Оценок выставлено</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9 h-9 text-sm" placeholder="Поиск по названию, предмету, учителю…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={groupFilter} onValueChange={setGroupFilter}>
          <SelectTrigger className="h-9 w-full sm:w-44 text-sm"><SelectValue placeholder="Все группы" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все группы</SelectItem>
            {groups.map(g => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
          <SelectTrigger className="h-9 w-full sm:w-44 text-sm"><SelectValue placeholder="Все предметы" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все предметы</SelectItem>
            {subjects.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground animate-pulse"><ClipboardCheck className="h-10 w-10 mx-auto mb-3 opacity-20" /><p>Загрузка…</p></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ClipboardCheck className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">{quizzes.length === 0 ? "Нет контрольных тестов" : "Ничего не найдено"}</p>
          <p className="text-sm mt-1">{quizzes.length === 0 ? "Контрольные тесты создаются через модуль урока в расписании" : "Попробуйте изменить фильтры"}</p>
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[140px]">Дата</TableHead>
                  <TableHead className="min-w-[180px]">Название</TableHead>
                  <TableHead className="hidden sm:table-cell">Предмет</TableHead>
                  <TableHead className="hidden md:table-cell">Преподаватель</TableHead>
                  <TableHead className="hidden sm:table-cell">Группа</TableHead>
                  <TableHead className="text-center">Ср. балл</TableHead>
                  <TableHead className="text-center hidden sm:table-cell">Макс</TableHead>
                  <TableHead className="text-center">Сдало</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(q => {
                  const s = quizStats(q);
                  return (
                    <TableRow key={q.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedQuiz(q)}>
                      <TableCell className="text-sm font-medium">{formatDate(q.date)}</TableCell>
                      <TableCell>
                        <p className="text-sm font-medium truncate max-w-[200px]">{q.title}</p>
                        <p className="text-[11px] text-muted-foreground sm:hidden">{q.subject_name || "—"} · {q.group_name || "—"}</p>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">{q.subject_name || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{q.teacher_name || "—"}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {q.group_name ? <Badge variant="outline" className="text-xs">{q.group_name}</Badge> : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-semibold text-sm">{s.avg}</span>
                      </TableCell>
                      <TableCell className="text-center hidden sm:table-cell text-sm">{s.max}</TableCell>
                      <TableCell className="text-center text-sm">{s.count}/{s.total}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selectedQuiz} onOpenChange={open => !open && setSelectedQuiz(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedQuiz && (() => {
            const s = quizStats(selectedQuiz);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-base">{selectedQuiz.title}</DialogTitle>
                  <p className="text-sm text-muted-foreground">{formatDate(selectedQuiz.date)} · {selectedQuiz.subject_name || "—"} · {selectedQuiz.group_name || "—"}</p>
                  {selectedQuiz.teacher_name && <p className="text-xs text-muted-foreground">Преподаватель: {selectedQuiz.teacher_name}</p>}
                </DialogHeader>
                {/* Stats row */}
                <div className="grid grid-cols-4 gap-2 py-2">
                  {[
                    { label: "Ср. балл", value: s.avg },
                    { label: "Макс", value: s.max },
                    { label: "Мин", value: s.min },
                    { label: "Сдало", value: `${s.count}/${s.total}` },
                  ].map(item => (
                    <div key={item.label} className="text-center rounded-lg bg-muted/50 p-2">
                      <p className="text-base font-bold">{item.value}</p>
                      <p className="text-[10px] text-muted-foreground">{item.label}</p>
                    </div>
                  ))}
                </div>
                {/* Results table */}
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Ученик</TableHead>
                        <TableHead className="text-xs text-right w-20">Балл</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(selectedQuiz.results || [])
                        .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
                        .map(r => (
                          <TableRow key={r.student_id}>
                            <TableCell className="text-sm py-2">{r.student_name}</TableCell>
                            <TableCell className="text-right py-2">
                              {r.score != null ? (
                                <span className="font-semibold">{r.score}</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
