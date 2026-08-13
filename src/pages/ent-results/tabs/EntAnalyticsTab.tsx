import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend,
  ResponsiveContainer, Area, AreaChart, BarChart, Bar,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Cell, LabelList, Tooltip
} from "recharts";
import { TrendingUp } from "lucide-react";
import { TOTAL_MAX } from "@/pages/EntResultsPage";
import { MONTH_LABELS, MONTH_SHORT, CHART_COLORS, MANDATORY_SUBJECTS } from "@/pages/ent-results/constants";

interface RawEntResult {
  id: number; student_id: number; subject_id: number; score: number;
  month: string; student_name: string; subject_name: string;
  group_id: number; group_name: string;
}

export interface EntAnalyticsTabProps {
  modeAllData: RawEntResult[];
  activeMonthsList: { value: string; label: string; short: string }[];
  profileSubjects: { id: number; name: string; short: string; max: number }[];
  isAllGroups: boolean;
  activeDisplaySubjects: { id: number; name: string; short: string; max: number }[];
}

export function EntAnalyticsTab({
  modeAllData,
  activeMonthsList,
  profileSubjects,
  isAllGroups,
  activeDisplaySubjects,
}: EntAnalyticsTabProps) {
  const [chartStudentId, setChartStudentId] = useState("avg");

  const chartStudentsList = useMemo(() => {
    const names: Record<number, string> = {};
    for (const r of modeAllData) names[r.student_id] = r.student_name;
    return Object.entries(names).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [modeAllData]);

  const chartLines = useMemo(() => {
    if (chartStudentId === "avg") return ["Средний балл"];
    const student = chartStudentsList.find(s => s.id === chartStudentId);
    return [student?.name || "Ученик", "Средний по группе"];
  }, [chartStudentId, chartStudentsList]);

  const chartData = useMemo(() => {
    const studentMonths: Record<string, Record<string, number>> = {};
    const studentNames: Record<number, string> = {};
    for (const r of modeAllData) {
      studentNames[r.student_id] = r.student_name;
      const sid = String(r.student_id);
      if (!studentMonths[sid]) studentMonths[sid] = {};
      if (!studentMonths[sid][r.month]) studentMonths[sid][r.month] = 0;
      studentMonths[sid][r.month] += r.score;
    }
    const months = activeMonthsList.map(m => m.value);
    const avgByMonth: Record<string, { sum: number; count: number }> = {};
    for (const sid of Object.keys(studentMonths)) {
      for (const m of months) {
        const t = studentMonths[sid]?.[m] || 0; 
        if (t === 0) continue; 
        if (!avgByMonth[m]) avgByMonth[m] = { sum: 0, count: 0 }; 
        avgByMonth[m].sum += t; 
        avgByMonth[m].count++;
      }
    }

    if (chartStudentId === "avg") {
      return months.filter(m => avgByMonth[m]).map(m => ({
        month: MONTH_SHORT[m] || m, monthFull: MONTH_LABELS[m] || m,
        ["Средний балл"]: avgByMonth[m] ? Math.round(avgByMonth[m].sum / avgByMonth[m].count) : 0,
      }));
    }
    const sid = chartStudentId;
    const name = studentNames[parseInt(sid)] || "Ученик";
    return months.filter(m => (studentMonths[sid]?.[m] || 0) > 0 || avgByMonth[m]).map(m => {
      const pt: Record<string, string | number> = { month: MONTH_SHORT[m] || m, monthFull: MONTH_LABELS[m] || m };
      const st = studentMonths[sid]?.[m] || 0;
      if (st > 0) pt[name] = st;
      if (avgByMonth[m]) pt["Средний по группе"] = Math.round(avgByMonth[m].sum / avgByMonth[m].count);
      return pt;
    });
  }, [modeAllData, chartStudentId, activeMonthsList]);

  const subjectChartData = useMemo(() => {
    if (chartStudentId === "avg") return [];
    const sid = parseInt(chartStudentId);
    const studentData = modeAllData.filter(r => r.student_id === sid);
    const months = activeMonthsList.map(m => m.value).filter(m => studentData.some(r => r.month === m));
    return months.map(m => {
      const point: Record<string, string | number> = { month: MONTH_SHORT[m] || m };
      for (const s of profileSubjects) {
        const entry = studentData.find(r => r.month === m && r.subject_id === s.id);
        if (entry) point[s.short] = entry.score;
      }
      return point;
    });
  }, [modeAllData, activeMonthsList, chartStudentId, profileSubjects]);

  const stackedChartData = useMemo(() => {
    if (chartStudentId === "avg") {
      const months = activeMonthsList.map(m => m.value);
      const subjectSums: Record<string, Record<number, { sum: number; count: number }>> = {};
      for (const r of modeAllData) {
        if (!subjectSums[r.month]) subjectSums[r.month] = {};
        if (!subjectSums[r.month][r.subject_id]) subjectSums[r.month][r.subject_id] = { sum: 0, count: 0 };
        subjectSums[r.month][r.subject_id].sum += r.score;
        subjectSums[r.month][r.subject_id].count++;
      }
      const displaySubjects = activeDisplaySubjects;
      return months.filter(m => subjectSums[m]).map(m => {
        const point: Record<string, string | number> = { month: MONTH_SHORT[m] || m, monthFull: MONTH_LABELS[m] || m };
        let total = 0;
        for (const s of displaySubjects) {
          const val = subjectSums[m]?.[s.id] ? Math.round(subjectSums[m][s.id].sum / subjectSums[m][s.id].count) : 0;
          point[s.short] = val;
          total += val;
        }
        point["Итого"] = total;
        return point;
      });
    }
    const sid = parseInt(chartStudentId);
    const studentData = modeAllData.filter(r => r.student_id === sid);
    const months = activeMonthsList.map(m => m.value).filter(m => studentData.some(r => r.month === m));
    return months.map(m => {
      const point: Record<string, string | number> = { month: MONTH_SHORT[m] || m, monthFull: MONTH_LABELS[m] || m };
      let total = 0;
      for (const s of profileSubjects) {
        const entry = studentData.find(r => r.month === m && r.subject_id === s.id);
        const val = entry ? entry.score : 0;
        point[s.short] = val;
        total += val;
      }
      point["Итого"] = total;
      return point;
    });
  }, [modeAllData, activeMonthsList, chartStudentId, profileSubjects, isAllGroups, activeDisplaySubjects]);

  const radarData = useMemo(() => {
    if (stackedChartData.length === 0) return [];
    const latest = stackedChartData[stackedChartData.length - 1];
    const displaySubjects = (chartStudentId === "avg" && isAllGroups) ? activeDisplaySubjects : profileSubjects;
    return displaySubjects.map(s => ({
      subject: s.short,
      fullName: s.name,
      score: (latest[s.short] as number) || 0,
      max: s.max,
      percent: Math.round(((latest[s.short] as number) || 0) / s.max * 100),
    }));
  }, [stackedChartData, profileSubjects, isAllGroups, chartStudentId, activeDisplaySubjects]);

  return (
    <>
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div className="space-y-1">
          <Label className="text-xs">Ученик</Label>
          <Select value={chartStudentId} onValueChange={setChartStudentId}>
            <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="avg">📊 Среднее по группе</SelectItem>
              {chartStudentsList.map(s => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {stackedChartData.length === 0 ? (
        <Card className="text-center py-16"><CardContent>
          <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground/20 mb-3" />
          <p className="text-muted-foreground">Нет данных для графика</p>
        </CardContent></Card>
      ) : (
        <>
          <Card className="mb-5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Баллы по предметам · {chartStudentId === "avg" ? "Среднее по группе" : chartStudentsList.find(s => s.id === chartStudentId)?.name}
              </CardTitle>
              <p className="text-xs text-muted-foreground">Каждый столбец показывает вклад предмета в общий балл</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={stackedChartData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, TOTAL_MAX]} tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ fontSize: 13, borderRadius: 8 }}
                    labelFormatter={label => { const pt = stackedChartData.find((d: any) => d.month === label) as any; return pt?.monthFull || label; }}
                    formatter={(value: number, name: string) => [value, name]}
                  />
                  <Legend />
                  {((chartStudentId === "avg" && isAllGroups) ? MANDATORY_SUBJECTS : profileSubjects).map((s, i) => (
                    <Bar key={s.id} dataKey={s.short} name={s.name} stackId="total"
                      fill={CHART_COLORS[i % CHART_COLORS.length]} radius={i === ((chartStudentId === "avg" && isAllGroups) ? MANDATORY_SUBJECTS : profileSubjects).length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}>
                      {i === ((chartStudentId === "avg" && isAllGroups) ? MANDATORY_SUBJECTS : profileSubjects).length - 1 && (
                        <LabelList dataKey="Итого" position="top" fontSize={11} fontWeight={700} fill="#6366f1" />
                      )}
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {radarData.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Профиль предметов (последний месяц)</CardTitle>
                  <p className="text-xs text-muted-foreground">Процент от максимума по каждому предмету</p>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fontWeight: 600 }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} angle={90} />
                      <Tooltip
                        contentStyle={{ fontSize: 13, borderRadius: 8 }}
                        formatter={(value: number, _name: string, props: any) => [`${props.payload.score}/${props.payload.max} (${value}%)`, props.payload.fullName]}
                      />
                      <Radar dataKey="percent" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} strokeWidth={2} dot={{ r: 4, fill: "#6366f1" }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Динамика общего балла</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, TOTAL_MAX]} tick={{ fontSize: 12 }} />
                    <RechartsTooltip contentStyle={{ fontSize: 13, borderRadius: 8 }}
                      labelFormatter={label => { const pt = chartData.find((d: any) => d.month === label) as any; return pt?.monthFull || label; }} />
                    <Legend />
                    {chartLines.map((name, i) => (
                      <Area key={name} type="monotone" dataKey={name}
                        stroke={i === 0 ? "#6366f1" : "#94a3b8"} strokeWidth={i === 0 ? 3 : 1.5}
                        fill={i === 0 ? "url(#colorTotal)" : "url(#colorAvg)"}
                        dot={{ r: i === 0 ? 5 : 3, fill: i === 0 ? "#6366f1" : "#94a3b8" }} connectNulls />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {chartStudentId !== "avg" && subjectChartData.length > 0 && (
            <Card className="mt-5">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Динамика по предметам</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={subjectChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 50]} tick={{ fontSize: 12 }} />
                    <RechartsTooltip contentStyle={{ fontSize: 13, borderRadius: 8 }} />
                    <Legend />
                    {profileSubjects.map((s, i) => (
                      <Line key={s.id} type="monotone" dataKey={s.short} name={`${s.name} (/${s.max})`}
                        stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2.5}
                        dot={{ r: 4, fill: CHART_COLORS[i % CHART_COLORS.length] }} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </>
  );
}
