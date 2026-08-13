import { useState, useEffect, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { GroupPersonAvatar } from "@/components/GroupPersonAvatar";
import { ClipboardList, Clock } from "lucide-react";
import { fetchAttendanceGrid } from "@/lib/api";
import i18n from "@/lib/i18n";

function getMonthRange(offset = 0): { from: string; to: string; label: string } {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  const y = d.getFullYear();
  const m = d.getMonth();
  const from = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const last = new Date(y, m + 1, 0).getDate();
  const to = `${y}-${String(m + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  const locale = { ru: "ru-RU", kk: "kk-KZ", en: "en-US" }[i18n.language] ?? "ru-RU";
  const label = d.toLocaleDateString(locale, { month: "long", year: "numeric" });
  return { from, to, label };
}

interface AttendanceGridTabProps {
  groups: any[];
  locale: string;
}

export function AttendanceGridTab({ groups, locale }: AttendanceGridTabProps) {
  const [gridGroupId, setGridGroupId] = useState<string>("");
  const [gridRangeMode, setGridRangeMode] = useState<string>("current");
  const [gridCustomFrom, setGridCustomFrom] = useState("");
  const [gridCustomTo, setGridCustomTo] = useState("");
  const [gridData, setGridData] = useState<any>(null);
  const [gridLoading, setGridLoading] = useState(false);

  // Auto-select first group for attendance grid
  useEffect(() => {
    if (groups.length > 0 && !gridGroupId) setGridGroupId(String(groups[0].id));
  }, [groups, gridGroupId]);

  const gridDateRange = useMemo(() => {
    if (gridRangeMode === "current") return getMonthRange(0);
    if (gridRangeMode === "prev") return getMonthRange(-1);
    if (gridRangeMode === "custom" && gridCustomFrom && gridCustomTo) {
      return { from: gridCustomFrom, to: gridCustomTo, label: `${gridCustomFrom} — ${gridCustomTo}` };
    }
    return getMonthRange(0);
  }, [gridRangeMode, gridCustomFrom, gridCustomTo]);

  useEffect(() => {
    if (!gridGroupId || !gridDateRange.from || !gridDateRange.to) return;
    setGridLoading(true);
    fetchAttendanceGrid(parseInt(gridGroupId), gridDateRange.from, gridDateRange.to)
      .then(setGridData)
      .finally(() => setGridLoading(false));
  }, [gridGroupId, gridDateRange.from, gridDateRange.to]);

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div className="space-y-1">
          <Label className="text-xs">Группа</Label>
          <Select value={gridGroupId} onValueChange={setGridGroupId}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Группа" /></SelectTrigger>
            <SelectContent>
              {groups.map((g: any) => (
                <SelectItem key={g.id} value={String(g.id)}>
                  <span className="flex items-center gap-1.5">
                    <GroupPersonAvatar groupName={g.name} avatarUrl={g.avatar_url} size={18} showTooltip={false} />
                    {g.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-1.5">
          <Button variant={gridRangeMode === "current" ? "default" : "outline"} size="sm" onClick={() => setGridRangeMode("current")}>
            Текущий месяц
          </Button>
          <Button variant={gridRangeMode === "prev" ? "default" : "outline"} size="sm" onClick={() => setGridRangeMode("prev")}>
            Прошлый месяц
          </Button>
          <Button variant={gridRangeMode === "custom" ? "default" : "outline"} size="sm" onClick={() => setGridRangeMode("custom")}>
            Свои даты
          </Button>
        </div>
        {gridRangeMode === "custom" && (
          <div className="flex items-center gap-2">
            <Input type="date" value={gridCustomFrom} onChange={(e) => setGridCustomFrom(e.target.value)} className="w-36 h-8 text-xs" />
            <span className="text-muted-foreground text-xs">—</span>
            <Input type="date" value={gridCustomTo} onChange={(e) => setGridCustomTo(e.target.value)} className="w-36 h-8 text-xs" />
          </div>
        )}
        {gridRangeMode !== "custom" && (
          <span className="text-xs text-muted-foreground capitalize">{gridDateRange.label}</span>
        )}
      </div>

      {gridLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
        </div>
      ) : !gridData || gridData.dates?.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-muted-foreground">
          <ClipboardList className="h-10 w-10 mb-2 opacity-30" />
          <p className="text-sm">Нет данных посещаемости за выбранный период</p>
        </div>
      ) : (
        <ScrollArea className="w-full">
          <div className="rounded-md border overflow-hidden min-w-max">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10 min-w-[180px]">Ученик</TableHead>
                  {gridData.dates.map((d: string) => {
                    const day = new Date(d + "T00:00:00").toLocaleDateString(locale, { day: "numeric", month: "short" });
                    const weekday = new Date(d + "T00:00:00").toLocaleDateString(locale, { weekday: "short" });
                    return (
                      <TableHead key={d} className="text-center min-w-[48px] px-1">
                        <div className="text-xs leading-tight">
                          <div>{day}</div>
                          <div className="text-muted-foreground font-normal">{weekday}</div>
                        </div>
                      </TableHead>
                    );
                  })}
                  <TableHead className="text-center min-w-[60px] sticky right-0 bg-background z-10">Итого</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gridData.students.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="sticky left-0 bg-background z-10 font-medium text-sm whitespace-nowrap">
                      {s.full_name}
                    </TableCell>
                    {gridData.dates.map((d: string) => {
                      const val = s.attendance[d];
                      return (
                        <TableCell key={d} className="text-center px-1 py-1.5">
                          {val === "present" && (
                            <div className="w-6 h-6 mx-auto rounded bg-green-500/20 text-green-700 flex items-center justify-center text-xs font-bold">+</div>
                          )}
                          {val === "late" && (
                            <div className="w-6 h-6 mx-auto rounded bg-orange-500/20 text-orange-700 flex items-center justify-center">
                              <Clock className="h-3 w-3" />
                            </div>
                          )}
                          {val === "absent" && (
                            <div className="w-6 h-6 mx-auto rounded bg-red-500/20 text-red-700 flex items-center justify-center text-xs font-bold">−</div>
                          )}
                          {!val && (
                            <div className="w-6 h-6 mx-auto rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">·</div>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center sticky right-0 bg-background z-10">
                      <Badge variant="outline" className="text-xs font-mono">{s.total}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
    </div>
  );
}
