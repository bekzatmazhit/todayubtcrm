import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, MapPin, User, BookOpen, AlertCircle, Loader2 } from "lucide-react";

const API_BASE = (import.meta as any).env?.VITE_API_URL || "/api";
const DAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
const CYCLE_MAP: Record<string, string> = { A: "Чётная неделя", B: "Нечётная неделя" };

interface TimeSlot { id: number; start_time: string; end_time: string; label: string }
interface ScheduleEntry {
  id: number; group_id: number; subject_id: number; teacher_id: number;
  room_id: number; time_slot_id: number; cycle: string; custom_label: string;
  group_name: string; subject_name: string; teacher_name: string;
  room_name: string; start_time: string; end_time: string; time_label: string;
}
interface Group { id: number; name: string }

export default function PublicSchedulePage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<{
    label: string | null; group_id: number | null;
    groups: Group[]; schedule: ScheduleEntry[]; timeSlots: TimeSlot[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<string>("all");

  useEffect(() => {
    fetch(`${API_BASE}/public/schedule/${token}`)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({ error: "Ссылка недействительна" }));
          throw new Error(body.error || "Ссылка недействительна");
        }
        return r.json();
      })
      .then((d) => {
        setData(d);
        if (d.group_id) setSelectedGroup(String(d.group_id));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-red-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <AlertCircle className="h-16 w-16 text-red-400" />
            <h2 className="text-xl font-semibold text-center">Ссылка недействительна</h2>
            <p className="text-muted-foreground text-center text-sm">
              {error || "Ссылка на расписание не найдена, истекла или была отключена."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { groups, schedule, timeSlots } = data;
  const filtered = selectedGroup === "all" ? schedule : schedule.filter((s) => s.group_id === parseInt(selectedGroup));

  // Group by day (time_slot_id maps to slot, cycle encodes day+cycle)
  // Schedule entries have cycle like "A" or "B" but the day is encoded in the slot pattern
  // Actually looking at the schedule structure, each entry has time_slot_id and cycle
  // The day of week is typically inferred from the timetable position
  // Let's group by time slot and show as a timetable

  const groupedBySlot: Record<number, ScheduleEntry[]> = {};
  filtered.forEach((entry) => {
    if (!groupedBySlot[entry.time_slot_id]) groupedBySlot[entry.time_slot_id] = [];
    groupedBySlot[entry.time_slot_id].push(entry);
  });

  const sortedSlots = timeSlots.filter((ts) => groupedBySlot[ts.id]).sort(
    (a, b) => a.start_time.localeCompare(b.start_time)
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-slate-900 truncate">
                {data.label || "Расписание занятий"}
              </h1>
              <p className="text-xs text-slate-500">Образовательный центр «TODAY»</p>
            </div>
          </div>
          {groups.length > 1 && (
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger className="w-48 h-9">
                <SelectValue placeholder="Все группы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все группы</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16">
              <BookOpen className="h-12 w-12 text-slate-300" />
              <p className="text-slate-500">Расписание пока не заполнено</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {sortedSlots.map((slot) => {
              const entries = groupedBySlot[slot.id] || [];
              return (
                <div key={slot.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-semibold text-slate-700">
                      {slot.label} — {slot.start_time}–{slot.end_time}
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {entries.map((entry) => (
                      <Card key={entry.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-semibold text-sm text-slate-900 leading-tight">
                              {entry.custom_label || entry.subject_name}
                            </h3>
                            {entry.cycle && entry.cycle !== "both" && (
                              <Badge variant="outline" className="text-[10px] px-1.5 flex-shrink-0">
                                {CYCLE_MAP[entry.cycle] || entry.cycle}
                              </Badge>
                            )}
                          </div>
                          <div className="space-y-1 text-xs text-slate-500">
                            {entry.group_name && (
                              <div className="flex items-center gap-1.5">
                                <BookOpen className="h-3 w-3" />
                                <span>{entry.group_name}</span>
                              </div>
                            )}
                            {entry.teacher_name && (
                              <div className="flex items-center gap-1.5">
                                <User className="h-3 w-3" />
                                <span>{entry.teacher_name}</span>
                              </div>
                            )}
                            {entry.room_name && (
                              <div className="flex items-center gap-1.5">
                                <MapPin className="h-3 w-3" />
                                <span>{entry.room_name}</span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-4 border-t text-center">
          <p className="text-xs text-slate-400">
            Образовательный центр «TODAY» • Расписание актуально на момент просмотра
          </p>
        </div>
      </main>
    </div>
  );
}
