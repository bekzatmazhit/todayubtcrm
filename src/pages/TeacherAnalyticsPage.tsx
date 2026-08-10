import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchTeacherAnalytics, fetchAttendanceStats, fetchGroups } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Activity, BookOpen, Users, TrendingUp, GraduationCap,
  BarChart3, Calendar, TrendingDown, AlertTriangle
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
} from "recharts";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [months, setMonths] = useState("6");
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<any[]>([]);

  const isAdmin = user?.role === "admin" || user?.role === "umo_head";

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);

    if (isAdmin) {
      Promise.all([
        fetchAttendanceStats(parseInt(months)),
        fetchGroups()
      ])
      .then(([stats, grps]) => {
        setData(stats);
        setGroups(grps);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
    } else {
      fetchTeacherAnalytics(user.id, parseInt(months))
        .then(res => setData(res))
        .catch(() => setData(null))
        .finally(() => setLoading(false));
    }
  }, [user?.id, months, isAdmin]);

  // =============== Admin Data Computed ===============
  const adminOverall = isAdmin ? (data?.overall || { total_present: 0, total_absent: 0, total_late: 0, total_records: 0 }) : null;
  const adminAttendanceRate = isAdmin && adminOverall?.total_records > 0
    ? Math.round((adminOverall.total_present / adminOverall.total_records) * 100) : 0;
  
  const adminMonthlyMap = new Map<string, { present: number; absent: number; late: number }>();
  if (isAdmin) {
    for (const row of (data?.byGroup || [])) {
      const existing = adminMonthlyMap.get(row.month) || { present: 0, absent: 0, late: 0 };
      existing.present += row.present_count;
      existing.absent += row.absent_count;
      existing.late += row.late_count;
      adminMonthlyMap.set(row.month, existing);
    }
  }
  const adminTrendData = [...adminMonthlyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, d]) => ({
      month: month.slice(5),
      "Посещаемость %": (d.present + d.absent + d.late) > 0 ? Math.round((d.present / (d.present + d.absent + d.late)) * 100) : 0,
      Присутствие: d.present,
      Отсутствие: d.absent,
      Опоздания: d.late,
    }));

  const adminGroupMap = new Map<string, { present: number; absent: number; total: number }>();
  if (isAdmin) {
    for (const row of (data?.byGroup || [])) {
      const existing = adminGroupMap.get(row.group_name) || { present: 0, absent: 0, total: 0 };
      existing.present += row.present_count;
      existing.absent += row.absent_count;
      existing.total += row.total_records;
      adminGroupMap.set(row.group_name, existing);
    }
  }
  const adminGroupData = [...adminGroupMap.entries()].map(([name, d]) => ({
    name,
    "Посещаемость %": d.total > 0 ? Math.round((d.present / d.total) * 100) : 0,
    Отсутствия: d.absent,
  }));

  const adminPieData = isAdmin ? [
    { name: "Присутствие", value: adminOverall.total_present, color: "#10b981" },
    { name: "Отсутствие", value: adminOverall.total_absent, color: "#ef4444" },
    { name: "Опоздания", value: adminOverall.total_late, color: "#f59e0b" },
  ].filter(d => d.value > 0) : [];

  // =============== Teacher Data Computed ===============
  const teacherOverallRate = useMemo(() => {
    if (isAdmin || !data?.bySubject?.length) return 0;
    const total = data.bySubject.reduce((s: number, r: any) => s + r.total, 0);
    const present = data.bySubject.reduce((s: number, r: any) => s + r.present, 0);
    return total > 0 ? Math.round((present / total) * 100) : 0;
  }, [data, isAdmin]);

  const teacherTrendData = useMemo(() => {
    if (isAdmin || !data?.monthlyTrend) return [];
    return data.monthlyTrend.map((m: any) => ({
      month: m.month.slice(5),
      "Посещаемость %": m.total > 0 ? Math.round((m.present / m.total) * 100) : 0,
      "Уроков": m.lessons,
    }));
  }, [data, isAdmin]);

  const teacherSubjectData = useMemo(() => {
    if (isAdmin || !data?.bySubject) return [];
    return data.bySubject.map((s: any) => ({
      name: s.subject_name || "—",
      "Посещаемость %": s.total > 0 ? Math.round((s.present / s.total) * 100) : 0,
      "Отсутствия": s.absent,
      "Опоздания": s.late,
    }));
  }, [data, isAdmin]);

  const teacherGroupData = useMemo(() => {
    if (isAdmin || !data?.byGroup) return [];
    return data.byGroup.map((g: any) => ({
      name: g.group_name || "Сводная",
      "Посещаемость %": g.total > 0 ? Math.round((g.present / g.total) * 100) : 0,
      present: g.present,
      absent: g.absent,
    }));
  }, [data, isAdmin]);

  const teacherEntChartData = useMemo(() => {
    if (isAdmin || !data?.entDynamics?.length) return { lines: [] as string[], data: [] as any[] };
    const subjects = [...new Set(data.entDynamics.map((e: any) => e.subject_name))] as string[];
    const monthsSet = [...new Set(data.entDynamics.map((e: any) => e.month))].sort() as string[];
    const chartData = monthsSet.map(m => {
      const point: any = { month: m.slice(5) };
      for (const subj of subjects) {
        const entry = data.entDynamics.find((e: any) => e.month === m && e.subject_name === subj);
        point[subj] = entry ? entry.avg_score : null;
      }
      return point;
    });
    return { lines: subjects, data: chartData };
  }, [data, isAdmin]);

  const teacherPieData = useMemo(() => {
    if (isAdmin || !data?.bySubject?.length) return [];
    const present = data.bySubject.reduce((s: number, r: any) => s + r.present, 0);
    const absent = data.bySubject.reduce((s: number, r: any) => s + r.absent, 0);
    const late = data.bySubject.reduce((s: number, r: any) => s + r.late, 0);
    return [
      { name: "Присутствие", value: present, color: "#10b981" },
      { name: "Отсутствие", value: absent, color: "#ef4444" },
      { name: "Опоздания", value: late, color: "#f59e0b" },
    ].filter(d => d.value > 0);
  }, [data, isAdmin]);

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
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardContent className="p-16 text-center text-muted-foreground flex flex-col items-center justify-center">
            <Activity className="h-16 w-16 mb-4 opacity-20" />
            <p className="text-lg">Не удалось загрузить данные аналитики</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Аналитика</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {isAdmin ? "Общая статистика по школе" : "Ваша персональная статистика"}
          </p>
        </div>
        <Select value={months} onValueChange={setMonths}>
          <SelectTrigger className="w-[180px] bg-background/50 backdrop-blur shadow-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">За 1 месяц</SelectItem>
            <SelectItem value="3">За 3 месяца</SelectItem>
            <SelectItem value="6">За 6 месяцев</SelectItem>
            <SelectItem value="12">За 12 месяцев</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm overflow-hidden relative group hover:shadow-md transition-shadow">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Посещаемость</p>
                <p className="text-4xl font-black tracking-tighter text-emerald-600 dark:text-emerald-400">
                  {isAdmin ? adminAttendanceRate : teacherOverallRate}%
                </p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {isAdmin ? (
          <>
            <Card className="border-0 shadow-sm overflow-hidden relative group hover:shadow-md transition-shadow">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Активных студентов</p>
                    <p className="text-4xl font-black tracking-tighter text-blue-600 dark:text-blue-400">
                      {data?.active_student_count ?? 0}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-2xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                    <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-sm overflow-hidden relative group hover:shadow-md transition-shadow">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Всего пропусков</p>
                    <p className="text-4xl font-black tracking-tighter text-red-600 dark:text-red-400">
                      {adminOverall?.total_absent || 0}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-2xl bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
                    <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm overflow-hidden relative group hover:shadow-md transition-shadow">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Опоздания</p>
                    <p className="text-4xl font-black tracking-tighter text-amber-600 dark:text-amber-400">
                      {adminOverall?.total_late || 0}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-2xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card className="border-0 shadow-sm overflow-hidden relative group hover:shadow-md transition-shadow">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Проведено уроков</p>
                    <p className="text-4xl font-black tracking-tighter text-blue-600 dark:text-blue-400">
                      {data.lessonsCount}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-2xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                    <Calendar className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm overflow-hidden relative group hover:shadow-md transition-shadow">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Учеников</p>
                    <p className="text-4xl font-black tracking-tighter text-purple-600 dark:text-purple-400">
                      {data.studentsCount}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-2xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
                    <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm overflow-hidden relative group hover:shadow-md transition-shadow">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-6 flex flex-col justify-center">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-muted-foreground">Групп</p>
                  <div className="h-8 w-8 rounded-xl bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center">
                    <GraduationCap className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-black tracking-tighter text-orange-600 dark:text-orange-400">
                    {data.groups?.length || 0}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {data.groups?.slice(0, 2).map((g: any) => (
                      <Badge key={g.id} variant="secondary" className="text-[10px] bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 border-0">{g.name}</Badge>
                    ))}
                    {data.groups?.length > 2 && <span className="text-xs text-muted-foreground">+{data.groups.length - 2}</span>}
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-0 shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/30 pb-4">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" /> 
              Динамика посещаемости (по месяцам)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={isAdmin ? adminTrendData : teacherTrendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10" />
                  <XAxis dataKey="month" stroke="currentColor" fontSize={12} className="opacity-50" tickMargin={10} axisLine={false} tickLine={false} />
                  <YAxis stroke="currentColor" fontSize={12} className="opacity-50" tickMargin={10} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    cursor={{ stroke: 'currentColor', strokeWidth: 1, strokeDasharray: '3 3', opacity: 0.2 }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Line type="monotone" name="Посещаемость %" dataKey="Посещаемость %" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/30 pb-4">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <PieChart className="h-5 w-5 text-primary" /> 
              Статус посещаемости
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 flex items-center justify-center">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={isAdmin ? adminPieData : teacherPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {(isAdmin ? adminPieData : teacherPieData).map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conditional Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/30 pb-4">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Посещаемость по группам
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={isAdmin ? adminGroupData : teacherGroupData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="currentColor" className="opacity-10" />
                  <XAxis type="number" domain={[0, 100]} stroke="currentColor" fontSize={12} className="opacity-50" tickMargin={10} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" width={80} stroke="currentColor" fontSize={12} className="opacity-50" axisLine={false} tickLine={false} />
                  <Tooltip 
                    cursor={{ fill: 'currentColor', opacity: 0.05 }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="Посещаемость %" fill="#6366f1" radius={[0, 4, 4, 0]}>
                    {(isAdmin ? adminGroupData : teacherGroupData).map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry["Посещаемость %"] < 50 ? "#ef4444" : entry["Посещаемость %"] < 80 ? "#f59e0b" : "#10b981"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {!isAdmin ? (
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/30 pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Динамика ЕНТ по вашим предметам
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-80">
                {teacherEntChartData.lines.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={teacherEntChartData.data}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10" />
                      <XAxis dataKey="month" stroke="currentColor" fontSize={12} className="opacity-50" tickMargin={10} axisLine={false} tickLine={false} />
                      <YAxis stroke="currentColor" fontSize={12} className="opacity-50" tickMargin={10} axisLine={false} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend iconType="circle" />
                      {teacherEntChartData.lines.map((subj, idx) => (
                        <Line 
                          key={subj} 
                          type="monotone" 
                          dataKey={subj} 
                          stroke={COLORS[idx % COLORS.length]} 
                          strokeWidth={3}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    Нет данных по ЕНТ для ваших групп
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/30 pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Требуют внимания (группы)
              </CardTitle>
              <CardDescription>Группы с посещаемостью ниже 80%</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-80 overflow-y-auto divide-y divide-border/50">
                {adminGroupData.filter(g => g["Посещаемость %"] < 80).sort((a,b) => a["Посещаемость %"] - b["Посещаемость %"]).length > 0 ? (
                  adminGroupData.filter(g => g["Посещаемость %"] < 80).sort((a,b) => a["Посещаемость %"] - b["Посещаемость %"]).map((g, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                      <div className="font-medium">{g.name}</div>
                      <div className="flex items-center gap-4">
                        <Badge variant={g["Посещаемость %"] < 50 ? "destructive" : "secondary"} className={g["Посещаемость %"] >= 50 ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" : ""}>
                          {g["Посещаемость %"]}%
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    Все группы показывают хорошую посещаемость! 🎉
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
