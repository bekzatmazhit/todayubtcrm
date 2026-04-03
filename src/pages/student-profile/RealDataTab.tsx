import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  TrendingUp, Calendar, CheckCircle2, BookOpen, Users, FileText,
  Clock, Award, Target, Star,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area, ReferenceLine,
} from "recharts";

type Props = { data: any };

export default function RealDataTab({ data }: Props) {
  const { 
    entResults, 
    attendance, 
    homework, 
    teachers, 
    teacherFeedback,
    curatorTasks,
    logs,
    documents,
    group,
  } = data;

  // ENT trend data
  const entTrendData = entResults.map((r: any) => ({
    month: r.label.slice(0, 3),
    total: r.total,
  }));

  // Attendance by month
  const attendanceChartData = attendance.byMonth.map((m: any) => ({
    month: m.month,
    present: m.present,
    absent: m.absent,
    rate: m.rate,
  }));

  // Homework by subject
  const homeworkChartData = homework.bySubject.map((s: any) => ({
    subject: s.subject.split(" ").slice(0, 2).join(" "),
    rate: s.rate,
    submitted: s.submitted,
    total: s.total,
  }));

  return (
    <div className="space-y-6">
      {/* Group Info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-500" />
            Группа и куратор
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Группа</p>
              <p className="text-sm font-semibold mt-0.5">{group.name}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Куратор</p>
              <p className="text-sm font-semibold mt-0.5">{group.curatorName || "Не назначен"}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Статус</p>
              <Badge className={cn("mt-1", data.status === 'active' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                {data.status === 'active' ? "Активен" : "В группе риска"}
              </Badge>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Учителей</p>
              <p className="text-sm font-semibold mt-0.5">{teachers.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ENT Results Detail */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Award className="h-4 w-4 text-violet-500" />
              ЕНТ Результаты (детально)
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              {entResults.length} месяцев
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Latest month subjects */}
          {entResults.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">
                Последний месяц: <strong>{entResults[entResults.length - 1].label}</strong> — {entResults[entResults.length - 1].total} баллов
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {entResults[entResults.length - 1].subjects.map((subj: any, i: number) => (
                  <div key={i} className="border rounded-lg p-3">
                    <p className="text-xs font-medium truncate">{subj.name}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-lg font-bold text-violet-700">{subj.score}/{subj.max}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {Math.round((subj.score / subj.max) * 100)}%
                      </Badge>
                    </div>
                    <Progress value={(subj.score / subj.max) * 100} className="h-1.5 mt-2" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ENT Trend Chart */}
          <div className="pt-4 border-t">
            <ResponsiveContainer width="100%" height={200}>
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
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Area type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2.5} fill="url(#entGrad)" dot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Teachers List */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-blue-500" />
            Учителя предмета
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {teachers.map((t: any) => (
              <div key={t.id} className="border rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.subject}</p>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {t.id}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Teacher Feedback */}
      {teacherFeedback && teacherFeedback.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-400" />
              Отзывы учителей ({teacherFeedback.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {teacherFeedback.map((f: any, i: number) => (
              <div key={i} className="border-l-2 border-primary/30 pl-3 py-1">
                <p className="text-xs text-muted-foreground italic">"{f.comment}"</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] font-medium">{f.teacherName}</span>
                  <Badge variant="outline" className="text-[9px]">{f.subject || "Общий"}</Badge>
                  <span className="text-[10px] text-muted-foreground">{f.month}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Attendance Detail */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-emerald-500" />
              Посещаемость по месяцам
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={attendanceChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="present" fill="#10b981" radius={[3, 3, 0, 0]} name="Присутствовал" />
                <Bar dataKey="absent" fill="#ef4444" radius={[3, 3, 0, 0]} name="Отсутствовал" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-blue-500" />
              ДЗ по предметам
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={homeworkChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                <YAxis dataKey="subject" type="category" tick={{ fontSize: 9 }} width={80} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                  {homeworkChartData.map((_: any, i: number) => (
                    <rect
                      key={i}
                      fill={homeworkChartData[i].rate >= 85 ? "#10b981" : homeworkChartData[i].rate >= 70 ? "#f59e0b" : "#ef4444"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Attendance Records */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-500" />
              Последние посещения
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              {attendance.recentRecords?.length || 0} записей
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left p-2 text-muted-foreground font-medium">Дата</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Предмет</th>
                  <th className="text-left p-2 text-muted-foreground font-medium hidden md:table-cell">Учитель</th>
                  <th className="text-center p-2 text-muted-foreground font-medium">Статус</th>
                  <th className="text-center p-2 text-muted-foreground font-medium">ДЗ</th>
                </tr>
              </thead>
              <tbody>
                {attendance.recentRecords?.map((r: any, i: number) => (
                  <tr key={i} className={cn("border-b", r.status === "absent" && "bg-red-50/30 dark:bg-red-950/10")}>
                    <td className="p-2 font-medium">{r.date?.slice(5) || "—"}</td>
                    <td className="p-2">{r.subject || "—"}</td>
                    <td className="p-2 text-muted-foreground hidden md:table-cell">{r.teacher || "—"}</td>
                    <td className="p-2 text-center">
                      <Badge variant={r.status === "present" ? "outline" : "destructive"} className="text-[10px]">
                        {r.status === "present" ? "Присутствовал" : "Отсутствовал"}
                      </Badge>
                    </td>
                    <td className="p-2 text-center">
                      {r.homework === "done" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mx-auto" />
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Curator Tasks */}
      {curatorTasks && curatorTasks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-violet-500" />
              Задачи куратора
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {curatorTasks.map((task: any) => (
              <div
                key={task.id}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border",
                  task.status === "done" ? "opacity-60 bg-muted/30" : "bg-card"
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium", task.status === "done" && "line-through text-muted-foreground")}>
                    {task.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[10px] text-muted-foreground">{task.assignee || "—"}</span>
                    {task.dueDate && (
                      <span className="text-[10px] text-muted-foreground">
                        до {task.dueDate.slice(5)}
                      </span>
                    )}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[9px]",
                    task.status === "done" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                    task.status === "in_progress" ? "bg-blue-100 text-blue-700 border-blue-200" :
                    "bg-amber-100 text-amber-700 border-amber-200"
                  )}
                >
                  {task.status === "done" ? "Выполнено" : task.status === "in_progress" ? "В работе" : "Ожидает"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Activity Logs */}
      {logs && logs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-500" />
              Логи активности
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {logs.slice(0, 10).map((log: any) => (
              <div key={log.id} className="flex items-start gap-3 p-2.5 border rounded-lg">
                <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-blue-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{log.action}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{log.details}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground">{log.date}</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0">
                      {log.type}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Documents */}
      {documents && documents.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              Документы
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {documents.map((doc: any) => (
                <a
                  key={doc.id}
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border rounded-lg p-3 hover:bg-muted/50 transition-colors block"
                >
                  <p className="text-sm font-medium truncate">{doc.name}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant="outline" className="text-[10px]">{doc.type}</Badge>
                    <span className="text-[10px] text-muted-foreground">{doc.uploadedAt}</span>
                  </div>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
