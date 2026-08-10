import { useState, useEffect, useMemo } from "react";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { ru } from "date-fns/locale";
import * as XLSX from "xlsx";
import { 
  ClipboardCheck, Search, Download, TrendingUp, Users, Calendar
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchQuizzes, fetchGroups, fetchSubjects, fetchUsers } from "@/lib/api";
import { GroupPersonAvatar } from "@/components/GroupPersonAvatar";

const MONTHS = [
  { value: "2026-01", label: "Январь 2026" },
  { value: "2026-02", label: "Февраль 2026" },
  { value: "2026-03", label: "Март 2026" },
  { value: "2026-04", label: "Апрель 2026" },
  { value: "2026-05", label: "Май 2026" },
  { value: "2026-06", label: "Июнь 2026" },
  { value: "2026-07", label: "Июль 2026" },
  { value: "2026-08", label: "Август 2026" },
  { value: "2026-09", label: "Сентябрь 2026" },
  { value: "2026-10", label: "Октябрь 2026" },
  { value: "2026-11", label: "Ноябрь 2026" },
  { value: "2026-12", label: "Декабрь 2026" },
];

export default function QuizResultsPage() {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [teachers, setTeachers] = useState<any[]>([]);
  
  const currentMonthValue = format(new Date(), "yyyy-MM");
  const [month, setMonth] = useState<string>(currentMonthValue);
  const [groupId, setGroupId] = useState<string>("all");
  const [subjectId, setSubjectId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchGroups(),
      fetchSubjects(),
      fetchUsers()
    ]).then(([g, s, u]) => {
      setGroups(g);
      setSubjects(s);
      setTeachers(u.filter((x: any) => x.role === "teacher"));
    }).catch(console.error);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadQuizzes = async () => {
      setLoading(true);
      try {
        const [y, m] = month.split("-");
        const dateObj = new Date(parseInt(y), parseInt(m) - 1, 1);
        const start = format(startOfMonth(dateObj), "yyyy-MM-dd");
        const end = format(endOfMonth(dateObj), "yyyy-MM-dd");

        const params: any = { start_date: start, end_date: end };
        if (groupId !== "all") params.group_id = groupId;
        if (subjectId !== "all") params.subject_id = subjectId;

        const data = await fetchQuizzes(params);
        if (!cancelled) setQuizzes(data);
      } catch (err) {
        console.error("Failed to fetch quizzes", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadQuizzes();
    return () => { cancelled = true; };
  }, [month, groupId, subjectId]);

  // Transform data for the cross-tab table
  const tableData = useMemo(() => {
    const studentMap = new Map<number, { id: number; name: string; group_name: string; group_avatar: string; scores: Record<number, number | null> }>();
    
    // Sort quizzes by date ascending for columns
    const sortedQuizzes = [...quizzes].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);

    for (const q of sortedQuizzes) {
      if (!q.results) continue;
      for (const r of q.results) {
        if (!studentMap.has(r.student_id)) {
          studentMap.set(r.student_id, {
            id: r.student_id,
            name: r.full_name,
            group_name: r.group_name || q.group_name,
            group_avatar: r.group_avatar || q.group_avatar,
            scores: {}
          });
        }
        const st = studentMap.get(r.student_id)!;
        st.scores[q.id] = r.score;
      }
    }

    const studentsList = Array.from(studentMap.values());
    if (search) {
      const q = search.toLowerCase();
      return {
        columns: sortedQuizzes,
        rows: studentsList.filter(s => s.name.toLowerCase().includes(q) || (s.group_name && s.group_name.toLowerCase().includes(q)))
      };
    }

    return { columns: sortedQuizzes, rows: studentsList };
  }, [quizzes, search]);

  const exportToExcel = () => {
    if (tableData.rows.length === 0) return;
    
    const headers = ["Ученик", "Группа", ...tableData.columns.map(q => `${format(parseISO(q.date), "dd MMM")} (${q.title})`), "Средний балл"];
    
    const excelRows = tableData.rows.map(row => {
      let sum = 0;
      let count = 0;
      const scoreCols = tableData.columns.map(q => {
        const val = row.scores[q.id];
        if (val !== undefined && val !== null) {
          sum += val;
          count++;
          return val;
        }
        return "-";
      });
      const avg = count > 0 ? (sum / count).toFixed(1) : "-";
      return [row.name, row.group_name || "Без группы", ...scoreCols, avg];
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...excelRows]);
    XLSX.utils.book_append_sheet(wb, ws, "Контрольные");
    XLSX.writeFile(wb, `Контрольные_тесты_${month}.xlsx`);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto animate-in fade-in zoom-in-95 duration-200">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-primary" />
            Контрольные работы
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Аналитика по внутренним тестам на уроках
          </p>
        </div>
        <Button onClick={exportToExcel} disabled={tableData.rows.length === 0} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Экспорт в Excel
        </Button>
      </div>

      {/* FILTERS */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground ml-1">Месяц</label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground ml-1">Группа</label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Все группы" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все группы</SelectItem>
                {groups.map(g => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground ml-1">Предмет</label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Все предметы" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все предметы</SelectItem>
                {subjects.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Поиск по ученику или группе..." 
                className="pl-9" 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-primary/10 text-primary rounded-xl">
              <ClipboardCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Проведено тестов</p>
              <p className="text-2xl font-bold">{quizzes.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 text-blue-600 rounded-xl">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Учеников сдали</p>
              <p className="text-2xl font-bold">{tableData.rows.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Средний балл</p>
              <p className="text-2xl font-bold">
                {(() => {
                  let total = 0, count = 0;
                  tableData.rows.forEach(r => {
                    Object.values(r.scores).forEach(s => {
                      if (s !== null && s !== undefined) { total += s; count++; }
                    });
                  });
                  return count > 0 ? (total / count).toFixed(1) : "-";
                })()}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* TABLE */}
      <Card className="overflow-hidden border border-border">
        {loading ? (
          <div className="p-12 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : tableData.columns.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <ClipboardCheck className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-lg font-medium text-foreground">Нет данных по тестам</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              За выбранный период контрольные работы не проводились или результаты еще не внесены.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[50px] font-semibold">№</TableHead>
                  <TableHead className="min-w-[200px] font-semibold sticky left-0 bg-muted/50 z-10 backdrop-blur-sm">Ученик</TableHead>
                  {tableData.columns.map(q => (
                    <TableHead key={q.id} className="min-w-[120px] text-center px-2">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1 bg-background px-1.5 py-0.5 rounded border shadow-sm">
                          <Calendar className="h-3 w-3" />
                          {format(parseISO(q.date), "dd MMM", { locale: ru })}
                        </span>
                        <span className="text-xs font-semibold text-primary truncate max-w-[110px]" title={q.title}>{q.title}</span>
                        <span className="text-[9px] text-muted-foreground/70 truncate max-w-[110px]" title={q.subject_name}>{q.subject_name || "Предмет"}</span>
                      </div>
                    </TableHead>
                  ))}
                  <TableHead className="text-center font-bold sticky right-0 bg-muted/50 z-10 backdrop-blur-sm shadow-[-5px_0_15px_-10px_rgba(0,0,0,0.1)]">Средний балл</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableData.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={tableData.columns.length + 3} className="h-24 text-center">
                      Ничего не найдено
                    </TableCell>
                  </TableRow>
                ) : (
                  tableData.rows.map((row, idx) => {
                    let sum = 0, count = 0;
                    return (
                      <TableRow key={row.id} className="group hover:bg-muted/30">
                        <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                        <TableCell className="sticky left-0 bg-background group-hover:bg-muted/30 z-10 font-medium">
                          <div className="flex items-center gap-2">
                            <span className="truncate max-w-[140px]">{row.name}</span>
                            {row.group_name && (
                              <Badge variant="outline" className="text-[10px] bg-background">
                                <GroupPersonAvatar groupName={row.group_name} avatarUrl={row.group_avatar} size={10} className="mr-1 inline-flex" showTooltip={false} />
                                {row.group_name}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        
                        {tableData.columns.map(q => {
                          const val = row.scores[q.id];
                          if (val !== undefined && val !== null) {
                            sum += val; count++;
                            return (
                              <TableCell key={q.id} className="text-center">
                                <span className="inline-flex items-center justify-center font-bold text-sm bg-primary/10 text-primary h-7 min-w-[32px] px-2 rounded-md">
                                  {val}
                                </span>
                              </TableCell>
                            );
                          }
                          return <TableCell key={q.id} className="text-center text-muted-foreground/30">-</TableCell>;
                        })}
                        
                        <TableCell className="text-center sticky right-0 bg-background group-hover:bg-muted/30 z-10 shadow-[-5px_0_15px_-10px_rgba(0,0,0,0.05)]">
                          {count > 0 ? (
                            <span className="font-bold text-primary text-sm">{(sum / count).toFixed(1)}</span>
                          ) : (
                            <span className="text-muted-foreground/50">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
