import React, { useState, useMemo, Fragment } from "react";
import { GroupPersonAvatar } from "@/components/GroupPersonAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent } from "@/components/ui/card";
import { Filter, Upload, PenLine, ChevronUp, ChevronDown, ChevronsUpDown, BarChart3 } from "lucide-react";
import { ACADEMIC_MONTHS, REAL_EXAM_TYPES, ENT_PROFILE_SUBJECTS, TOTAL_MAX, MONTH_LABELS, getScoreColor, getScoreBg, DeltaBadge, getMatrixCellBg, getGroupRowColor } from "../../EntResultsPage";

export function EntMatrixTab({
  allData,
  search,
  setSearch,
  profileFilter,
  setProfileFilter,
  isAllGroups,
  groupProfileMap,
  scoreRange,
  setScoreRange,
  performanceFilter,
  setPerformanceFilter,
  statusFilter,
  setStatusFilter,
  groups,
  isAdmin,
  dataMode,
  setXlsxImportOpen,
  setRealEntImportOpen,
  setEditStudent,
  loading
}: any) {
  const [showFilters, setShowFilters] = useState(false);
  const [matrixSortCol, setMatrixSortCol] = useState<string>("name");
  const [matrixSortDir, setMatrixSortDir] = useState<"asc" | "desc">("asc");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [showMatrixSubjects, setShowMatrixSubjects] = useState(false);
  const [hiddenMatrixMonths, setHiddenMatrixMonths] = useState<Set<string>>(new Set());

  const matrixMonths = useMemo(() => {
    const ms = new Set<string>();
    ACADEMIC_MONTHS.forEach(m => ms.add(m.value));
    REAL_EXAM_TYPES.forEach(m => ms.add(m.value));
    for (const r of allData) ms.add(r.month);
    
    return Array.from(ms).sort((a, b) => {
      if (a.startsWith("10") && !b.startsWith("10")) return 1;
      if (!a.startsWith("10") && b.startsWith("10")) return -1;
      return a.localeCompare(b);
    });
  }, [allData]);

  const matrixData = useMemo(() => {
    const sMap: Record<number, any> = {};
    for (const r of allData) {
      if (!sMap[r.student_id]) {
        sMap[r.student_id] = {
          id: r.student_id,
          name: r.student_name,
          group_id: r.group_id,
          scoresByMonth: {}
        };
      }
      if (!sMap[r.student_id].scoresByMonth[r.month]) {
        sMap[r.student_id].scoresByMonth[r.month] = { total: 0, scores: {} };
      }
      sMap[r.student_id].scoresByMonth[r.month].scores[r.subject_id] = r.score;
      sMap[r.student_id].scoresByMonth[r.month].total += r.score;
    }

    let arr = Object.values(sMap);

    // Filter by profile
    if (profileFilter !== "all" && isAllGroups) {
      const pid = parseInt(profileFilter);
      arr = arr.filter(st => (groupProfileMap[st.group_id] || 1) === pid);
    }

    // Filter by search
    if (search) {
      arr = arr.filter(st => st.name.toLowerCase().includes(search.toLowerCase()));
    }

    // Filter by score range and performance (using their best month's total)
    if (scoreRange[0] > 0 || scoreRange[1] < TOTAL_MAX || performanceFilter !== "all") {
      arr = arr.filter(st => {
        let maxTotal = 0;
        for (const m in st.scoresByMonth) {
          if (st.scoresByMonth[m].total > maxTotal) maxTotal = st.scoresByMonth[m].total;
        }
        if (maxTotal < scoreRange[0] || maxTotal > scoreRange[1]) return false;
        if (performanceFilter !== "all") {
          const pct = maxTotal / TOTAL_MAX;
          switch (performanceFilter) {
            case "high": return pct >= 0.8;
            case "medium": return pct >= 0.6 && pct < 0.8;
            case "low": return pct >= 0.4 && pct < 0.6;
            case "critical": return pct < 0.4;
            default: return true;
          }
        }
        return true;
      });
    }

    // Progress
    arr.forEach(st => {
      let prevTotal = 0;
      for (const m of matrixMonths) {
        if (st.scoresByMonth[m]) {
          const cur = st.scoresByMonth[m].total;
          if (prevTotal > 0) {
            st.scoresByMonth[m].progress = cur - prevTotal;
          }
          prevTotal = cur;
        }
      }
    });
    
    // Sort
    arr.sort((a, b) => {
      if (matrixSortCol === "name") {
        return matrixSortDir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      } else {
        const valA = a.scoresByMonth[matrixSortCol]?.total || 0;
        const valB = b.scoresByMonth[matrixSortCol]?.total || 0;
        return matrixSortDir === "asc" ? valA - valB : valB - valA;
      }
    });

    return arr;
  }, [allData, matrixMonths, search, profileFilter, isAllGroups, groupProfileMap, scoreRange, performanceFilter, matrixSortCol, matrixSortDir]);

  const monthsWithData = useMemo(() => {
    const s = new Set<string>();
    for (const st of matrixData) {
      for (const m of Object.keys(st.scoresByMonth)) {
        if (st.scoresByMonth[m].total > 0) s.add(m);
      }
    }
    return s;
  }, [matrixData]);


  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-4">
            {isAllGroups && (
              <Select value={profileFilter} onValueChange={setProfileFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Направление" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все направления</SelectItem>
                  <SelectItem value="1">ФМ (Мат-Физ)</SelectItem>
                  <SelectItem value="2">ХБ (Хим-Био)</SelectItem>
                  <SelectItem value="3">ИНФМАТ (Инф-Мат)</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Статус" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все ученики</SelectItem>
                <SelectItem value="active">Активные</SelectItem>
                <SelectItem value="archived">В архиве</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Поиск по имени..." value={search} onChange={e => setSearch(e.target.value)} className="w-full sm:max-w-[200px]" />
            
            <TooltipProvider delayDuration={300}>
              <div className="flex items-center gap-1">
                {isAdmin && (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setXlsxImportOpen(true)}>
                          <Upload className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Загрузить XLSX</TooltipContent>
                    </Tooltip>
                    {dataMode === "real" && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setRealEntImportOpen(true)}>
                            <PenLine className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Ввести баллы реального ЕНТ (вручную / CSV)</TooltipContent>
                      </Tooltip>
                    )}
                  </>
                )}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant={showFilters ? "default" : "outline"} size="icon" className="h-8 w-8 relative" onClick={() => setShowFilters(f => !f)}>
                      <Filter className="h-3.5 w-3.5" />
                      {(performanceFilter !== "all" || scoreRange[0] > 0 || scoreRange[1] < TOTAL_MAX || profileFilter !== "all") && (
                        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Фильтры{(performanceFilter !== "all" || scoreRange[0] > 0 || scoreRange[1] < TOTAL_MAX || profileFilter !== "all") ? " (активны)" : ""}
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>

            {(performanceFilter !== "all" || scoreRange[0] > 0 || scoreRange[1] < TOTAL_MAX || profileFilter !== "all") && (
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => { setPerformanceFilter("all"); setScoreRange([0, TOTAL_MAX]); setProfileFilter("all"); }}>
                Сбросить фильтры
              </Button>
            )}
          </div>

          {/* Advanced filters panel */}
          {showFilters && (
            <Card className="mb-4">
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Диапазон баллов: {scoreRange[0]} — {scoreRange[1]}</Label>
                    <Slider min={0} max={TOTAL_MAX} step={5} value={scoreRange} onValueChange={v => setScoreRange(v as [number, number])} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Уровень</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { val: "all", label: "Все", icon: null },
                        { val: "high", label: "≥80%", icon: "🟢" },
                        { val: "medium", label: "60-79%", icon: "🔵" },
                        { val: "low", label: "40-59%", icon: "🟠" },
                        { val: "critical", label: "<40%", icon: "🔴" },
                      ].map(f => (
                        <Button key={f.val} variant={performanceFilter === f.val ? "default" : "outline"} size="sm" className="text-xs h-7"
                          onClick={() => setPerformanceFilter(f.val)}>
                          {f.icon && <span className="mr-1">{f.icon}</span>}{f.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
            <div className="flex items-center gap-3 bg-muted/30 p-1.5 rounded-lg border shadow-sm">
              <span className={`text-sm font-medium px-2 ${!showMatrixSubjects ? 'text-primary' : 'text-muted-foreground'}`}>Общие баллы</span>
              <Switch checked={showMatrixSubjects} onCheckedChange={setShowMatrixSubjects} />
              <span className={`text-sm font-medium px-2 ${showMatrixSubjects ? 'text-primary' : 'text-muted-foreground'}`}>Все 5 предметов</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-9 shadow-sm bg-background" onClick={() => {
                const emptyMonths = matrixMonths.filter(m => !monthsWithData.has(m));
                setHiddenMatrixMonths(new Set(emptyMonths));
              }}>
                Скрыть пустые
              </Button>
              <Button variant="outline" size="sm" className="h-9 shadow-sm bg-background" onClick={() => setHiddenMatrixMonths(new Set())}>
                Показать все
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 shadow-sm bg-background">
                  Выбрать месяцы
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0 shadow-xl" align="end">
                <div className="p-2 bg-muted/50 border-b">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider px-2">Колонки</h4>
                </div>
                <div className="p-2 space-y-1 max-h-[300px] overflow-auto">
                  {matrixMonths.map(m => (
                    <label key={m} className="flex items-center gap-2.5 p-2 hover:bg-muted rounded-md cursor-pointer text-sm transition-colors">
                      <Checkbox 
                        checked={!hiddenMatrixMonths.has(m)}
                        onCheckedChange={(checked) => {
                          setHiddenMatrixMonths(prev => {
                            const next = new Set(prev);
                            if (checked) next.delete(m);
                            else next.add(m);
                            return next;
                          });
                        }}
                      />
                      <span className="font-medium">{MONTH_LABELS[m] || m}</span>
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">{[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-10 rounded-lg w-full" />)}</div>
          ) : matrixData.length === 0 ? (
            <Card className="text-center py-16 bg-muted/10"><CardContent>
              <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/20 mb-3" />
              <p className="text-muted-foreground font-medium">Нет данных для отображения</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Попробуйте изменить группу или фильтры</p>
            </CardContent></Card>
          ) : (
            <div className="rounded-xl border overflow-auto bg-card shadow-sm custom-scrollbar" style={{ maxHeight: "calc(100vh - 240px)" }}>
              <table className="w-full text-sm text-left border-collapse min-w-max">
                <thead className="bg-muted/80 text-muted-foreground text-xs uppercase sticky top-0 z-20 shadow-sm backdrop-blur-md">
                  <tr>
                    <th 
                      className="px-4 py-3 font-semibold border-b border-r bg-muted/90 sticky left-0 z-30 min-w-[240px] backdrop-blur-md cursor-pointer hover:bg-muted"
                      onClick={() => {
                        if (matrixSortCol === "name") setMatrixSortDir(d => d === "asc" ? "desc" : "asc");
                        else { setMatrixSortCol("name"); setMatrixSortDir("asc"); }
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        Ученик / Группа 
                        {matrixSortCol === "name" && (matrixSortDir === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />)}
                        {matrixSortCol !== "name" && <ChevronsUpDown className="h-3.5 w-3.5 opacity-30" />}
                      </div>
                    </th>
                    {matrixMonths.filter(m => !hiddenMatrixMonths.has(m)).map(m => (
                      <th key={m} colSpan={showMatrixSubjects ? 7 : 2} className="px-2 py-2 font-bold border-b border-r text-center tracking-wider text-primary">
                        {MONTH_LABELS[m] || m}
                      </th>
                    ))}
                  </tr>
                  {showMatrixSubjects && (
                    <tr className="bg-muted/40 backdrop-blur-md">
                      <th className="px-4 py-1.5 border-b border-r sticky left-0 bg-muted/80 z-30"></th>
                      {matrixMonths.filter(m => !hiddenMatrixMonths.has(m)).map(m => (
                        <Fragment key={m + "_subs"}>
                          <th className="px-1.5 py-1.5 font-medium border-b border-r text-center w-12 text-[10px]">Ист</th>
                          <th className="px-1.5 py-1.5 font-medium border-b border-r text-center w-12 text-[10px]">Чт</th>
                          <th className="px-1.5 py-1.5 font-medium border-b border-r text-center w-12 text-[10px]">МГ</th>
                          <th className="px-1.5 py-1.5 font-medium border-b border-r text-center w-12 text-[10px]">П1</th>
                          <th className="px-1.5 py-1.5 font-medium border-b border-r text-center w-12 text-[10px]">П2</th>
                          <th 
                            className="px-2 py-1.5 font-bold border-b border-r text-center text-primary w-14 text-[10px] cursor-pointer hover:bg-muted/60"
                            onClick={() => {
                              if (matrixSortCol === m) setMatrixSortDir(d => d === "asc" ? "desc" : "asc");
                              else { setMatrixSortCol(m); setMatrixSortDir("desc"); }
                            }}
                          >
                            <div className="flex items-center justify-center gap-0.5">
                              Общ 
                              {matrixSortCol === m && (matrixSortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                              {matrixSortCol !== m && <ChevronsUpDown className="h-3 w-3 opacity-30" />}
                            </div>
                          </th>
                          <th className="px-1.5 py-1.5 font-medium border-b border-r text-center w-14 text-[10px]">Прог</th>
                        </Fragment>
                      ))}
                    </tr>
                  )}
                  {!showMatrixSubjects && (
                    <tr className="bg-muted/40 backdrop-blur-md">
                      <th className="px-4 py-1.5 border-b border-r sticky left-0 bg-muted/80 z-30"></th>
                      {matrixMonths.filter(m => !hiddenMatrixMonths.has(m)).map(m => (
                        <Fragment key={m + "_subs"}>
                          <th 
                            className="px-2 py-1.5 font-bold border-b border-r text-center text-primary w-16 text-[10px] cursor-pointer hover:bg-muted/60"
                            onClick={() => {
                              if (matrixSortCol === m) setMatrixSortDir(d => d === "asc" ? "desc" : "asc");
                              else { setMatrixSortCol(m); setMatrixSortDir("desc"); }
                            }}
                          >
                            <div className="flex items-center justify-center gap-0.5">
                              Общ 
                              {matrixSortCol === m && (matrixSortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                              {matrixSortCol !== m && <ChevronsUpDown className="h-3 w-3 opacity-30" />}
                            </div>
                          </th>
                          <th className="px-2 py-1.5 font-medium border-b border-r text-center w-16 text-[10px]">Прог</th>
                        </Fragment>
                      ))}
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-border/50">
                  {matrixData.map(st => {
                    const rowProfileId = groupProfileMap[st.group_id] || 1;
                    const subs = ENT_PROFILE_SUBJECTS[rowProfileId] || ENT_PROFILE_SUBJECTS[1];
                    const grp = groups.find(g => g.id === st.group_id);
                    const gname = grp?.name || "Без группы";
                    
                    return (
                      <tr key={st.id} className={`hover:bg-muted/30 transition-colors group ${getGroupRowColor(st.group_id)}`}>
                        <td className="px-4 py-2.5 border-r bg-background group-hover:bg-muted/30 sticky left-0 z-10 transition-colors">
                          <div className="flex items-center gap-2.5">
                            <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center">
                              <span className="text-xs font-bold text-primary">{st.name.split(' ').map((w: string) => w[0]).join('').slice(0,2).toUpperCase()}</span>
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-foreground text-[13px] truncate">{st.name}</div>
                              <div className="flex items-center gap-1 mt-0.5">
                                <GroupPersonAvatar groupName={gname} avatarUrl={grp?.avatar_url} size={12} showTooltip={false} />
                                <span className="text-[10px] text-muted-foreground font-medium truncate">{gname}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        {matrixMonths.filter(m => !hiddenMatrixMonths.has(m)).map(m => {
                          const mData = st.scoresByMonth[m];
                          if (!mData) {
                            return showMatrixSubjects ? (
                              <Fragment key={m}>
                                <td colSpan={5} className="px-1.5 py-1.5 border-r text-center text-muted-foreground/30 text-xs bg-muted/5">—</td>
                                <td 
                                  className={`px-2 py-1.5 border-r text-center font-bold text-muted-foreground/30 bg-muted/10 ${isAdmin ? 'cursor-pointer hover:bg-muted/50 hover:text-primary transition-colors' : ''}`}
                                  onClick={() => isAdmin && setEditStudent({ id: st.id, full_name: st.name, month: m })}
                                >
                                  Добавить
                                </td>
                                <td className="px-1.5 py-1.5 border-r text-center text-muted-foreground/30 text-[10px] bg-muted/5">-</td>
                              </Fragment>
                            ) : (
                              <Fragment key={m}>
                                <td 
                                  className={`px-2 py-2 border-r text-center font-bold text-muted-foreground/30 bg-muted/10 ${isAdmin ? 'cursor-pointer hover:bg-muted/50 hover:text-primary transition-colors' : ''}`}
                                  onClick={() => isAdmin && setEditStudent({ id: st.id, full_name: st.name, month: m })}
                                >
                                  Добавить
                                </td>
                                <td className="px-2 py-2 border-r text-center text-muted-foreground/30 text-[10px] bg-muted/5">-</td>
                              </Fragment>
                            );
                          }

                          const renderScore = (idx: number) => {
                            const s = subs[idx];
                            if (!s) return <td className="px-1.5 py-1.5 border-r text-center text-muted-foreground/30 text-xs">—</td>;
                            const score = mData.scores[s.id];
                            return <td className={`px-1.5 py-1.5 border-r text-center text-xs ${getMatrixCellBg(score, s.max)}`}>{score != null ? score : "—"}</td>;
                          };

                          return (
                            <Fragment key={m}>
                              {showMatrixSubjects && (
                                <>
                                  {renderScore(0)}
                                  {renderScore(1)}
                                  {renderScore(2)}
                                  {renderScore(3)}
                                  {renderScore(4)}
                                </>
                              )}
                              <td 
                                className={`px-2 py-1.5 border-r text-center font-bold bg-muted/20 text-foreground text-sm ${isAdmin ? 'cursor-pointer hover:bg-muted/50 hover:text-primary transition-colors' : ''}`}
                                onClick={() => isAdmin && setEditStudent({ id: st.id, full_name: st.name, month: m })}
                              >
                                {mData.total > 0 ? mData.total : "—"}
                              </td>
                              <td className="px-1.5 py-1.5 border-r text-center bg-muted/5">
                                {mData.progress != null ? <DeltaBadge delta={mData.progress} /> : "-"}
                              </td>
                            </Fragment>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
    </div>
  );
}
