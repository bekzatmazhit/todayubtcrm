import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MessageSquare, Phone, Users, CheckCircle2, XCircle,
  Clock, Calendar, FileText, Activity,
  ChevronDown, ChevronUp,
} from "lucide-react";

type Props = { data: any };

const LOG_TYPE_CONFIG: Record<string, { label: string; icon: any; cls: string }> = {
  call:     { label: "Звонок",      icon: Phone,         cls: "bg-blue-100 text-blue-700 border-blue-200" },
  whatsapp: { label: "WhatsApp",    icon: MessageSquare,  cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  system:   { label: "Система",     icon: Activity,       cls: "bg-slate-100 text-slate-600 border-slate-200" },
  absence:  { label: "Пропуск",     icon: XCircle,        cls: "bg-red-100 text-red-700 border-red-200" },
  payment:  { label: "Оплата",      icon: CheckCircle2,   cls: "bg-violet-100 text-violet-700 border-violet-200" },
  feedback: { label: "Отзыв",       icon: MessageSquare,  cls: "bg-amber-100 text-amber-700 border-amber-200" },
  report:   { label: "Отчёт",       icon: FileText,       cls: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  exam:     { label: "Экзамен",     icon: CheckCircle2,   cls: "bg-teal-100 text-teal-700 border-teal-200" },
};

export default function CommunicationTab360({ data }: Props) {
  const { logs = [], curatorTasks = [], upcomingSchedule = [], parentPhone, teacherFeedback = [] } = data || {};
  const [logFilter, setLogFilter] = useState<string>("all");
  const [expandedLog, setExpandedLog] = useState<number | null>(null);

  const logTypes = ["all", ...Array.from(new Set(logs.map((l: any) => l.type))) as string[]];
  const filteredLogs = logFilter === "all" ? logs : logs.filter((l: any) => l.type === logFilter);

  return (
    <div className="space-y-6">
      {/* Parent contact info */}
      <Card className="border-amber-200/60 bg-amber-50/30 dark:bg-amber-950/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-amber-500" />
            Контакт родителя
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Телефон</p>
              <p className="text-sm font-semibold mt-0.5">{parentPhone || "Не указан"}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Предпочт. канал</p>
              <p className="text-sm font-semibold mt-0.5">WhatsApp</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              onClick={() => parentPhone && window.open(`https://wa.me/${parentPhone.replace(/\D/g, "")}`, "_blank")}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              WhatsApp
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
              onClick={() => parentPhone && window.open(`tel:${parentPhone}`, "_blank")}
            >
              <Phone className="h-3.5 w-3.5" />
              Позвонить
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <FileText className="h-3.5 w-3.5" />
              Отправить отчёт
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Teacher Feedback */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-amber-400" />
            Отзывы учителей
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {teacherFeedback.map((f: any, i: number) => (
              <div key={i} className="border rounded-xl p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{f.teacherName}</p>
                    <p className="text-xs text-muted-foreground">{f.subject}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <CheckCircle2 className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <span className="text-xs font-bold">{f.rating || 5}</span>
                  </div>
                </div>
                <blockquote className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-2">
                  "{f.comment}"
                </blockquote>
                <p className="text-[10px] text-muted-foreground">{f.month}</p>
              </div>
            ))}
            {teacherFeedback.length === 0 && (
              <p className="text-sm text-muted-foreground italic col-span-full text-center py-4">
                Нет отзывов от учителей
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Schedule */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-500" />
            Ближайшее расписание
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(upcomingSchedule || []).map((lesson: any, i: number) => {
              const isExam = lesson.type === "exam";
              const isMock = lesson.type === "mock_ent";
              return (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border",
                    isExam ? "bg-violet-50/50 border-violet-200 dark:bg-violet-950/10" :
                    isMock ? "bg-amber-50/50 border-amber-200 dark:bg-amber-950/10" :
                    "bg-muted/20"
                  )}
                >
                  <div className="text-center w-10 shrink-0">
                    <div className="text-[11px] font-semibold text-muted-foreground">{lesson.day}</div>
                    <div className="text-xs font-bold">{lesson.time}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{lesson.subject}</p>
                    <p className="text-[10px] text-muted-foreground">{lesson.teacher} · Кабинет {lesson.room}</p>
                  </div>
                  <div className="shrink-0">
                    {isExam ? (
                      <Badge className="text-[10px] bg-violet-100 text-violet-700 border-violet-200">Экзамен</Badge>
                    ) : isMock ? (
                      <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">Пробный ЕНТ</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        {lesson.type === "practice" ? "Практика" : "Лекция"}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
            {(upcomingSchedule || []).length === 0 && (
              <p className="text-sm text-muted-foreground italic text-center py-4">
                Нет предстоящих занятий
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Activity Log */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-slate-500" />
              Лог активности
            </CardTitle>
            {/* Filter pills */}
            <div className="flex flex-wrap gap-1">
              {logTypes.map(type => {
                const cfg = LOG_TYPE_CONFIG[type];
                return (
                  <button
                    key={type}
                    onClick={() => setLogFilter(type)}
                    className={cn(
                      "px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors border",
                      logFilter === type
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-muted-foreground border-transparent hover:border-muted-foreground/30"
                    )}
                  >
                    {type === "all" ? "Все" : cfg?.label || type}
                  </button>
                );
              })}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[18px] top-2 bottom-2 w-px bg-border" />

            <div className="space-y-3">
              {filteredLogs.map((log: any) => {
                const cfg = LOG_TYPE_CONFIG[log.type] || LOG_TYPE_CONFIG.system;
                const Icon = cfg.icon;
                const isExpanded = expandedLog === log.id;

                return (
                  <div key={log.id} className="flex gap-3 relative">
                    {/* Icon dot */}
                    <div className={cn(
                      "w-9 h-9 rounded-full border-2 border-background flex items-center justify-center shrink-0 z-10",
                      cfg.cls
                    )}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>

                    {/* Content */}
                    <div
                      className="flex-1 border rounded-lg p-2.5 cursor-pointer hover:bg-muted/20 transition-colors"
                      onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 border", cfg.cls)}>
                              {cfg.label}
                            </Badge>
                            <span className="text-xs font-semibold">{log.action}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {log.actor} · {log.date} {log.time}
                          </p>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                      </div>

                      {isExpanded && (
                        <div className="mt-2 pt-2 border-t text-xs text-muted-foreground leading-relaxed">
                          {log.details}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {filteredLogs.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Нет записей для выбранного фильтра</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
