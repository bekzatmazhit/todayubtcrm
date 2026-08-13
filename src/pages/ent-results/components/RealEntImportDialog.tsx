import React, { useState, useEffect, useRef } from "react";
import { GroupPersonAvatar } from "@/components/GroupPersonAvatar";
import {
  BarChart3, Loader2, Upload, Download, FileText, PenLine, TableIcon, CheckCircle2, X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { saveEntResultsBatch, fetchStudents } from "@/lib/api";
import { REAL_EXAM_TYPES, ACADEMIC_MONTHS, ENT_PROFILE_SUBJECTS, TOTAL_MAX, getScoreColor } from "../../EntResultsPage";

export interface ParsedRow {
  name: string;
  studentId: number | null;
  scores: Record<number, number | "">;
  errors: string[];
}

export type EntryMode = "manual" | "csv";

export function RealEntImportDialog({ open, onOpenChange, groups, onSuccess }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  groups: any[];
  onSuccess: (examType: string) => void;
}) {
  const [mode, setMode] = useState<EntryMode>("manual");
  const [groupId, setGroupId] = useState("");
  const [examType, setExamType] = useState(REAL_EXAM_TYPES[0].value);
  const [students, setStudents] = useState<{ id: number; full_name: string }[]>([]);

  // Manual mode state
  const [manualValues, setManualValues] = useState<Record<number, Record<number, string>>>({});
  const [savedStudents, setSavedStudents] = useState<Set<number>>(new Set());
  const [manualSaving, setManualSaving] = useState<number | null>(null);

  // CSV mode state
  const [csvText, setCsvText] = useState("");
  const [parseResult, setParseResult] = useState<ParsedRow[] | null>(null);
  const [csvSaving, setCsvSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedGroup = groups.find((g: any) => String(g.id) === groupId);
  const profileId: number = selectedGroup?.profile_id || 1;
  const subjects = ENT_PROFILE_SUBJECTS[profileId] || ENT_PROFILE_SUBJECTS[1];

  // Load students when group changes
  useEffect(() => {
    if (!groupId) { setStudents([]); setManualValues({}); setSavedStudents(new Set()); return; }
    fetchStudents().then((all: any[]) => {
      const filtered = all.filter(s => String(s.group_id) === groupId);
      setStudents(filtered);
      // Init empty manual values
      const init: Record<number, Record<number, string>> = {};
      for (const st of filtered) {
        init[st.id] = {};
        for (const subj of ENT_PROFILE_SUBJECTS[profileId] || ENT_PROFILE_SUBJECTS[1]) {
          init[st.id][subj.id] = "";
        }
      }
      setManualValues(init);
      setSavedStudents(new Set());
    });
  }, [groupId]);

  // Re-init manual values cols when profile changes (group changes)
  useEffect(() => {
    if (students.length === 0) return;
    setManualValues(prev => {
      const next: Record<number, Record<number, string>> = {};
      for (const st of students) {
        next[st.id] = {};
        for (const subj of subjects) {
          next[st.id][subj.id] = prev[st.id]?.[subj.id] ?? "";
        }
      }
      return next;
    });
  }, [subjects]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setGroupId(""); setExamType(REAL_EXAM_TYPES[0].value);
      setCsvText(""); setParseResult(null); setCsvSaving(false);
      setManualValues({}); setSavedStudents(new Set()); setManualSaving(null);
    }
  }, [open]);

  // ── Manual: save one student ──
  const saveOneStudent = async (studentId: number) => {
    const vals = manualValues[studentId] || {};
    const scores = subjects
      .filter(s => vals[s.id] !== "" && vals[s.id] != null)
      .map(s => ({ student_id: studentId, subject_id: s.id, score: parseInt(vals[s.id]) || 0, month: examType }));
    if (!scores.length) return;
    setManualSaving(studentId);
    await saveEntResultsBatch(scores);
    setManualSaving(null);
    setSavedStudents(prev => new Set([...prev, studentId]));
  };

  // ── Manual: save ALL at once ──
  const saveAllManual = async () => {
    const scores = students.flatMap(st => {
      const vals = manualValues[st.id] || {};
      return subjects
        .filter(s => vals[s.id] !== "" && vals[s.id] != null)
        .map(s => ({ student_id: st.id, subject_id: s.id, score: parseInt(vals[s.id]) || 0, month: examType }));
    });
    if (!scores.length) return;
    setManualSaving(-1);
    await saveEntResultsBatch(scores);
    setManualSaving(null);
    setSavedStudents(new Set(students.map(st => st.id)));
    onSuccess(examType);
    onOpenChange(false);
  };

  const manualTotal = (studentId: number) => {
    const vals = manualValues[studentId] || {};
    return subjects.reduce((sum, s) => sum + (parseInt(vals[s.id] || "") || 0), 0);
  };

  const manualFilledCount = students.filter(st =>
    subjects.some(s => (manualValues[st.id]?.[s.id] || "") !== "")
  ).length;

  // ── CSV helpers ──
  const downloadTemplate = () => {
    const header = ["ФИО", ...subjects.map(s => s.short)].join(",");
    const rows = students.map(s => [s.full_name, ...subjects.map(() => "")].join(","));
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ent_шаблон_${REAL_EXAM_TYPES.find(e => e.value === examType)?.short || examType}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string): ParsedRow[] => {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const sep = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : ",";
    const headers = lines[0].split(sep).map(h => h.trim().replace(/^\ufeff/, ""));
    const subjectColMap: Record<number, number> = {};
    for (const s of subjects) {
      const idx = headers.findIndex(h => h.toLowerCase() === s.short.toLowerCase());
      if (idx >= 0) subjectColMap[s.id] = idx;
    }
    return lines.slice(1).filter(l => l.trim()).map(line => {
      const cells = line.split(sep).map(c => c.trim().replace(/^"|"$/g, ""));
      const name = cells[0] || "";
      const matched =
        students.find(s => s.full_name.trim().toLowerCase() === name.trim().toLowerCase()) ||
        students.find(s => name.trim().length > 3 && s.full_name.trim().toLowerCase().includes(name.trim().toLowerCase()));
      const errors: string[] = [];
      if (!matched) errors.push("Ученик не найден");
      const scores: Record<number, number | ""> = {};
      for (const s of subjects) {
        const colIdx = subjectColMap[s.id];
        if (colIdx == null) continue;
        const raw = cells[colIdx] || "";
        if (raw === "") { scores[s.id] = ""; continue; }
        const n = Number(raw);
        if (isNaN(n) || n < 0 || n > s.max) errors.push(`${s.short}: "${raw}" (0–${s.max})`);
        else scores[s.id] = n;
      }
      return { name, studentId: matched?.id ?? null, scores, errors };
    });
  };

  const handleCsvChange = (text: string) => {
    setCsvText(text);
    setParseResult(text.trim() && students.length > 0 ? parseCSV(text) : null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => handleCsvChange(ev.target?.result as string ?? "");
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => handleCsvChange(ev.target?.result as string ?? "");
    reader.readAsText(file, "utf-8");
  };

  const validRows = parseResult?.filter(r => r.studentId != null && r.errors.length === 0) ?? [];
  const errorRows = parseResult?.filter(r => r.errors.length > 0) ?? [];

  const handleCsvSave = async () => {
    if (!validRows.length) return;
    setCsvSaving(true);
    const scores = validRows.flatMap(row =>
      subjects
        .filter(s => row.scores[s.id] !== "" && row.scores[s.id] != null)
        .map(s => ({ student_id: row.studentId!, subject_id: s.id, score: row.scores[s.id] as number, month: examType }))
    );
    await saveEntResultsBatch(scores);
    setCsvSaving(false);
    onSuccess(examType);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[92vh] flex flex-col p-0 gap-0 shadow-2xl rounded-xl border-0 overflow-hidden">
        <DialogTitle className="sr-only">Ввод баллов ЕНТ</DialogTitle>
        {/* Header */}
        <div className="px-6 pt-6 pb-5 border-b bg-gradient-to-r from-muted/50 to-background flex items-start justify-between gap-3 relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/50" />
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Ввод баллов ЕНТ
            </h2>
            <p className="text-sm text-muted-foreground mt-1 font-medium">Добавьте баллы вручную или загрузите через CSV/Excel файл</p>
          </div>
          <button onClick={() => onOpenChange(false)} className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors mt-0.5">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Config row */}
        <div className="px-6 py-3 border-b bg-muted/30 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[140px]">
            <Label className="text-xs font-medium mb-1 block">Группа</Label>
            <Select value={groupId} onValueChange={g => { setGroupId(g); setParseResult(null); setCsvText(""); }}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Выберите группу" /></SelectTrigger>
              <SelectContent>
                {groups.map((g: any) => (
                  <SelectItem key={g.id} value={String(g.id)}><span className="flex items-center gap-1.5"><GroupPersonAvatar groupName={g.name} avatarUrl={g.avatar_url} size={18} showTooltip={false} />{g.name}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <Label className="text-xs font-semibold mb-1.5 block text-muted-foreground uppercase tracking-wider">Экзамен</Label>
            <Select value={examType} onValueChange={v => { setExamType(v); setSavedStudents(new Set()); }}>
              <SelectTrigger className="h-9 text-sm border-muted-foreground/20"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel className="bg-muted/50">Пробные ЕНТ (Внутренние)</SelectLabel>
                  {ACADEMIC_MONTHS.map(e => <SelectItem key={e.value} value={e.value} className="pl-6">{e.label}</SelectItem>)}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel className="bg-muted/50 mt-1">Реальные ЕНТ (Официальные)</SelectLabel>
                  {REAL_EXAM_TYPES.map(e => <SelectItem key={e.value} value={e.value} className="pl-6">{e.label}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          {/* Mode switcher */}
          <div className="flex rounded-lg bg-muted/50 p-1 text-xs font-medium border">
            <button
              onClick={() => setMode("manual")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all duration-200 ${mode === "manual" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
            >
              <PenLine className="h-3.5 w-3.5" /> Вручную
            </button>
            <button
              onClick={() => setMode("csv")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all duration-200 ${mode === "csv" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
            >
              <TableIcon className="h-3.5 w-3.5" /> Загрузка файла
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          {!groupId ? (
            <div className="text-center py-10 text-muted-foreground text-sm">Выберите группу для начала</div>
          ) : mode === "manual" ? (
            /* ── MANUAL MODE ── */
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Subject header */}
              <div className="flex items-center gap-2 bg-primary/5 border border-primary/10 rounded-xl p-3">
                <span className="text-sm font-medium text-foreground">Максимальные баллы:</span>
                {subjects.map(s => (
                  <Badge key={s.id} variant="secondary" className="bg-background shadow-sm border border-border/50 text-xs py-0.5">{s.short} <span className="text-muted-foreground/50 ml-1">/{s.max}</span></Badge>
                ))}
              </div>
              
              <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                {/* Header row */}
                <div className="grid text-xs font-semibold text-muted-foreground bg-muted/30 py-2.5 border-b uppercase tracking-wider" style={{ gridTemplateColumns: `1.5fr ${subjects.map(() => "80px").join(" ")} 80px 100px` }}>
                  <div className="pl-4">Ученик</div>
                  {subjects.map(s => <div key={s.id} className="text-center">{s.short}</div>)}
                  <div className="text-center">Итого</div>
                  <div />
                </div>
                {/* Student rows */}
                <div className="divide-y divide-border/50">
                  {students.map(st => {
                    const total = manualTotal(st.id);
                    const isSaved = savedStudents.has(st.id);
                    const isSaving = manualSaving === st.id;
                    const hasSomeValue = subjects.some(s => (manualValues[st.id]?.[s.id] || "") !== "");
                    
                    return (
                      <div key={st.id}
                        className={`grid items-center py-2 transition-colors ${isSaved ? "bg-green-50/50 dark:bg-green-950/10" : "hover:bg-muted/30"}`}
                        style={{ gridTemplateColumns: `1.5fr ${subjects.map(() => "80px").join(" ")} 80px 100px` }}
                      >
                        <div className="text-sm font-medium truncate pl-4 pr-2 flex items-center gap-2">
                          {isSaved ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" /> : <div className="h-4 w-4 shrink-0 rounded-full border border-muted-foreground/30" />}
                          <span className={isSaved ? "text-muted-foreground" : "text-foreground"}>{st.full_name}</span>
                        </div>
                        {subjects.map(s => {
                          const val = manualValues[st.id]?.[s.id] ?? "";
                          const numVal = parseInt(val);
                          const isInvalid = val !== "" && (isNaN(numVal) || numVal < 0 || numVal > s.max);
                          
                          return (
                            <div key={s.id} className="px-2">
                              <Input
                                type="number" min={0} max={s.max}
                                value={val}
                                onChange={e => {
                                  setManualValues(prev => ({ ...prev, [st.id]: { ...prev[st.id], [s.id]: e.target.value } }));
                                  setSavedStudents(prev => { const next = new Set(prev); next.delete(st.id); return next; });
                                }}
                                className={`h-8 text-center text-sm px-1 font-mono focus-visible:ring-1 ${isInvalid ? "border-red-500 bg-red-50 focus-visible:ring-red-500" : "bg-muted/20 border-border/50"}`}
                                placeholder="—"
                              />
                            </div>
                          );
                        })}
                        <div className="text-center">
                          <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold ${total > 0 ? getScoreColor(total, TOTAL_MAX).replace("text-", "bg-").replace("-500", "-500/10 text-") + getScoreColor(total, TOTAL_MAX).split(" ")[0].replace("text-", "") : "bg-muted/50 text-muted-foreground/40"}`}>
                            {total > 0 ? total : "—"}
                          </span>
                        </div>
                        <div className="flex justify-end pr-4">
                          <Button
                            size="sm"
                            variant={isSaved ? "secondary" : "default"}
                            className={`h-7 px-3 text-xs shadow-none ${isSaved ? "bg-green-100 text-green-700 hover:bg-green-200 border-green-200 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800" : "bg-primary/90 hover:bg-primary"}`}
                            disabled={!hasSomeValue || isSaving || manualSaving === -1}
                            onClick={() => saveOneStudent(st.id)}
                          >
                            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : isSaved ? "Сохранено" : "Сохранить"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* ── CSV MODE ── */
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center gap-2 flex-wrap text-sm font-medium bg-primary/5 border border-primary/10 rounded-xl p-3">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <span className="text-foreground">Ожидаемые колонки:</span>
                {subjects.map(s => (
                  <Badge key={s.id} variant="secondary" className="bg-background shadow-sm border border-border/50 text-xs py-0.5">{s.short} (0–{s.max})</Badge>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Drag and Drop Zone */}
                <div 
                  onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                  className={`relative flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer ${isDragging ? "border-primary bg-primary/5 scale-[1.02]" : "border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/30"}`}
                  onClick={() => fileRef.current?.click()}
                >
                  <div className={`p-4 rounded-full mb-3 ${isDragging ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    <Upload className="h-8 w-8" />
                  </div>
                  <h3 className="font-semibold text-lg text-foreground mb-1">{isDragging ? "Отпустите файл" : "Нажмите или перетащите файл"}</h3>
                  <p className="text-sm text-muted-foreground text-center mb-4">Поддерживаются форматы .csv и .txt</p>
                  <Button variant="outline" size="sm" className="bg-background pointer-events-none gap-2 rounded-full">
                    <FileText className="h-4 w-4" /> Выбрать файл
                  </Button>
                  <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileChange} />
                </div>
                
                {/* Textarea Paste Zone */}
                <div className="flex flex-col h-full relative">
                  <Label className="text-xs font-semibold mb-2 block text-muted-foreground uppercase tracking-wider">Или вставьте текст CSV</Label>
                  <div className="relative flex-1 group">
                    <textarea
                      value={csvText}
                      onChange={e => handleCsvChange(e.target.value)}
                      placeholder={`ФИО,${subjects.map(s => s.short).join(",")}\nИванов Иван,15,8,7,...`}
                      className="w-full h-full min-h-[160px] rounded-xl border border-input bg-muted/20 px-4 py-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-colors placeholder:text-muted-foreground/40 shadow-sm"
                    />
                    {csvText && (
                      <button onClick={() => setCsvText("")} className="absolute top-2 right-2 p-1.5 bg-background border rounded-md shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted text-muted-foreground hover:text-foreground">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button variant="ghost" size="sm" className="gap-1.5 h-8 text-xs font-medium text-muted-foreground hover:text-foreground" onClick={downloadTemplate} disabled={students.length === 0}>
                      <Download className="h-3.5 w-3.5" />
                      Скачать шаблон
                    </Button>
                  </div>
                </div>
              </div>
              {parseResult && parseResult.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Предпросмотр ({parseResult.length} строк)</span>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-green-600 border-green-200">✓ {validRows.length} ок</Badge>
                      {errorRows.length > 0 && <Badge variant="outline" className="text-red-600 border-red-200">✗ {errorRows.length} ошибок</Badge>}
                    </div>
                  </div>
                  <div className="rounded-md border overflow-auto max-h-52">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/60 border-b sticky top-0">
                          <th className="px-2 py-1.5 text-left font-medium w-7">#</th>
                          <th className="px-2 py-1.5 text-left font-medium">ФИО</th>
                          {subjects.map(s => <th key={s.id} className="px-2 py-1.5 text-center font-medium">{s.short}</th>)}
                          <th className="px-2 py-1.5 text-left font-medium">Статус</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parseResult.map((row, i) => (
                          <tr key={i} className={`border-b last:border-0 ${row.errors.length > 0 ? "bg-red-50 dark:bg-red-950/20" : "hover:bg-muted/20"}`}>
                            <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                            <td className="px-2 py-1 font-medium max-w-[140px] truncate">{row.name}</td>
                            {subjects.map(s => (
                              <td key={s.id} className="px-2 py-1 text-center">
                                {row.scores[s.id] !== "" && row.scores[s.id] != null
                                  ? <span className="font-mono">{row.scores[s.id]}</span>
                                  : <span className="text-muted-foreground/30">—</span>}
                              </td>
                            ))}
                            <td className="px-2 py-1">
                              {row.errors.length === 0
                                ? <span className="text-green-600">✓</span>
                                : <span className="text-red-600 text-[10px]">{row.errors.join("; ")}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t bg-muted/20 flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            {mode === "manual" && groupId && (
              <>{manualFilledCount} / {students.length} заполнено · {savedStudents.size} сохранено</>
            )}
            {mode === "csv" && parseResult && (
              <>{validRows.length} из {parseResult.length} строк готовы к сохранению</>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Закрыть</Button>
            {mode === "manual" ? (
              <Button
                size="sm"
                disabled={manualFilledCount === 0 || manualSaving === -1}
                onClick={saveAllManual}
                className="gap-1.5"
              >
                {manualSaving === -1 ? "Сохранение..." : `Сохранить всё (${manualFilledCount})`}
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={csvSaving || validRows.length === 0}
                onClick={handleCsvSave}
                className="gap-1.5"
              >
                {csvSaving ? "Сохранение..." : `Сохранить ${validRows.length} записей`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
