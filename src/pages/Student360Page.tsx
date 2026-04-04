import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { addExcelWatermarkSheet } from "@/lib/watermark";
import {
  ChevronRight, Phone, MessageSquare, Download, AlertTriangle,
  TrendingUp, TrendingDown, Calendar, BookOpen, Zap, Users,
  Award, Clock, Loader2, ShieldAlert, CheckCircle2, XCircle,
  BookMarked, BookX, Activity, Star, Minus, ArrowLeft, ClipboardList,
  FileText, Upload, Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import i18n from "@/lib/i18n";
import {
  fetchStudentCertificates,
  uploadStudentCertificate,
  deleteStudentCertificate,
  type StudentCertificate,
  type StudentCertificateType,
} from "@/lib/api";
import { toast } from "sonner";
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import GradesTab360 from "./student-profile/GradesTab360";

/* ═══════════════════════════════════════════════════════════════════════════
   DATA FETCH
   ═══════════════════════════════════════════════════════════════════════════ */
const fetchStudent360 = async (id: string) => {
  const token = localStorage.getItem("today_crm_token");
  const res = await fetch(`/api/student-360/${id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
};

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */
type RiskLevel = "low" | "mid" | "high";

function calcRisk(h: any): { score: number; level: RiskLevel } {
  let s = 0;
  if (h.attendanceRate < 90) s += 30;
  if (h.attendanceRate < 80) s += 20;
  if (h.homeworkRate < 80) s += 30;
  if (h.entDelta !== null && h.entDelta < 0) s += 40;
  s = Math.min(100, s);
  return { score: s, level: s < 30 ? "low" : s < 60 ? "mid" : "high" };
}

const RISK = {
  low:  { label: "Низкий риск",  dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" },
  mid:  { label: "Средний риск", dot: "bg-amber-500",   badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200 dark:border-amber-800" },
  high: { label: "Высокий риск", dot: "bg-red-500",     badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border-red-200 dark:border-red-800" },
};

const SUBJECT_COLORS: Record<string, string> = {
  "математическ": "#6366f1", "читательск": "#0ea5e9", "история": "#f59e0b",
  "физик": "#10b981", "математик": "#ef4444", "хими": "#8b5cf6",
  "биологи": "#14b8a6", "английск": "#f97316",
};

function subjectColor(sub: string) {
  const l = sub.toLowerCase();
  for (const [k, v] of Object.entries(SUBJECT_COLORS)) { if (l.includes(k)) return v; }
  return "#94a3b8";
}

function fmtDate(d: string) {
  if (!d) return "—";
  const locale = { ru: "ru-RU", kk: "kk-KZ", en: "en-US" }[i18n.language] ?? "ru-RU";
  try { return new Date(d).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }); }
  catch { return d; }
}

function fmtDateShort(d: string) {
  if (!d) return "—";
  const locale = { ru: "ru-RU", kk: "kk-KZ", en: "en-US" }[i18n.language] ?? "ru-RU";
  try { return new Date(d).toLocaleDateString(locale, { day: "numeric", month: "short" }); }
  catch { return d; }
}

/* ═══════════════════════════════════════════════════════════════════════════
   SMALL COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */
function AttIcon({ status, lateness }: { status: string; lateness?: string }) {
  if (status === "present") {
    if (lateness === "on_time" || !lateness) return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    return <Clock className="h-4 w-4 text-amber-500" />;
  }
  return <XCircle className="h-4 w-4 text-red-500" />;
}

function HwIcon({ hw }: { hw: string }) {
  if (hw === "done") return <BookOpen className="h-3.5 w-3.5 text-emerald-500" />;
  if (hw === "partial") return <BookMarked className="h-3.5 w-3.5 text-amber-500" />;
  return <BookX className="h-3.5 w-3.5 text-muted-foreground/60" />;
}

function StatCard({
  label, value, sub, icon: Icon, accent = "default",
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "green" | "red" | "amber" | "violet" | "blue" | "default";
}) {
  const iconCls = {
    default: "text-muted-foreground",
    green:   "text-emerald-500",
    red:     "text-red-500",
    amber:   "text-amber-500",
    violet:  "text-muted-foreground",
    blue:    "text-primary",
  }[accent];
  return (
    <div className="bg-card rounded-xl border p-4 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className={cn("h-4 w-4", iconCls)} />
      </div>
      <span className="text-2xl font-bold leading-none tracking-tight text-foreground">{value}</span>
      {sub && <span className="text-[11px] text-muted-foreground leading-tight">{sub}</span>}
    </div>
  );
}

function TabBtn({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
        active
          ? "text-primary after:absolute after:bottom-0 after:inset-x-0 after:h-0.5 after:bg-primary after:rounded-full"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SKELETON
   ═══════════════════════════════════════════════════════════════════════════ */
function PageSkeleton() {
  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <Skeleton className="h-5 w-48" />
      <div className="flex gap-5">
        <Skeleton className="h-20 w-20 rounded-2xl shrink-0" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-8 w-60" />
          <Skeleton className="h-4 w-96" />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   OVERVIEW TAB
   ═══════════════════════════════════════════════════════════════════════════ */
function OverviewTab({ s }: { s: any }) {
  const recent: any[] = (s.attendance?.records ?? []).slice(0, 10);
  const bySub: any[] = s.attendance?.bySubject ?? [];
  const entSub: any[] = s.ent?.bySubject ?? [];

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Attendance by subject */}
      {bySub.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" /> Посещаемость по предметам
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {bySub.map((row: any) => {
              const rate = row.rate ?? 0;
              return (
                <div key={row.subject}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium truncate max-w-[180px]" title={row.subject}>{row.subject}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-muted-foreground">{row.present}/{row.total}</span>
                      <span className={cn("font-bold tabular-nums",
                        rate >= 90 ? "text-emerald-600 dark:text-emerald-400" :
                        rate >= 75 ? "text-amber-600 dark:text-amber-400" :
                        "text-red-600 dark:text-red-400"
                      )}>{rate}%</span>
                    </div>
                  </div>
                  <Progress
                    value={rate}
                    className={cn("h-1.5",
                      rate >= 90 ? "[&>div]:bg-emerald-500" :
                      rate >= 75 ? "[&>div]:bg-amber-500" :
                      "[&>div]:bg-red-500"
                    )}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ENT by subject */}
      {entSub.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Star className="h-4 w-4 text-muted-foreground" /> ЕНТ по предметам
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2.5">
              {entSub.map((sub: any) => {
                const clr = subjectColor(sub.subject);
                return (
                  <div
                    key={sub.subject}
                    className="rounded-lg border p-3 space-y-1"
                    style={{ borderLeftColor: clr, borderLeftWidth: 3 }}
                  >
                    <div className="text-[11px] text-muted-foreground font-medium leading-tight truncate">{sub.subject}</div>
                    <div className="text-xl font-black" style={{ color: clr }}>{sub.score_avg ?? "—"}</div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>мин {sub.score_min ?? "—"}</span>
                      <span className="opacity-30">·</span>
                      <span>макс {sub.score_max ?? "—"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contact info */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" /> Контакты
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            {s.phone && (
              <div>
                <p className="text-[10px] uppercase text-muted-foreground tracking-wide mb-0.5">Ученик</p>
                <a href={`tel:${s.phone}`} className="font-semibold hover:underline">{s.phone}</a>
              </div>
            )}
            {s.parentPhone && (
              <div>
                <p className="text-[10px] uppercase text-muted-foreground tracking-wide mb-0.5">{s.parentName || "Родитель"}</p>
                <a href={`tel:${s.parentPhone}`} className="font-semibold hover:underline">{s.parentPhone}</a>
              </div>
            )}
            {s.group?.curatorName && (
              <div>
                <p className="text-[10px] uppercase text-muted-foreground tracking-wide mb-0.5">Куратор</p>
                <span className="font-semibold">{s.group.curatorName}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent lessons */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4" /> Последние занятия
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground italic text-center py-8">Нет данных</p>
          ) : (
            <div className="divide-y divide-border/50">
              {recent.map((r: any, i: number) => (
                <div key={i} className="py-2.5 flex items-center gap-3 text-sm">
                  <span className="w-16 shrink-0 text-xs text-muted-foreground tabular-nums">{fmtDateShort(r.date)}</span>
                  <AttIcon status={r.status} lateness={r.lateness} />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium truncate block">{r.subject ?? "—"}</span>
                    {r.teacher && <span className="text-[10px] text-muted-foreground">{r.teacher}</span>}
                  </div>
                  <HwIcon hw={r.homework} />
                  {r.lateness && r.lateness !== "on_time" && (
                    <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600 dark:text-amber-400">
                      <Clock className="h-2.5 w-2.5 mr-0.5" />
                      {r.lateness === "5m" ? "5 мин" : "15+ мин"}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quiz results */}
      {(s.quizzes ?? []).length > 0 && (
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-muted-foreground" /> Контрольные тесты
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-2.5 text-xs font-semibold text-muted-foreground">Дата</th>
                  <th className="text-left p-2.5 text-xs font-semibold text-muted-foreground">Название</th>
                  <th className="text-left p-2.5 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Предмет</th>
                  <th className="text-left p-2.5 text-xs font-semibold text-muted-foreground hidden md:table-cell">Учитель</th>
                  <th className="text-right p-2.5 text-xs font-semibold text-muted-foreground">Балл</th>
                </tr>
              </thead>
              <tbody>
                {(s.quizzes as any[]).map((q: any) => (
                  <tr key={q.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                    <td className="p-2.5 text-muted-foreground tabular-nums text-xs">{fmtDateShort(q.date)}</td>
                    <td className="p-2.5 font-medium">{q.title}</td>
                    <td className="p-2.5 text-muted-foreground hidden sm:table-cell">{q.subject_name ?? "—"}</td>
                    <td className="p-2.5 text-muted-foreground hidden md:table-cell">{q.teacher_name ?? "—"}</td>
                    <td className="p-2.5 text-right">
                      {q.score != null
                        ? <span className="font-bold tabular-nums text-primary">{q.score}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ATTENDANCE TAB
   ═══════════════════════════════════════════════════════════════════════════ */
function AttendanceTab({ s }: { s: any }) {
  const byMonth: any[] = s.attendance?.byMonth ?? [];
  const bySub: any[] = s.attendance?.bySubject ?? [];
  const records: any[] = s.attendance?.records ?? [];

  const chartData = byMonth.map((m: any) => ({
    month: m.month?.slice(5),
    "Присут.": m.present,
    "Пропуски": m.absent,
    "%": m.rate,
  }));

  return (
    <div className="space-y-5">
      {/* Area chart */}
      {byMonth.length > 1 && (
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4" /> Динамика по месяцам
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gPres" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gAbs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" strokeOpacity={0.5} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid var(--border)" }} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                  <Area type="monotone" dataKey="Присут." stroke="#10b981" fill="url(#gPres)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Пропуски" stroke="#ef4444" fill="url(#gAbs)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trend line */}
      {byMonth.length > 1 && (
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" /> % посещаемости — тренд
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" strokeOpacity={0.5} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid var(--border)" }} formatter={(v: any) => [`${v}%`, "Посещаемость"]} />
                  <ReferenceLine y={90} stroke="#10b981" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: "90%", position: "insideTopRight", fontSize: 10, fill: "#10b981" }} />
                  <Line type="monotone" dataKey="%" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(var(--primary))" }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* By subject */}
      {bySub.length > 0 && (
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BookOpen className="h-4 w-4" /> По предметам
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-2.5 text-xs font-semibold text-muted-foreground">Предмет</th>
                  <th className="text-center p-2.5 text-xs font-semibold text-muted-foreground">Всего</th>
                  <th className="text-center p-2.5 text-xs font-semibold text-muted-foreground">Присут.</th>
                  <th className="text-center p-2.5 text-xs font-semibold text-muted-foreground">Пропуск</th>
                  <th className="text-center p-2.5 text-xs font-semibold text-muted-foreground hidden sm:table-cell">ДЗ</th>
                  <th className="text-right p-2.5 text-xs font-semibold text-muted-foreground">%</th>
                </tr>
              </thead>
              <tbody>
                {bySub.map((r: any) => (
                  <tr key={r.subject} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                    <td className="p-2.5 font-medium truncate max-w-[180px]" title={r.subject}>{r.subject}</td>
                    <td className="p-2.5 text-center text-muted-foreground tabular-nums">{r.total}</td>
                    <td className="p-2.5 text-center text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">{r.present}</td>
                    <td className="p-2.5 text-center text-red-600 dark:text-red-400 tabular-nums">{r.absent}</td>
                    <td className="p-2.5 text-center text-violet-600 dark:text-violet-400 hidden sm:table-cell tabular-nums">{r.hw_done}</td>
                    <td className="p-2.5 text-right">
                      <span className={cn("font-bold tabular-nums",
                        r.rate >= 90 ? "text-emerald-600 dark:text-emerald-400" :
                        r.rate >= 75 ? "text-amber-600 dark:text-amber-400" :
                        "text-red-600 dark:text-red-400"
                      )}>{r.rate ?? "—"}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Full log */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Полный журнал
          </CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="text-sm text-muted-foreground italic text-center py-8">Нет записей</p>
          ) : (
            <div className="divide-y divide-border/50">
              {records.map((r: any, i: number) => (
                <div key={i} className="py-2.5 flex items-center gap-3 text-sm">
                  <span className="w-16 shrink-0 text-xs text-muted-foreground tabular-nums">{fmtDateShort(r.date)}</span>
                  <AttIcon status={r.status} lateness={r.lateness} />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium truncate block">{r.subject ?? "—"}</span>
                    {r.teacher && <span className="text-[10px] text-muted-foreground">{r.teacher}</span>}
                  </div>
                  <HwIcon hw={r.homework} />
                  {r.lateness && r.lateness !== "on_time" && (
                    <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600 dark:text-amber-400">
                      {r.lateness === "5m" ? "5 мин" : "15+ мин"}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   QUIZZES TAB
   ═══════════════════════════════════════════════════════════════════════════ */
function QuizzesTab({ s }: { s: any }) {
  const quizzes: any[] = s.quizzes ?? [];

  if (!quizzes.length) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          <ClipboardList className="mx-auto h-10 w-10 mb-3 opacity-40" />
          <p className="font-medium">Нет данных по контрольным тестам</p>
        </CardContent>
      </Card>
    );
  }

  const avgScore = Math.round(quizzes.reduce((a, q) => a + (q.score ?? 0), 0) / quizzes.length);
  const maxScore = Math.max(...quizzes.map(q => q.score ?? 0));

  // by-subject summary
  const subjMap: Record<string, { sum: number; count: number }> = {};
  for (const q of quizzes) {
    const sub = q.subject_name || "—";
    if (!subjMap[sub]) subjMap[sub] = { sum: 0, count: 0 };
    subjMap[sub].sum += q.score ?? 0;
    subjMap[sub].count++;
  }
  const bySubject = Object.entries(subjMap).map(([name, v]) => ({
    name, avg: Math.round(v.sum / v.count), count: v.count,
  })).sort((a, b) => b.avg - a.avg);

  // chart data — chronological
  const chartData = [...quizzes].reverse().map(q => ({
    date: fmtDateShort(q.date), score: q.score ?? 0, title: q.title,
  }));

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold">{quizzes.length}</p>
            <p className="text-xs text-muted-foreground">Тестов</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold">{avgScore}%</p>
            <p className="text-xs text-muted-foreground">Средний балл</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold">{maxScore}%</p>
            <p className="text-xs text-muted-foreground">Лучший</p>
          </CardContent>
        </Card>
      </div>

      {/* Score dynamics chart */}
      {chartData.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Динамика баллов</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, fontSize: 13 }}
                    formatter={(v: number, _: any, entry: any) => [`${v}%`, entry.payload.title]}
                  />
                  <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* By-subject breakdown */}
      {bySubject.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">По предметам</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {bySubject.map(sub => (
              <div key={sub.name} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full" style={{ background: subjectColor(sub.name) }} />
                <span className="text-sm flex-1 truncate">{sub.name}</span>
                <span className="text-sm font-medium">{sub.avg}%</span>
                <span className="text-xs text-muted-foreground">({sub.count})</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* All quizzes table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Все контрольные</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Дата</th>
                  <th className="px-4 py-2 font-medium">Название</th>
                  <th className="px-4 py-2 font-medium hidden sm:table-cell">Предмет</th>
                  <th className="px-4 py-2 font-medium hidden md:table-cell">Преподаватель</th>
                  <th className="px-4 py-2 font-medium text-right">Балл</th>
                </tr>
              </thead>
              <tbody>
                {quizzes.map(q => (
                  <tr key={q.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-2 whitespace-nowrap">{fmtDateShort(q.date)}</td>
                    <td className="px-4 py-2">{q.title}</td>
                    <td className="px-4 py-2 hidden sm:table-cell">
                      <Badge variant="outline" className="text-xs" style={{ borderColor: subjectColor(q.subject_name || ""), color: subjectColor(q.subject_name || "") }}>
                        {q.subject_name || "—"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground hidden md:table-cell">{q.teacher_name || "—"}</td>
                    <td className="px-4 py-2 text-right font-semibold">
                      <span className={cn(
                        (q.score ?? 0) >= 80 ? "text-emerald-600" : (q.score ?? 0) >= 50 ? "text-amber-600" : "text-red-500"
                      )}>
                        {q.score ?? 0}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMMUNICATION TAB
   ═══════════════════════════════════════════════════════════════════════════ */
function CommunicationTab({ s }: { s: any }) {
  const calls: any[] = s.callHistory ?? [];
  const tFeedback: any[] = s.teacherFeedback ?? [];
  const pFeedback: any[] = s.parentFeedback ?? [];
  const logs: any[] = s.curatorLogs ?? [];

  const callCfg: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    called:      { label: "Дозвонился",    cls: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400", icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" /> },
    not_reached: { label: "Не дозвонился", cls: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-400",                     icon: <XCircle className="h-4 w-4 text-red-400" /> },
    pending:     { label: "Ожидает",       cls: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-400",            icon: <Clock className="h-4 w-4 text-amber-400" /> },
  };

  return (
    <div className="space-y-5">
      {/* Contacts */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" /> Контакты
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-x-8 gap-y-3 mb-4 text-sm">
            {s.phone && (
              <div>
                <p className="text-[10px] uppercase text-muted-foreground tracking-wide mb-0.5">Ученик</p>
                <a href={`tel:${s.phone}`} className="font-semibold hover:underline">{s.phone}</a>
              </div>
            )}
            {s.parentPhone && (
              <div>
                <p className="text-[10px] uppercase text-muted-foreground tracking-wide mb-0.5">{s.parentName || "Родитель"}</p>
                <a href={`tel:${s.parentPhone}`} className="font-semibold hover:underline">{s.parentPhone}</a>
              </div>
            )}
            {s.group?.curatorName && (
              <div>
                <p className="text-[10px] uppercase text-muted-foreground tracking-wide mb-0.5">Куратор</p>
                <span className="font-semibold">{s.group.curatorName}</span>
                {s.group.curatorPhone && (
                  <a href={`tel:${s.group.curatorPhone}`} className="block text-xs text-muted-foreground hover:underline">{s.group.curatorPhone}</a>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline" size="sm" className="gap-1.5 text-xs"
              onClick={() => s.parentPhone && window.open(`https://wa.me/${s.parentPhone.replace(/\D/g, "")}`, "_blank")}
            >
              <MessageSquare className="h-3.5 w-3.5 text-emerald-500" /> WhatsApp родителю
            </Button>
            <Button
              variant="outline" size="sm" className="gap-1.5 text-xs"
              onClick={() => s.parentPhone && window.open(`tel:${s.parentPhone}`, "_blank")}
            >
              <Phone className="h-3.5 w-3.5" /> Позвонить
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Call history */}
      {calls.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" /> История звонков
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {calls.map((c: any, i: number) => {
              const cfg = callCfg[c.status] ?? callCfg.pending;
              return (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/20 transition-colors">
                  <div className="shrink-0 mt-0.5">{cfg.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2 mb-0.5">
                      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", cfg.cls)}>{cfg.label}</span>
                      <span className="text-xs text-muted-foreground">{c.month}</span>
                      {c.curator_name && <span className="text-xs text-muted-foreground">· {c.curator_name}</span>}
                    </div>
                    {c.call_result && <p className="text-sm">{c.call_result}</p>}
                    {c.notes && <p className="text-xs italic text-muted-foreground mt-0.5">{c.notes}</p>}
                    {c.completed_at && <p className="text-[10px] text-muted-foreground mt-0.5">{fmtDate(c.completed_at)}</p>}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Teacher feedback */}
      {tFeedback.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Star className="h-4 w-4 text-muted-foreground" /> Отзывы учителей
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {tFeedback.map((t: any, i: number) => (
                <div key={i} className="rounded-lg border p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{t.teacher_name}</p>
                      <p className="text-xs text-muted-foreground">{t.subject_name || "Общий"}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">{t.month}</Badge>
                  </div>
                  <blockquote className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-2 leading-relaxed">
                    &ldquo;{t.comment}&rdquo;
                  </blockquote>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Parent feedback */}
      {pFeedback.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" /> Встречи с родителями
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pFeedback.map((p: any, i: number) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold">{fmtDate(p.date)}</span>
                    {p.status && (
                      <Badge variant="outline" className={cn("text-[10px]",
                        p.status === "completed" ? "border-emerald-300 text-emerald-600" : "border-amber-300 text-amber-600"
                      )}>{p.status === "completed" ? "Проведена" : "Запланирована"}</Badge>
                    )}
                  </div>
                  {p.notes && <p className="text-xs text-muted-foreground">{p.notes}</p>}
                  {p.curator_name && <p className="text-[10px] text-muted-foreground mt-0.5">Куратор: {p.curator_name}</p>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Curator logs */}
      {logs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" /> Журнал куратора
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {logs.map((l: any, i: number) => (
              <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg border border-border/50">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold">{l.title}</span>
                    <Badge variant="outline" className="text-[9px]">{l.type}</Badge>
                    <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{fmtDateShort(l.date)}</span>
                  </div>
                  {l.description && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{l.description}</p>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const CERTIFICATE_SLOTS: { type: StudentCertificateType; label: string }[] = [
  { type: "january", label: "Январьский сертификат" },
  { type: "march", label: "Мартовский сертификат" },
  { type: "grant1", label: "Грант 1" },
  { type: "grant2", label: "Грант 2" },
];

function CertificatesTab({ studentId }: { studentId: string | number }) {
  const [loading, setLoading] = useState(true);
  const [busyType, setBusyType] = useState<StudentCertificateType | null>(null);
  const [certs, setCerts] = useState<Partial<Record<StudentCertificateType, StudentCertificate>>>({});
  const [selectedFiles, setSelectedFiles] = useState<Partial<Record<StudentCertificateType, File>>>({});
  const [inputKeys, setInputKeys] = useState<Record<StudentCertificateType, number>>({
    january: 0,
    march: 0,
    grant1: 0,
    grant2: 0,
  });

  async function loadCertificates() {
    try {
      setLoading(true);
      const rows = await fetchStudentCertificates(studentId);
      const mapped: Partial<Record<StudentCertificateType, StudentCertificate>> = {};
      for (const row of rows) {
        mapped[row.cert_type] = row;
      }
      setCerts(mapped);
    } catch (e) {
      console.error(e);
      toast.error("Не удалось загрузить сертификаты");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCertificates();
  }, [studentId]);

  function onFilePick(type: StudentCertificateType, file: File | null) {
    setSelectedFiles((prev) => {
      const next = { ...prev };
      if (file) next[type] = file;
      else delete next[type];
      return next;
    });
  }

  async function handleUpload(type: StudentCertificateType) {
    const file = selectedFiles[type];
    if (!file) {
      toast.error("Выберите PDF файл");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Только PDF файлы");
      return;
    }

    try {
      setBusyType(type);
      const created = await uploadStudentCertificate(studentId, type, file);
      setCerts((prev) => ({ ...prev, [type]: created }));
      setSelectedFiles((prev) => {
        const next = { ...prev };
        delete next[type];
        return next;
      });
      setInputKeys((prev) => ({ ...prev, [type]: prev[type] + 1 }));
      toast.success("Сертификат загружен");
    } catch (e) {
      console.error(e);
      toast.error("Ошибка загрузки сертификата");
    } finally {
      setBusyType(null);
    }
  }

  async function handleDelete(type: StudentCertificateType) {
    const cert = certs[type];
    if (!cert) return;

    try {
      setBusyType(type);
      await deleteStudentCertificate(studentId, cert.id);
      setCerts((prev) => {
        const next = { ...prev };
        delete next[type];
        return next;
      });
      toast.success("Сертификат удалён");
    } catch (e) {
      console.error(e);
      toast.error("Ошибка удаления сертификата");
    } finally {
      setBusyType(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" /> Сертификаты 360
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Загрузка сертификатов: январьский, мартовский, грант 1 и грант 2. Файлы принимаются только в PDF.
          </p>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {CERTIFICATE_SLOTS.map((slot) => {
            const cert = certs[slot.type];
            const selected = selectedFiles[slot.type];
            const isBusy = busyType === slot.type;
            return (
              <Card key={slot.type}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-semibold">{slot.label}</CardTitle>
                    <Badge variant={cert ? "secondary" : "outline"} className="text-[10px] shrink-0">
                      {cert ? "Загружен" : "Пусто"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {cert ? (
                    <a
                      href={cert.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline break-all"
                    >
                      {cert.original_name || "Открыть PDF"}
                    </a>
                  ) : (
                    <p className="text-xs text-muted-foreground">Файл ещё не загружен</p>
                  )}

                  <Input
                    key={inputKeys[slot.type]}
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(e) => onFilePick(slot.type, e.target.files?.[0] || null)}
                  />

                  {selected && (
                    <p className="text-[11px] text-muted-foreground truncate" title={selected.name}>
                      Выбран: {selected.name}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <Button size="sm" className="gap-1.5" onClick={() => handleUpload(slot.type)} disabled={!selected || isBusy}>
                      <Upload className="h-3.5 w-3.5" />
                      {isBusy ? "Загрузка..." : "Загрузить"}
                    </Button>
                    {cert && (
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleDelete(slot.type)} disabled={isBusy}>
                        <Trash2 className="h-3.5 w-3.5" /> Удалить
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════════ */
type TabKey = "overview" | "attendance" | "ent" | "quizzes" | "communication" | "certificates";

export default function Student360Page() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("overview");
  const [avatarError, setAvatarError] = useState(false);

  const { data: s, isLoading, error } = useQuery({
    queryKey: ["student-360", id],
    queryFn: () => fetchStudent360(id!),
    enabled: !!id,
  });

  if (isLoading) return <PageSkeleton />;

  if (error || !s) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-muted-foreground">
        <ShieldAlert className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-bold text-foreground">Профиль не найден</h2>
        <p className="text-sm">Студент не найден или произошла ошибка</p>
        <Button variant="outline" onClick={() => navigate("/students")}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> К списку
        </Button>
      </div>
    );
  }

  const h = s.hero;
  const { level: risk } = calcRisk(h);
  const rCfg = RISK[risk];
  const initials = s.full_name?.split(" ").map((w: string) => w[0]).slice(0, 2).join("") ?? "";
  const DeltaIcon = h.entDelta > 0 ? TrendingUp : h.entDelta < 0 ? TrendingDown : Minus;

  function exportToExcel() {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Overview
    const overview = [
      ["Ученик", s.full_name],
      ["Группа", s.group?.name ?? ""],
      ["Профиль", s.group?.profileName ?? ""],
      ["Куратор", s.group?.curatorName ?? ""],
      ["Телефон ученика", s.phone ?? ""],
      ["Телефон родителя", s.parentPhone ?? ""],
      ["Родитель", s.parentName ?? ""],
      [],
      ["Посещаемость %", h.attendanceRate ?? 0],
      ["Присутствий", h.presentCount ?? 0],
      ["Пропусков", h.absentCount ?? 0],
      ["Опозданий", h.lateCount ?? 0],
      ["Всего уроков", h.totalLessons ?? 0],
      ["ДЗ выполнено %", h.homeworkRate ?? 0],
      ["ЕНТ последний балл", h.entLastScore ?? ""],
      ["ЕНТ дельта", h.entDelta ?? ""],
      ["Место в группе", h.rankInGroup ? `${h.rankInGroup}/${h.groupSize}` : ""],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(overview), "Обзор");

    // Sheet 2: Attendance records
    const attRows = [["Дата", "Предмет", "Учитель", "Статус", "Опоздание", "ДЗ", "Комментарий"]];
    for (const r of (s.attendance?.records ?? [])) {
      attRows.push([r.date, r.subject ?? "", r.teacher ?? "", r.status, r.lateness ?? "", r.homework ?? "", r.comment ?? ""]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(attRows), "Посещаемость");

    // Sheet 3: ENT
    const entRows = [["Месяц", "Предмет", "Балл"]];
    for (const m of (s.ent?.byMonth ?? [])) {
      for (const sub of (m.subjects ?? [])) {
        entRows.push([m.month, sub.name, sub.score]);
      }
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(entRows), "ЕНТ");

    // Sheet 4: Teacher feedback
    const fbRows = [["Месяц", "Учитель", "Предмет", "Комментарий"]];
    for (const f of (s.teacherFeedback ?? [])) {
      fbRows.push([f.month, f.teacher_name, f.subject_name ?? "", f.comment]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fbRows), "Отзывы");

    addExcelWatermarkSheet(XLSX, wb);
    XLSX.writeFile(wb, `${s.full_name} — 360.xlsx`);
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: "overview",      label: "Обзор" },
    { key: "attendance",    label: "Посещаемость" },
    { key: "ent",           label: "ЕНТ" },
    { key: "quizzes",       label: "Контрольные" },
    { key: "communication", label: "Связь" },
    { key: "certificates",  label: "Сертификаты" },
  ];

  return (
    <div className="min-h-screen bg-background">

      {/* ── BREADCRUMB BAR ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-card/80 backdrop-blur-md border-b px-4 md:px-6 h-12 flex items-center justify-between gap-4">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground min-w-0">
          <button onClick={() => navigate("/students")} className="hover:text-foreground transition-colors flex items-center gap-1 shrink-0">
            <Users className="h-3.5 w-3.5" /> Ученики
          </button>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-40" />
          <span className="text-foreground font-semibold truncate">{s.full_name}</span>
          {s.group?.name && (
            <>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-30" />
              <span className="text-xs opacity-60 truncate hidden sm:inline">{s.group.name}</span>
            </>
          )}
        </nav>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline" size="sm" className="gap-1.5 text-xs h-8"
            onClick={() => s.parentPhone && window.open(`https://wa.me/${s.parentPhone.replace(/\D/g, "")}`, "_blank")}
          >
            <MessageSquare className="h-3.5 w-3.5 text-emerald-500" /> WhatsApp
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={exportToExcel}>
            <Download className="h-3.5 w-3.5" /> Экспорт
          </Button>
        </div>
      </div>

      {/* ── HERO SECTION ───────────────────────────────────────────────── */}
      <div className="px-4 md:px-6 pt-6 pb-0">
        <div className="max-w-6xl mx-auto">
          {/* Identity row */}
          <div className="flex gap-4 sm:gap-5 items-start mb-6">
            {/* Avatar */}
            <div className="relative shrink-0">
              {s.avatar_url && !avatarError ? (
                <img
                  src={s.avatar_url}
                  alt=""
                  onError={() => setAvatarError(true)}
                  className="w-[72px] h-[72px] rounded-2xl object-cover ring-2 ring-border shadow-md"
                />
              ) : (
                <div className="w-[72px] h-[72px] rounded-2xl bg-muted flex items-center justify-center text-xl font-bold text-muted-foreground ring-1 ring-border">
                  {initials}
                </div>
              )}
              <span className={cn(
                "absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-[2.5px] border-background shadow-sm",
                s.status === "active" ? "bg-emerald-500" : "bg-amber-500"
              )} />
            </div>

            {/* Name & badges */}
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <h1 className="text-xl md:text-2xl font-heading font-extrabold text-foreground leading-tight truncate">
                  {s.full_name}
                </h1>
                <Badge className={cn("text-[10px] font-semibold border shrink-0", rCfg.badge)}>
                  {risk === "high" && <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />}
                  {risk === "mid" && <Zap className="h-2.5 w-2.5 mr-0.5" />}
                  {rCfg.label}
                </Badge>
                {s.group?.name && <Badge variant="secondary" className="text-xs shrink-0">{s.group.name}</Badge>}
                {s.group?.profileName && <Badge variant="outline" className="text-xs shrink-0">{s.group.profileName}</Badge>}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {s.phone && (
                  <a href={`tel:${s.phone}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
                    <Phone className="h-3 w-3" /> {s.phone}
                  </a>
                )}
                {s.group?.curatorName && (
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3 text-amber-400" /> Куратор: {s.group.curatorName}
                  </span>
                )}
              </div>
              {h.consecutiveAbsences >= 2 && (
                <Badge className="mt-2 text-[10px] bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-400">
                  <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                  {h.consecutiveAbsences} пропуска подряд
                </Badge>
              )}
            </div>


          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-1">
            <StatCard
              icon={Calendar} label="Посещаемость" value={`${h.attendanceRate ?? 0}%`}
              sub={`${h.presentCount ?? 0} из ${h.totalLessons ?? 0} уроков`}
              accent={h.attendanceRate >= 90 ? "green" : h.attendanceRate >= 75 ? "amber" : "red"}
            />
            <StatCard
              icon={DeltaIcon} label="ЕНТ балл"
              value={h.entLastScore != null ? String(h.entLastScore) : "—"}
              sub={h.entDelta != null ? `${h.entDelta >= 0 ? "+" : ""}${h.entDelta} к прошлому` : "Нет сравнения"}
              accent={h.entDelta == null ? "default" : h.entDelta >= 0 ? "green" : "red"}
            />
            <StatCard
              icon={Award} label="Место в группе"
              value={h.rankInGroup ? `#${h.rankInGroup}` : "—"}
              sub={h.rankInGroup ? `из ${h.groupSize} учеников` : "Нет данных ЕНТ"}
              accent={!h.rankInGroup ? "default" : h.rankInGroup <= Math.ceil((h.groupSize || 1) / 3) ? "green" : h.rankInGroup <= Math.ceil((h.groupSize || 1) * 2 / 3) ? "amber" : "red"}
            />
            <StatCard
              icon={BookOpen} label="Выполн. ДЗ" value={`${h.homeworkRate ?? 0}%`}
              sub={`${h.hwDoneCount ?? 0} из ${h.totalLessons ?? 0}`}
              accent={h.homeworkRate >= 85 ? "green" : h.homeworkRate >= 60 ? "amber" : "red"}
            />
            <StatCard
              icon={Clock} label="Опозданий" value={String(h.lateCount ?? 0)}
              sub={`${h.absentCount ?? 0} пропусков`}
              accent={(h.lateCount ?? 0) === 0 ? "green" : (h.lateCount ?? 0) <= 3 ? "amber" : "red"}
            />
          </div>
        </div>
      </div>

      {/* ── TAB BAR ────────────────────────────────────────────────────── */}
      <div className="sticky top-12 z-20 bg-background border-b">
        <div className="max-w-6xl mx-auto px-4 md:px-6 flex gap-0 overflow-x-auto scrollbar-none">
          {tabs.map(t => (
            <TabBtn key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>
              {t.label}
            </TabBtn>
          ))}
        </div>
      </div>

      {/* ── CONTENT ────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
        {tab === "overview"      && <OverviewTab s={s} />}
        {tab === "attendance"    && <AttendanceTab s={s} />}
        {tab === "ent"           && <GradesTab360 data={s} />}
        {tab === "quizzes"       && <QuizzesTab s={s} />}
        {tab === "communication" && <CommunicationTab s={s} />}
        {tab === "certificates"  && <CertificatesTab studentId={s.id} />}
      </div>
    </div>
  );
}
