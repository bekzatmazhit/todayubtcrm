import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MessageCircle, Phone, Mail, Calendar, Clock, User,
  FileText, AlertCircle, CheckCircle2, XCircle,
  ChevronDown, ChevronUp, Search, Filter,
} from "lucide-react";

type Props = { data: any };

const typeConfig: Record<string, { label: string; icon: any; cls: string }> = {
  call: { label: "Звонок", icon: Phone, cls: "bg-blue-100 text-blue-700 border-blue-200" },
  whatsapp: { label: "WhatsApp", icon: MessageCircle, cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  email: { label: "Email", icon: Mail, cls: "bg-violet-100 text-violet-700 border-violet-200" },
  meeting: { label: "Встреча", icon: User, cls: "bg-amber-100 text-amber-700 border-amber-200" },
  system: { label: "Система", icon: AlertCircle, cls: "bg-slate-100 text-slate-600 border-slate-200" },
  task: { label: "Задача", icon: FileText, cls: "bg-indigo-100 text-indigo-700 border-indigo-200" },
};

const statusConfig: Record<string, { label: string; cls: string }> = {
  completed: { label: "Завершено", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  pending: { label: "В ожидании", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  "in-progress": { label: "В работе", cls: "bg-blue-100 text-blue-700 border-blue-200" },
  cancelled: { label: "Отменено", cls: "bg-red-100 text-red-700 border-red-200" },
};

export default function CommsLogTab({ data }: Props) {
  const [filter, setFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const types = ["all", ...Array.from(new Set(data.map((l: any) => l.type))) as string[]];

  const filteredLogs = data.filter((l: any) => {
    const matchesType = filter === "all" || l.type === filter;
    const matchesSearch = searchQuery === "" ||
      l.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.author.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const stats = {
    total: data.length,
    completed: data.filter((l: any) => l.status === "Завершено" || l.status === "completed").length,
    pending: data.filter((l: any) => l.status === "В работе" || l.status === "pending").length,
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">Всего записей</span>
              <MessageCircle className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-2xl font-black">{stats.total}</div>
            <div className="text-[10px] text-muted-foreground mt-1">Все коммуникации</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">Завершено</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-emerald-600">{stats.completed}</div>
            <div className="text-[10px] text-muted-foreground mt-1">Обработано</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">В работе</span>
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-amber-600">{stats.pending}</div>
            <div className="text-[10px] text-muted-foreground mt-1">Требуют внимания</div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Поиск по записям..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Filter */}
            <div className="flex items-center gap-1 flex-wrap">
              <Filter className="h-4 w-4 text-muted-foreground mr-1" />
              {types.map((type) => {
                const cfg = typeConfig[type];
                return (
                  <button
                    key={type}
                    onClick={() => setFilter(type)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border",
                      filter === type
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
        </CardContent>
      </Card>

      {/* Logs Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Лог коммуникаций</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredLogs.map((log: any) => {
              const cfg = typeConfig[log.type] || typeConfig.system;
              const Icon = cfg.icon;
              const isExpanded = expandedId === log.id;

              return (
                <div key={log.id} className="flex gap-3">
                  {/* Icon */}
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 border-background",
                    cfg.cls
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>

                  {/* Content */}
                  <div
                    className="flex-1 border rounded-lg p-3 cursor-pointer hover:bg-muted/20 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0", cfg.cls)}>
                            {cfg.label}
                          </Badge>
                          <span className="text-sm font-semibold">{log.text}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{log.author}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(log.date).toLocaleDateString("ru-RU")}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {log.status && (
                          <Badge variant="outline" className="text-[9px]">
                            {log.status}
                          </Badge>
                        )}
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {isExpanded && log.details && (
                      <div className="mt-3 pt-3 border-t text-sm text-muted-foreground leading-relaxed">
                        {log.details}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredLogs.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">Записей не найдено</p>
              <p className="text-xs mt-1">
                {searchQuery ? "Попробуйте изменить поисковый запрос" : "Коммуникации еще не велись"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Note */}
      <Card className="border-blue-200 bg-blue-50/30 dark:bg-blue-950/10">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                О логе коммуникаций
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-400">
                Здесь отображаются все взаимодействия с родителями и учеником: звонки, сообщения в WhatsApp,
                встречи и системные уведомления. Используйте фильтры для быстрого поиска нужной записи.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
