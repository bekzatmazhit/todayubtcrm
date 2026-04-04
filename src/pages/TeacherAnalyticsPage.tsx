import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchTeacherAnalytics } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Activity, BookOpen, Users, TrendingUp, GraduationCap,
  BarChart3, Calendar,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
} from "recharts";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

interface SubjectStat {
  subject_name: string;
  subject_id: number;
  present: number;
  absent: number;
  late: number;
  total: number;
}

interface MonthlyTrend {
  month: string;
  present: number;
  absent: number;
  late: number;
  total: number;
  lessons: number;
}

interface GroupStat {
  group_name: string;
  group_id: number;
  present: number;
  absent: number;
  total: number;
}

interface EntPoint {
  month: string;
  avg_score: number;
  students_count: number;
  subject_name: string;
}

interface Analytics {
  lessonsCount: number;
  studentsCount: number;
  bySubject: SubjectStat[];
  monthlyTrend: MonthlyTrend[];
  byGroup: GroupStat[];
  entDynamics: EntPoint[];
  groups: { id: number; name: string }[];
}

export default function TeacherAnalyticsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<Analytics | null>(null);
  const [months, setMonths] = useState("6");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    fetchTeacherAnalytics(user.id, parseInt(months))
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [user?.id, months]);

  const overallRate = useMemo(() => {
    if (!data?.bySubject.length) return 0;
    const total = data.bySubject.reduce((s, r) => s + r.total, 0);
    const present = data.bySubject.reduce((s, r) => s + r.present, 0);
    return total > 0 ? Math.round((present / total) * 100) : 0;
  }, [data]);

  const totalLate = useMemo(() => {
    if (!data?.bySubject.length) return 0;
    return data.bySubject.reduce((s, r) => s + r.late, 0);
  }, [data]);

  const trendData = useMemo(() => {
    if (!data?.monthlyTrend) return [];
    return data.monthlyTrend.map(m => ({
      month: m.month.slice(5),
      "Посещаемость %": m.total > 0 ? Math.round((m.present / m.total) * 100) : 0,
      "Уроков": m.lessons,
    }));
  }, [data]);

  const subjectData = useMemo(() => {
    if (!data?.bySubject) return [];
    return data.bySubject.map(s => ({
      name: s.subject_name || "—",
      "Посещаемость %": s.total > 0 ? Math.round((s.present / s.total) * 100) : 0,
      "Отсутствия": s.absent,
      "Опоздания": s.late,
    }));
  }, [data]);

  const groupData = useMemo(() => {
    if (!data?.byGroup) return [];
    return data.byGroup.map(g => ({
      name: g.group_name || "Сводная",
      "Посещаемость %": g.total > 0 ? Math.round((g.present / g.total) * 100) : 0,
      present: g.present,
      absent: g.absent,
    }));
  }, [data]);

  // ENT: group by subject, then by month for line chart
  const entChartData = useMemo(() => {
    if (!data?.entDynamics.length) return { lines: [] as string[], data: [] as any[] };
    const subjects = [...new Set(data.entDynamics.map(e => e.subject_name))];
    const monthsSet = [...new Set(data.entDynamics.map(e => e.month))].sort();
    const chartData = monthsSet.map(m => {
      const point: any = { month: m.slice(5) };
      for (const subj of subjects) {
        const entry = data.entDynamics.find(e => e.month === m && e.subject_name === subj);
        point[subj] = entry ? entry.avg_score : null;
      }
      return point;
    });
    return { lines: subjects, data: chartData };
  }, [data]);

  const pieData = useMemo(() => {
    if (!data?.bySubject.length) return [];
    const total = data.bySubject.reduce((s, r) => s + r.total, 0);
    const present = data.bySubject.reduce((s, r) => s + r.present, 0);
    const absent = data.bySubject.reduce((s, r) => s + r.absent, 0);
    const late = data.bySubject.reduce((s, r) => s + r.late, 0);
    return [
      { name: "Присутствие", value: present, color: "#10b981" },
      { name: "Отсутствие", value: absent, color: "#ef4444" },
      { name: "Опоздания", value: late, color: "#f59e0b" },
    ].filter(d => d.value > 0);
  }, [data]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="animate-pulse"><CardContent className="p-5 h-24" /></Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            Не удалось загрузить данные аналитики
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-end flex-wrap gap-3">
        <Select value={months} onValueChange={setMonths}>
          <SelectTrigger className="w-[160px]">
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Проведено уроков</p>
                <p className="text-3xl font-bold mt-1">{data.lessonsCount}</p>
              </div>
              <Calendar className="h-10 w-10 text-primary/20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Средняя посещаемость</p>
                <p className="text-3xl font-bold mt-1">{overallRate}%</p>
              </div>
              <TrendingUp className="h-10 w-10 text-green-500/20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Учеников</p>
                <p className="text-3xl font-bold mt-1">{data.studentsCount}</p>
              </div>
              <Users className="h-10 w-10 text-blue-500/20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Групп</p>
                <p className="text-3xl font-bold mt-1">{data.groups.length}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {data.groups.slice(0, 3).map(g => (
                    <Badge key={g.id} variant="secondary" className="text-[10px]">{g.name}</Badge>
                  ))}
                  {data.groups.length > 3 && <Badge variant="outline" className="text-[10px]">+{data.groups.length - 3}</Badge>}
                </div>
              </div>
              <GraduationCap className="h-10 w-10 text-purple-500/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1: Trend + Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Динамика посещаемости
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="Посещаемость %" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="Уроков" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} yAxisId={0} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">Нет данных</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Общая статистика</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">Нет данных</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: By Subject + By Group */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4" /> Посещаемость по предметам
            </CardTitle>
          </CardHeader>
          <CardContent>
            {subjectData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={subjectData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Посещаемость %" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">Нет данных</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Посещаемость по группам
            </CardTitle>
          </CardHeader>
          <CardContent>
            {groupData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={groupData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Посещаемость %" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">Нет данных</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ENT Dynamics */}
      {entChartData.data.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Динамика ЕНТ учеников
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={entChartData.data}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 140]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                {entChartData.lines.map((subj, i) => (
                  <Line key={subj} type="monotone" dataKey={subj} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Subject Details Table */}
      {data.bySubject.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Детализация по предметам</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-semibold">Предмет</th>
                    <th className="text-center py-2 px-3 font-semibold">Всего</th>
                    <th className="text-center py-2 px-3 font-semibold">Присутствие</th>
                    <th className="text-center py-2 px-3 font-semibold">Отсутствие</th>
                    <th className="text-center py-2 px-3 font-semibold">Опоздания</th>
                    <th className="text-center py-2 px-3 font-semibold">Посещаемость</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bySubject.map(s => {
                    const rate = s.total > 0 ? Math.round((s.present / s.total) * 100) : 0;
                    return (
                      <tr key={s.subject_id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2 px-3 font-medium">{s.subject_name || "—"}</td>
                        <td className="py-2 px-3 text-center">{s.total}</td>
                        <td className="py-2 px-3 text-center text-green-600">{s.present}</td>
                        <td className="py-2 px-3 text-center text-red-600">{s.absent}</td>
                        <td className="py-2 px-3 text-center text-amber-600">{s.late}</td>
                        <td className="py-2 px-3 text-center">
                          <Badge variant={rate >= 80 ? "default" : rate >= 60 ? "secondary" : "destructive"}>
                            {rate}%
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
