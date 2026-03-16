import { useState, useEffect } from "react";
import { BarChart3, Users, TrendingUp, TrendingDown, AlertTriangle, UserX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { fetchAttendanceStats, fetchGroups, fetchStudents } from "@/lib/api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from "recharts";

const COLORS = ["#6366f1", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [months, setMonths] = useState("6");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchAttendanceStats(parseInt(months)),
      fetchGroups(),
      fetchStudents(),
    ]).then(([s, g, st]) => {
      setStats(s);
      setGroups(g);
      setStudents(st);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [months]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-heading font-bold">Дашборд</h1>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <Card key={i} className="animate-pulse"><CardContent className="p-5 h-24" /></Card>
          ))}
        </div>
      </div>
    );
  }

  const overall = stats?.overall || { total_present: 0, total_absent: 0, total_late: 0, total_records: 0 };
  const attendanceRate = overall.total_records > 0
    ? Math.round((overall.total_present / overall.total_records) * 100)
    : 0;

  // Build monthly trend data
  const monthlyMap = new Map<string, { present: number; absent: number; late: number }>();
  for (const row of (stats?.byGroup || [])) {
    const existing = monthlyMap.get(row.month) || { present: 0, absent: 0, late: 0 };
    existing.present += row.present_count;
    existing.absent += row.absent_count;
    existing.late += row.late_count;
    monthlyMap.set(row.month, existing);
  }
  const trendData = [...monthlyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month: month.slice(5), // "MM"
      Присутствие: data.present,
      Отсутствие: data.absent,
      Опоздания: data.late,
    }));

  // Build group comparison data
  const groupMap = new Map<string, { present: number; absent: number; total: number }>();
  for (const row of (stats?.byGroup || [])) {
    const existing = groupMap.get(row.group_name) || { present: 0, absent: 0, total: 0 };
    existing.present += row.present_count;
    existing.absent += row.absent_count;
    existing.total += row.total_records;
    groupMap.set(row.group_name, existing);
  }
  const groupData = [...groupMap.entries()].map(([name, data]) => ({
    name,
    "Посещаемость %": data.total > 0 ? Math.round((data.present / data.total) * 100) : 0,
    Отсутствия: data.absent,
  }));

  // Pie chart data
  const pieData = [
    { name: "Присутствие", value: overall.total_present, color: "#10b981" },
    { name: "Отсутствие", value: overall.total_absent, color: "#ef4444" },
    { name: "Опоздания", value: overall.total_late, color: "#f59e0b" },
  ].filter(d => d.value > 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-heading font-bold">Дашборд</h1>
        </div>
        <Select value={months} onValueChange={setMonths}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Последний месяц</SelectItem>
            <SelectItem value="3">3 месяца</SelectItem>
            <SelectItem value="6">6 месяцев</SelectItem>
            <SelectItem value="12">12 месяцев</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold">{attendanceRate}%</p>
              <p className="text-sm text-muted-foreground">Посещаемость</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500 flex items-center justify-center">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold">{students.filter((s: any) => s.status === 'active').length}</p>
              <p className="text-sm text-muted-foreground">Активных студентов</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-red-500 flex items-center justify-center">
              <TrendingDown className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold">{overall.total_absent}</p>
              <p className="text-sm text-muted-foreground">Всего пропусков</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold">{overall.total_late}</p>
              <p className="text-sm text-muted-foreground">Опоздания</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly trend */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Динамика посещаемости по месяцам</CardTitle>
          </CardHeader>
          <CardContent>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="Присутствие" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="Отсутствие" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="Опоздания" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Нет данных за выбранный период
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pie chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Общая статистика</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Нет данных
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Group comparison + top absent */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar chart by group */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Посещаемость по группам</CardTitle>
          </CardHeader>
          <CardContent>
            {groupData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={groupData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Посещаемость %" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Отсутствия" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Нет данных
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top absent students */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserX className="h-4 w-4 text-red-500" />
              Топ пропусков
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(stats?.topAbsent || []).length > 0 ? (
              stats.topAbsent.map((s: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{s.full_name}</p>
                    <p className="text-xs text-muted-foreground">{s.group_name}</p>
                  </div>
                  <Badge variant="destructive" className="ml-2 shrink-0">{s.absent_count}</Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Нет данных</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
