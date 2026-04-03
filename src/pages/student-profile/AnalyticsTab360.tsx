import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  TrendingUp, AlertTriangle, CheckCircle2,
  Target, Calendar, Star, Zap,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Area, AreaChart,
} from "recharts";

type Props = { data: any };

const SUBJECT_COLORS: Record<string, string> = {
  "Математическая грамотность": "#6366f1",
  "Читательская грамотность":   "#0ea5e9",
  "История Казахстана":         "#f59e0b",
  "Физика":                     "#10b981",
  "Математика":                 "#ef4444",
};

export default function AnalyticsTab360({ data }: Props) {
  const { entResults, attendance, homework, hero, entForecast } = data;

  // ── Prepare line chart data: total ENT per month ──────────────────────────
  const entTrendData = entResults?.length > 0 ? entResults.map((r: any) => ({
    month: r?.label || '',
    "Балл": r?.total || 0,
    "Цель": hero?.entTarget || 0,
  })) : [];

  // ── Radar chart: subject scores vs max (latest month) ─────────────────────
  const latestEnt = entResults?.length > 0 ? entResults[entResults.length - 1] : null;
  const radarData = latestEnt?.subjects ? latestEnt.subjects.map((s: any) => ({
    subject: s?.name?.split(" ")?.[0] || '',
    fullName: s?.name || '',
    "Ученик": s?.score && s?.max ? Math.round((s.score / s.max) * 100) : 0,
    "Группа": s?.groupAvg && s?.max ? Math.round((s.groupAvg / s.max) * 100) : 0,
  })) : [];

  // ── Attendance area chart ─────────────────────────────────────────────────
  const attendanceData = attendance?.byMonth ? attendance.byMonth.map((m: any) => ({
    month: m?.month || '',
    "Присутствовал": m?.present || 0,
    "Пропустил": m?.absent || 0,
    "Опоздал": m?.late || 0,
    "%": m?.rate || 0,
  })) : [];

  // ── Homework bar chart by subject ─────────────────────────────────────────
  const hwData = homework?.bySubject ? homework.bySubject.map((s: any) => ({
    subject: s?.subject?.split(" ")?.[0] || '',
    "%": s?.rate || 0,
    "Ср. оценка": s?.avgGrade || 0,
  })) : [];

  // ── Score delta per subject ───────────────────────────────────────────────
  const first = entResults?.[0];
  const last = entResults?.[entResults?.length - 1];
  const subjectDelta = last?.subjects ? last.subjects.map((s: any) => {
    const firstSubj = first?.subjects?.find((fs: any) => fs?.name === s?.name);
    const delta = firstSubj ? (s?.score || 0) - (firstSubj.score || 0) : 0;
    return {
      name: s?.name || '',
      delta,
      current: s?.score || 0,
      max: s?.max || 100,
      pct: s?.score && s?.max ? Math.round((s.score / s.max) * 100) : 0
    };
  }) : [];

  return (
    <div className="space-y-6">
      {/* Row 1: Risk Factors */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Факторы риска
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {[
            { label: "Посещаемость",  value: hero?.attendanceRate !== undefined ? 100 - hero.attendanceRate : 0, icon: Calendar, good: hero?.attendanceRate !== undefined ? hero.attendanceRate >= 85 : false },
            { label: "Сдача ДЗ",     value: hero?.homeworkRate !== undefined ? 100 - hero.homeworkRate : 0,   icon: CheckCircle2, good: hero?.homeworkRate !== undefined ? hero.homeworkRate >= 80 : false },
            { label: "Долг",         value: hero?.debtAmount !== undefined ? (hero.debtAmount > 0 ? 40 : 0) : 0, icon: AlertTriangle, good: hero?.debtAmount !== undefined ? hero.debtAmount === 0 : false },
          ].filter(f => f.label).map((factor, i) => {
            const Icon = factor.icon;
            return (
              <div key={i} className="flex items-center gap-2">
                <Icon className={cn("h-3.5 w-3.5 shrink-0", factor.good ? "text-emerald-500" : "text-amber-500")} />
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-0.5">
                    <span>{factor.label}</span>
                    <span className={factor.good ? "text-emerald-600" : "text-amber-600"}>
                      {factor.good ? "OK" : `+${factor.value}% риск`}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", factor.good ? "bg-emerald-400" : "bg-amber-400")}
                      style={{ width: `${Math.min(factor.value, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
          <div className="pt-1 border-t mt-2">
            <div className="flex justify-between text-xs font-medium">
              <span>Прогресс к цели ЕНТ</span>
              <span className="text-emerald-600 font-bold">
                {hero.entProgressPct}%
              </span>
            </div>
            <Progress value={hero.entProgressPct} className="h-2 mt-1" />
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {hero.entLastScore} из {hero.entTarget} баллов (Δ+{hero.entDelta})
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Row 2: ENT Trend Line Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-violet-500" />
              Динамика ЕНТ (тотал, 7 месяцев)
            </CardTitle>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Старт: <strong>{entResults?.[0]?.total || 0}</strong></span>
              <span>→</span>
              <span>Сейчас: <strong>{entResults?.[entResults?.length - 1]?.total || 0}</strong></span>
              <span className="text-emerald-600 font-bold">
                Δ+{(entResults?.[entResults?.length - 1]?.total || 0) - (entResults?.[0]?.total || 0)}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={entTrendData}>
              <defs>
                <linearGradient id="entGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis domain={[60, 140]} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(val: any, name: string) => [`${val} б.`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={hero.entTarget} stroke="#ef4444" strokeDasharray="4 4" label={{ value: `Цель: ${hero.entTarget}`, position: "insideTopRight", fontSize: 10, fill: "#ef4444" }} />
              <Area type="monotone" dataKey="Балл" stroke="#6366f1" strokeWidth={2.5} fill="url(#entGrad)" dot={{ r: 5, fill: "#6366f1" }} activeDot={{ r: 7 }} />
              <Line type="monotone" dataKey="Цель" stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Row 3: Subject Delta + Radar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Subject-by-subject deltas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-500" />
              Прогресс по предметам (сен → мар)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {subjectDelta.map((s: any) => (
              <div key={s.name}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium truncate max-w-[180px]">{s.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-muted-foreground">{s.current}/{s.max}</span>
                    <span className={cn("font-bold", s.delta > 0 ? "text-emerald-600" : s.delta < 0 ? "text-red-600" : "text-muted-foreground")}>
                      {s.delta > 0 ? "+" : ""}{s.delta}
                    </span>
                    <span className="font-semibold">{s.pct}%</span>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${s.pct}%`,
                      background: SUBJECT_COLORS[s.name] || "#6366f1"
                    }}
                  />
                </div>
              </div>
            ))}
            <div className="pt-2 border-t text-xs text-muted-foreground">
              Слабые предметы: {" "}
              {entForecast?.weakSubjects ? entForecast.weakSubjects.map((w: string) => (
                <Badge key={w} variant="destructive" className="text-[10px] mr-1">{w}</Badge>
              )) : "Данные недоступны"}
            </div>
          </CardContent>
        </Card>

        {/* Radar chart: student vs group */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Профиль знаний vs Группа (март, %)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
                <Radar name="Ученик" dataKey="Ученик" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                <Radar name="Группа (ср)" dataKey="Группа" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.15} strokeDasharray="4 4" />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip formatter={(val: any) => [`${val}%`]} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Row 4: Attendance + Homework charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Attendance by month */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-emerald-500" />
              Посещаемость по месяцам
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={attendanceData} barSize={16}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Присутствовал" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Пропустил" fill="#ef4444" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Опоздал" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Homework completion rate by subject */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-blue-500" />
              Выполнение ДЗ по предметам (%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={hwData} layout="vertical" barSize={14}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <YAxis dataKey="subject" type="category" tick={{ fontSize: 10 }} width={80} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(val: any) => [`${val}%`]} />
                <Bar dataKey="%" radius={[0, 4, 4, 0]}>
                  {hwData.map((_: any, i: number) => (
                    <rect
                      key={i}
                      fill={hwData[i]["%"] >= 85 ? "#10b981" : hwData[i]["%"] >= 70 ? "#f59e0b" : "#ef4444"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Row 5: Summary stats */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-400" />
            Итоговые метрики
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "Рост ЕНТ за курс",   value: `+${(entResults?.[entResults?.length-1]?.total || 0) - (entResults?.[0]?.total || 0)} б.`, color: "text-emerald-600" },
            { label: "Серия посещаемости",  value: `${attendance?.streakDays || 0} дн.`,     color: "text-violet-600" },
            { label: "Ср. балл ДЗ",         value: `${homework?.avgGrade || 0}/5`,            color: "text-blue-600" },
            { label: "Место в группе",      value: `#${hero?.rankInGroup || '?'}/${hero?.groupSize || '?'}`, color: "text-amber-600" },
            { label: "Всего уроков",        value: `${attendance?.totalLessons || 0}`,        color: "text-slate-600" },
            { label: "Посещаемость",        value: `${hero?.attendanceRate || 0}%`,           color: "text-emerald-600" },
          ].filter(m => m.label).map((m, i) => (
            <div key={i} className="flex justify-between items-center py-1.5 border-b last:border-0">
              <span className="text-xs text-muted-foreground">{m.label}</span>
              <span className={cn("text-sm font-bold", m.color)}>{m.value}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
