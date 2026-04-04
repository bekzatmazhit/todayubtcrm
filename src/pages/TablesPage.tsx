import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import {
  fetchDynamicTables, createDynamicTable, updateDynamicTable, deleteDynamicTable,
  fetchDynamicTableRows, createDynamicTableRow, updateDynamicTableRow, deleteDynamicTableRow,
  fetchStudents, fetchUsers, fetchGroups, importGoogleSheet,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { playSave } from "@/lib/sounds";
import {
  Table2, Plus, Trash2, ArrowLeft, Settings2, EyeOff, Lock, Users as UsersIcon,
  Pencil, Search, Download, Upload, Printer, Columns3, X, Sheet,
  Type, Hash, CalendarDays, CheckSquare, Copy, ClipboardCopy, ArrowUpFromLine, ArrowDownFromLine,
  CopyPlus, Palette, GraduationCap, User, UsersRound,
  Eye, ChevronUp, ChevronDown, ChevronsUpDown, SigmaSquare, FileDown, FileText, FileSpreadsheet,
} from "lucide-react";
import * as XLSX from "xlsx";
import { Skeleton } from "@/components/ui/skeleton";
import { addExcelWatermarkSheet, printWithWatermark, getPrintWatermarkStyles, getPrintWatermarkHtml } from "@/lib/watermark";

interface DynamicColumn {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "checkbox";
}

interface DynamicTable {
  id: number;
  creator_id: number;
  title: string;
  columns_json: string;
  visibility: string;
  creator_name: string;
  created_at: string;
  updated_at: string;
}

interface DynamicRow {
  id: number;
  table_id: number;
  row_data: Record<string, string | number | boolean>;
  sort_order: number;
}

const VISIBILITY_OPTIONS = [
  { value: "private", label: "Приватная (Только мне)", icon: EyeOff },
  { value: "all_teachers", label: "Для учителей (редактируют все)", icon: UsersIcon },
  { value: "readonly", label: "Только чтение (другие видят)", icon: Lock },
  { value: "admin_only", label: "Только Админу", icon: Lock },
];

const COL_TYPE_OPTIONS = [
  { value: "text", label: "Текст", icon: Type },
  { value: "number", label: "Число", icon: Hash },
  { value: "date", label: "Дата", icon: CalendarDays },
  { value: "checkbox", label: "Чекбокс", icon: CheckSquare },
];

/* ====================== DEBOUNCE HOOK ====================== */

function useDebouncedSave(delay = 1500) {
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const save = useCallback((key: string, fn: () => void) => {
    const existing = timers.current.get(key);
    if (existing) clearTimeout(existing);
    timers.current.set(key, setTimeout(() => { fn(); timers.current.delete(key); }, delay));
  }, [delay]);
  useEffect(() => { return () => { timers.current.forEach((t) => clearTimeout(t)); }; }, []);
  return save;
}

/* ====================== SMART CHIP HELPERS ====================== */

// Format: @[type:id:name] — stored in cell data
const MENTION_REGEX = /@\[(student|teacher|group):(\d+):([^\]]+)\]/g;

interface MentionItem {
  type: "student" | "teacher" | "group";
  id: number;
  name: string;
}

function parseMentions(text: string): (string | MentionItem)[] {
  const parts: (string | MentionItem)[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(MENTION_REGEX.source, "g");
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push({ type: match[1] as MentionItem["type"], id: Number(match[2]), name: match[3] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function SmartChipBadge({ item }: { item: MentionItem }) {
  const config = {
    student: { icon: GraduationCap, bg: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20" },
    teacher: { icon: User, bg: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" },
    group: { icon: UsersRound, bg: "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20" },
  }[item.type];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium rounded-md border ${config.bg} cursor-default whitespace-nowrap`}>
      <Icon className="h-3 w-3" />
      {item.name}
    </span>
  );
}

function CellWithChips({ text }: { text: string }) {
  const parts = parseMentions(text);
  if (parts.length === 1 && typeof parts[0] === "string") return <>{parts[0] || <span className="text-muted-foreground/30">&mdash;</span>}</>;
  return (
    <span className="inline-flex items-center gap-0.5 flex-wrap">
      {parts.map((part, i) =>
        typeof part === "string" ? <span key={i}>{part}</span> : <SmartChipBadge key={i} item={part} />
      )}
    </span>
  );
}

/* ====================== MENTION DROPDOWN ====================== */

let _mentionCache: { students: any[]; teachers: any[]; groups: any[] } | null = null;

function MentionDropdown({ query, position, onSelect, onClose }: {
  query: string;
  position: { x: number; y: number };
  onSelect: (item: MentionItem) => void;
  onClose: () => void;
}) {
  const [data, setData] = useState(_mentionCache);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (_mentionCache) return;
    Promise.all([fetchStudents(), fetchUsers(), fetchGroups()]).then(([students, users, groups]) => {
      _mentionCache = { students, teachers: users.filter((u: any) => u.role === "teacher" || u.role === "admin" || u.role === "umo_head"), groups };
      setData(_mentionCache);
    });
  }, []);

  const results = useMemo(() => {
    if (!data) return [];
    const q = query.toLowerCase();
    const items: MentionItem[] = [];
    data.students.filter((s: any) => s.full_name?.toLowerCase().includes(q)).slice(0, 5)
      .forEach((s: any) => items.push({ type: "student", id: s.id, name: s.full_name }));
    data.teachers.filter((t: any) => t.full_name?.toLowerCase().includes(q)).slice(0, 5)
      .forEach((t: any) => items.push({ type: "teacher", id: t.id, name: t.full_name }));
    data.groups.filter((g: any) => g.name?.toLowerCase().includes(q)).slice(0, 5)
      .forEach((g: any) => items.push({ type: "group", id: g.id, name: g.name }));
    return items;
  }, [data, query]);

  useEffect(() => { setSelectedIdx(0); }, [query]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); e.stopPropagation(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); e.stopPropagation(); setSelectedIdx(i => Math.max(i - 1, 0)); }
      else if (e.key === "Enter" && results.length > 0) { e.preventDefault(); e.stopPropagation(); onSelect(results[selectedIdx]); }
      else if (e.key === "Escape") { e.preventDefault(); onClose(); }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [results, selectedIdx, onSelect, onClose]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIdx]);

  const menuX = Math.min(position.x, window.innerWidth - 280);
  const menuY = Math.min(position.y, window.innerHeight - 300);

  const categoryLabel = (type: string) => type === "student" ? "Ученики" : type === "teacher" ? "Учителя" : "Группы";
  let lastType = "";

  return (
    <div ref={listRef} className="fixed z-[60] bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[250px] max-h-[260px] overflow-y-auto animate-in fade-in zoom-in-95 duration-100"
      style={{ left: menuX, top: menuY }}>
      {!data ? (
        <div className="px-3 py-4 text-sm text-muted-foreground text-center">Загрузка...</div>
      ) : results.length === 0 ? (
        <div className="px-3 py-4 text-sm text-muted-foreground text-center">Не найдено</div>
      ) : (
        results.map((item, idx) => {
          const showHeader = item.type !== lastType;
          lastType = item.type;
          const cfg = { student: { icon: GraduationCap, color: "text-blue-500" }, teacher: { icon: User, color: "text-emerald-500" }, group: { icon: UsersRound, color: "text-violet-500" } }[item.type];
          return (
            <div key={`${item.type}-${item.id}`}>
              {showHeader && <div className="px-3 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{categoryLabel(item.type)}</div>}
              <button data-idx={idx}
                className={`w-full px-3 py-1.5 text-sm text-left flex items-center gap-2 transition-colors ${idx === selectedIdx ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
                onClick={() => onSelect(item)}>
                <cfg.icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                {item.name}
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}

/* ====================== CONTEXT MENU ====================== */

interface ContextMenuState { x: number; y: number; rowId: number; colKey: string | null; }

const ROW_COLORS = [
  { value: "", label: "Без цвета", class: "" },
  { value: "green", label: "Зелёный", class: "bg-green-500/10 hover:bg-green-500/15" },
  { value: "yellow", label: "Жёлтый", class: "bg-yellow-500/10 hover:bg-yellow-500/15" },
  { value: "red", label: "Красный", class: "bg-red-500/10 hover:bg-red-500/15" },
  { value: "blue", label: "Синий", class: "bg-blue-500/10 hover:bg-blue-500/15" },
  { value: "purple", label: "Фиолетовый", class: "bg-purple-500/10 hover:bg-purple-500/15" },
];

function ContextMenu({ state, rows, columns, onClose, onDeleteRow, onClearCell, onCopyCell, onCopyRow, onDuplicateRow, onInsertRow, onSetRowColor, rowColors }: {
  state: ContextMenuState; rows: DynamicRow[]; columns: DynamicColumn[];
  onClose: () => void; onDeleteRow: () => void; onClearCell: () => void;
  onCopyCell: () => void; onCopyRow: () => void; onDuplicateRow: () => void;
  onInsertRow: (position: "above" | "below") => void;
  onSetRowColor: (color: string) => void;
  rowColors: Record<number, string>;
}) {
  const [showColors, setShowColors] = useState(false);
  const currentColor = rowColors[state.rowId] || "";

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-table-ctx-menu]")) onClose();
    };
    window.addEventListener("click", handler);
    window.addEventListener("contextmenu", handler);
    return () => { window.removeEventListener("click", handler); window.removeEventListener("contextmenu", handler); };
  }, [onClose]);

  const menuX = Math.min(state.x, window.innerWidth - 220);
  const menuY = Math.min(state.y, window.innerHeight - 380);

  return (
    <div data-table-ctx-menu className="fixed z-50 bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[200px] animate-in fade-in zoom-in-95 duration-100"
      style={{ left: menuX, top: menuY }} onClick={(e) => e.stopPropagation()}>
      {state.colKey && (
        <>
          <button className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 transition-colors"
            onClick={() => { onCopyCell(); onClose(); }}>
            <Copy className="h-3.5 w-3.5 text-muted-foreground" /> Копировать ячейку
          </button>
          <button className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 transition-colors"
            onClick={() => { onClearCell(); onClose(); }}>
            <X className="h-3.5 w-3.5 text-muted-foreground" /> Очистить ячейку
          </button>
          <div className="border-t border-border my-1" />
        </>
      )}
      <button className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 transition-colors"
        onClick={() => { onCopyRow(); onClose(); }}>
        <ClipboardCopy className="h-3.5 w-3.5 text-muted-foreground" /> Копировать строку
      </button>
      <button className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 transition-colors"
        onClick={() => { onDuplicateRow(); onClose(); }}>
        <CopyPlus className="h-3.5 w-3.5 text-muted-foreground" /> Дублировать строку
      </button>
      <div className="border-t border-border my-1" />
      <button className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 transition-colors"
        onClick={() => { onInsertRow("above"); onClose(); }}>
        <ArrowUpFromLine className="h-3.5 w-3.5 text-muted-foreground" /> Вставить строку выше
      </button>
      <button className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 transition-colors"
        onClick={() => { onInsertRow("below"); onClose(); }}>
        <ArrowDownFromLine className="h-3.5 w-3.5 text-muted-foreground" /> Вставить строку ниже
      </button>
      <div className="border-t border-border my-1" />
      <div className="relative">
        <button className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 transition-colors"
          onClick={() => setShowColors(!showColors)}>
          <Palette className="h-3.5 w-3.5 text-muted-foreground" /> Цветовая пометка
          <span className="ml-auto text-xs text-muted-foreground">▸</span>
        </button>
        {showColors && (
          <div className="absolute left-full top-0 bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[160px] ml-1 animate-in fade-in zoom-in-95 duration-100">
            {ROW_COLORS.map((c) => (
              <button key={c.value} className={`w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 transition-colors ${currentColor === c.value ? "font-semibold" : ""}`}
                onClick={() => { onSetRowColor(c.value); onClose(); }}>
                {c.value ? <span className={`w-3 h-3 rounded-full ${c.value === "green" ? "bg-green-500" : c.value === "yellow" ? "bg-yellow-500" : c.value === "red" ? "bg-red-500" : c.value === "blue" ? "bg-blue-500" : "bg-purple-500"}`} />
                  : <span className="w-3 h-3 rounded-full border border-border" />}
                {c.label}
                {currentColor === c.value && <span className="ml-auto text-xs">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="border-t border-border my-1" />
      <button className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 text-destructive transition-colors"
        onClick={() => { onDeleteRow(); onClose(); }}>
        <Trash2 className="h-3.5 w-3.5" /> Удалить строку
      </button>
    </div>
  );
}

/* ====================== SPREADSHEET TABLE ====================== */

function SpreadsheetTable({ columns: allColumns, rows, canEdit, onCellChange, onAddRow, onDeleteRow, onClearCell, onCopyCell, onCopyRow, onDuplicateRow, onInsertRow, rowColors, onSetRowColor }: {
  columns: DynamicColumn[]; rows: DynamicRow[]; canEdit: boolean;
  onCellChange: (rowId: number, key: string, value: string | number | boolean) => void;
  onAddRow: () => void; onDeleteRow: (rowId: number) => void; onClearCell: (rowId: number, colKey: string) => void;
  onCopyCell: (rowId: number, colKey: string) => void; onCopyRow: (rowId: number) => void;
  onDuplicateRow: (rowId: number) => void; onInsertRow: (rowId: number, position: "above" | "below") => void;
  rowColors: Record<number, string>; onSetRowColor: (rowId: number, color: string) => void;
}) {
  const [editingCell, setEditingCell] = useState<{ rowId: number; colKey: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cellRefs = useRef<Map<string, HTMLElement>>(new Map());
  const cellKey = (r: number, c: number) => `${r}-${c}`;

  // ---- Multi-cell selection ----
  const [selAnchor, setSelAnchor] = useState<{ r: number; c: number } | null>(null);
  const [selEnd, setSelEnd] = useState<{ r: number; c: number } | null>(null);

  // ---- @mention state ----
  const [mentionState, setMentionState] = useState<{ query: string; position: { x: number; y: number }; cursorPos: number } | null>(null);

  // ---- NEW: sort, visibility, resize, search ----
  const [sortConfig, setSortConfig] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [showColPanel, setShowColPanel] = useState(false);
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const resizeRef = useRef<{ key: string; startX: number; startW: number } | null>(null);
  const [tableSearch, setTableSearch] = useState("");

  // ---- Derived: visible columns ----
  const columns = useMemo(() => allColumns.filter(c => !hiddenCols.has(c.key)), [allColumns, hiddenCols]);

  // ---- Derived: processed rows (filter + sort) ----
  const processedRows = useMemo(() => {
    let arr = [...rows];
    if (tableSearch.trim()) {
      const q = tableSearch.trim().toLowerCase();
      arr = arr.filter(r => allColumns.some(col => String(r.row_data[col.key] ?? "").toLowerCase().includes(q)));
    }
    if (sortConfig) {
      arr.sort((a, b) => {
        const va = a.row_data[sortConfig.key] ?? "";
        const vb = b.row_data[sortConfig.key] ?? "";
        const na = Number(va); const nb = Number(vb);
        const isNum = !isNaN(na) && !isNaN(nb) && va !== "" && vb !== "";
        const cmp = isNum ? na - nb : String(va).localeCompare(String(vb), "ru");
        return sortConfig.dir === "asc" ? cmp : -cmp;
      });
    }
    return arr;
  }, [rows, allColumns, tableSearch, sortConfig]);

  // ---- Derived: stats for number columns ----
  const numStats = useMemo(() => {
    return columns.filter(c => c.type === "number").map(col => {
      const vals = processedRows.map(r => r.row_data[col.key]).filter(v => v !== "" && v != null).map(v => Number(v)).filter(v => !isNaN(v));
      const sum = vals.reduce((a, b) => a + b, 0);
      return { key: col.key, sum, avg: vals.length ? +(sum / vals.length).toFixed(1) : 0, count: vals.length };
    });
  }, [columns, processedRows]);

  // ---- Derived: selection range ----
  const selRange = useMemo(() => {
    if (!selAnchor) return null;
    const end = selEnd || selAnchor;
    return { r1: Math.min(selAnchor.r, end.r), r2: Math.max(selAnchor.r, end.r), c1: Math.min(selAnchor.c, end.c), c2: Math.max(selAnchor.c, end.c) };
  }, [selAnchor, selEnd]);

  const isSelected = (ri: number, ci: number) => selRange ? ri >= selRange.r1 && ri <= selRange.r2 && ci >= selRange.c1 && ci <= selRange.c2 : false;
  const isMultiSelect = selRange && (selRange.r1 !== selRange.r2 || selRange.c1 !== selRange.c2);

  // ---- Resize handler ----
  const startResize = useCallback((e: React.MouseEvent, key: string) => {
    e.preventDefault(); e.stopPropagation();
    const startW = colWidths[key] || 150;
    resizeRef.current = { key, startX: e.clientX, startW };
    const onMove = (me: MouseEvent) => {
      if (!resizeRef.current) return;
      setColWidths(prev => ({ ...prev, [resizeRef.current!.key]: Math.max(60, resizeRef.current!.startW + me.clientX - resizeRef.current!.startX) }));
    };
    const onUp = () => { resizeRef.current = null; document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [colWidths]);

  // ---- Sort handler ----
  const handleSort = (colKey: string) => {
    setSortConfig(prev => {
      if (!prev || prev.key !== colKey) return { key: colKey, dir: "asc" };
      if (prev.dir === "asc") return { key: colKey, dir: "desc" };
      return null;
    });
  };

  const startEditing = (rowId: number, col: DynamicColumn, val: string | number | boolean) => {
    if (!canEdit || col.type === "checkbox") return;
    setEditingCell({ rowId, colKey: col.key });
    setEditValue(String(val ?? ""));
    setMentionState(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commitEdit = () => {
    if (!editingCell) return;
    const col = columns.find(c => c.key === editingCell.colKey);
    let finalVal: string | number = editValue;
    if (col?.type === "number") finalVal = editValue === "" ? "" : Number(editValue);
    onCellChange(editingCell.rowId, editingCell.colKey, finalVal);
    setEditingCell(null); setEditValue(""); setMentionState(null);
  };

  const cancelEdit = () => { setEditingCell(null); setEditValue(""); setMentionState(null); };

  const moveFocus = (ri: number, ci: number) => {
    ri = Math.max(0, Math.min(ri, processedRows.length - 1));
    ci = Math.max(0, Math.min(ci, columns.length - 1));
    cellRefs.current.get(cellKey(ri, ci))?.focus();
  };

  // ---- Handle @mention input ----
  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEditValue(val);
    const cursorPos = e.target.selectionStart ?? val.length;
    const textBefore = val.slice(0, cursorPos);
    const atIdx = textBefore.lastIndexOf("@");
    if (atIdx !== -1) {
      const query = textBefore.slice(atIdx + 1);
      if (atIdx === 0 || /\s/.test(textBefore[atIdx - 1])) {
        const inputEl = inputRef.current;
        if (inputEl) {
          const rect = inputEl.getBoundingClientRect();
          setMentionState({ query, position: { x: rect.left, y: rect.bottom + 4 }, cursorPos });
          return;
        }
      }
    }
    setMentionState(null);
  };

  const handleMentionSelect = (item: MentionItem) => {
    if (!mentionState) return;
    const cursorPos = mentionState.cursorPos;
    const textBefore = editValue.slice(0, cursorPos);
    const atIdx = textBefore.lastIndexOf("@");
    const before = editValue.slice(0, atIdx);
    const after = editValue.slice(cursorPos);
    const chip = `@[${item.type}:${item.id}:${item.name}]`;
    const newVal = before + chip + " " + after;
    setEditValue(newVal);
    setMentionState(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // ---- Clipboard: Ctrl+C / Ctrl+V ----
  const handleCopySelection = () => {
    if (!selRange) return;
    const lines: string[] = [];
    for (let r = selRange.r1; r <= selRange.r2; r++) {
      const row = processedRows[r];
      if (!row) continue;
      const cells: string[] = [];
      for (let c = selRange.c1; c <= selRange.c2; c++) {
        const col = columns[c];
        if (!col) continue;
        const val = row.row_data[col.key];
        cells.push(String(val ?? ""));
      }
      lines.push(cells.join("\t"));
    }
    navigator.clipboard.writeText(lines.join("\n"));
    toast.success(`Скопировано ${selRange.r2 - selRange.r1 + 1}×${selRange.c2 - selRange.c1 + 1} ячеек`);
  };

  const handlePasteSelection = async (ri: number, ci: number) => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      const lines = text.split("\n");
      lines.forEach((line, lineIdx) => {
        const cells = line.split("\t");
        const rowIdx = ri + lineIdx;
        if (rowIdx >= processedRows.length) return;
        const row = processedRows[rowIdx];
        cells.forEach((cellVal, cellIdx) => {
          const colIdx = ci + cellIdx;
          if (colIdx >= columns.length) return;
          const col = columns[colIdx];
          if (col.type === "checkbox") {
            const v = cellVal.toLowerCase();
            onCellChange(row.id, col.key, v === "true" || v === "да" || v === "1");
          } else if (col.type === "number") {
            const n = Number(cellVal);
            onCellChange(row.id, col.key, isNaN(n) ? cellVal : n);
          } else {
            onCellChange(row.id, col.key, cellVal);
          }
        });
      });
      toast.success("Вставлено из буфера обмена");
    } catch { /* clipboard not available */ }
  };

  const handleKeyDown = (e: React.KeyboardEvent, ri: number, ci: number) => {
    if (mentionState) return;

    if (editingCell) {
      if (e.key === "Enter") { e.preventDefault(); commitEdit(); moveFocus(ri + 1, ci); }
      else if (e.key === "Escape") cancelEdit();
      else if (e.key === "Tab") { e.preventDefault(); commitEdit(); moveFocus(ri, e.shiftKey ? ci - 1 : ci + 1); }
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === "c") {
      e.preventDefault();
      if (isMultiSelect) { handleCopySelection(); }
      else { const row = processedRows[ri]; const col = columns[ci]; if (row && col) { navigator.clipboard.writeText(String(row.row_data[col.key] ?? "")); toast.success("Ячейка скопирована"); } }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "v" && canEdit) {
      e.preventDefault();
      handlePasteSelection(ri, ci);
      return;
    }

    if (e.shiftKey && ["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(e.key)) {
      e.preventDefault();
      const anchor = selAnchor || { r: ri, c: ci };
      if (!selAnchor) setSelAnchor(anchor);
      const end = selEnd || anchor;
      let nr = end.r, nc = end.c;
      if (e.key === "ArrowDown") nr = Math.min(nr + 1, processedRows.length - 1);
      if (e.key === "ArrowUp") nr = Math.max(nr - 1, 0);
      if (e.key === "ArrowRight") nc = Math.min(nc + 1, columns.length - 1);
      if (e.key === "ArrowLeft") nc = Math.max(nc - 1, 0);
      setSelEnd({ r: nr, c: nc });
      moveFocus(nr, nc);
      return;
    }

    switch (e.key) {
      case "ArrowDown":  e.preventDefault(); setSelAnchor(null); setSelEnd(null); moveFocus(ri + 1, ci); break;
      case "ArrowUp":    e.preventDefault(); setSelAnchor(null); setSelEnd(null); moveFocus(ri - 1, ci); break;
      case "ArrowRight": e.preventDefault(); setSelAnchor(null); setSelEnd(null); moveFocus(ri, ci + 1); break;
      case "ArrowLeft":  e.preventDefault(); setSelAnchor(null); setSelEnd(null); moveFocus(ri, ci - 1); break;
      case "Enter": case "F2":
        e.preventDefault();
        if (canEdit && processedRows[ri]) { const col = columns[ci]; if (col && col.type !== "checkbox") startEditing(processedRows[ri].id, col, processedRows[ri].row_data[col.key] ?? ""); }
        break;
      case "Delete":
        e.preventDefault();
        if (canEdit) {
          if (isMultiSelect && selRange) {
            for (let r = selRange.r1; r <= selRange.r2; r++) {
              for (let c = selRange.c1; c <= selRange.c2; c++) {
                const row = processedRows[r]; const col = columns[c];
                if (row && col) onCellChange(row.id, col.key, col.type === "checkbox" ? false : "");
              }
            }
          } else if (processedRows[ri]) {
            const col = columns[ci]; if (col) onCellChange(processedRows[ri].id, col.key, col.type === "checkbox" ? false : "");
          }
        }
        break;
      case "Escape":
        setSelAnchor(null); setSelEnd(null);
        break;
      default:
        if (canEdit && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && processedRows[ri]) {
          const col = columns[ci];
          if (col && col.type !== "checkbox") {
            setSelAnchor(null); setSelEnd(null);
            setEditingCell({ rowId: processedRows[ri].id, colKey: col.key }); setEditValue(e.key);
            setTimeout(() => inputRef.current?.focus(), 0);
          }
        }
    }
  };

  const handleCellClick = (e: React.MouseEvent, ri: number, ci: number) => {
    if (e.shiftKey) {
      e.preventDefault();
      if (!selAnchor) setSelAnchor({ r: ri, c: ci });
      setSelEnd({ r: ri, c: ci });
    } else {
      setSelAnchor({ r: ri, c: ci });
      setSelEnd(null);
    }
    cellRefs.current.get(cellKey(ri, ci))?.focus();
  };

  const setCellRef = (ri: number, ci: number, el: HTMLElement | null) => { const k = cellKey(ri, ci); if (el) cellRefs.current.set(k, el); else cellRefs.current.delete(k); };
  const handleCtx = (e: React.MouseEvent, rowId: number, ck: string | null) => { if (!canEdit) return; e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, rowId, colKey: ck }); };

  const renderCell = (row: DynamicRow, col: DynamicColumn, ri: number, ci: number) => {
    const isEditing = editingCell?.rowId === row.id && editingCell?.colKey === col.key;
    const value = row.row_data[col.key];
    const selected = isSelected(ri, ci);
    const selClass = selected ? "bg-primary/10 ring-1 ring-inset ring-primary/30" : "";

    if (col.type === "checkbox") {
      return (
        <td key={col.key} ref={(el) => setCellRef(ri, ci, el)} tabIndex={0}
          className={`px-3 py-2 border-r border-border text-center focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-inset ${selClass}`}
          onClick={(e) => handleCellClick(e, ri, ci)}
          onKeyDown={(e) => handleKeyDown(e, ri, ci)} onContextMenu={(e) => handleCtx(e, row.id, col.key)}>
          <Checkbox checked={value === true || value === "true" || value === 1}
            onCheckedChange={(checked) => { if (canEdit) onCellChange(row.id, col.key, !!checked); }}
            disabled={!canEdit} className="mx-auto" />
        </td>
      );
    }
    if (isEditing) {
      return (
        <td key={col.key} className="p-0 border-r border-border relative">
          <input ref={inputRef} type={col.type === "number" ? "number" : col.type === "date" ? "date" : "text"}
            value={editValue}
            onChange={col.type === "text" ? handleEditInputChange : (e) => setEditValue(e.target.value)}
            onBlur={() => { if (!mentionState) commitEdit(); }}
            onKeyDown={(e) => handleKeyDown(e, ri, ci)}
            className="w-full h-full px-3 py-2 text-sm bg-primary/5 border-2 border-primary outline-none" autoFocus />
          {mentionState && col.type === "text" && (
            <MentionDropdown query={mentionState.query} position={mentionState.position}
              onSelect={handleMentionSelect} onClose={() => setMentionState(null)} />
          )}
        </td>
      );
    }
    const locale = { ru: "ru-RU", kk: "kk-KZ", en: "en-US" }[typeof window !== "undefined" ? (localStorage.getItem("language") || "ru") : "ru"] ?? "ru-RU";
    const displayContent = col.type === "text" && typeof value === "string" && value.includes("@[")
      ? <CellWithChips text={value} />
      : col.type === "date" && value
        ? (() => { try { return new Date(String(value)).toLocaleDateString(locale); } catch { return String(value); } })()
        : String(value ?? "") || <span className="text-muted-foreground/30">&mdash;</span>;

    return (
      <td key={col.key} ref={(el) => setCellRef(ri, ci, el)} tabIndex={0}
        className={`px-3 py-2 text-sm border-r border-border cursor-cell select-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-inset hover:bg-muted/40 transition-colors ${selClass}`}
        onDoubleClick={() => startEditing(row.id, col, value ?? "")}
        onClick={(e) => handleCellClick(e, ri, ci)}
        onKeyDown={(e) => handleKeyDown(e, ri, ci)} onContextMenu={(e) => handleCtx(e, row.id, col.key)}>
        {displayContent}
      </td>
    );
  };

  return (
    <div className="relative" data-no-global-ctx onClick={() => showColPanel && setShowColPanel(false)}>
      {/* ── Toolbar: search + column visibility + sort badge ── */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input type="text" value={tableSearch} onChange={e => setTableSearch(e.target.value)}
            placeholder="Поиск в таблице..." className="h-8 pl-8 pr-3 text-sm border border-border rounded-md bg-background w-full focus:outline-none focus:ring-1 focus:ring-primary/50" />
        </div>
        <div className="relative" onClick={e => e.stopPropagation()}>
          <button onClick={() => setShowColPanel(v => !v)}
            className={`h-8 px-2.5 text-xs border border-border rounded-md flex items-center gap-1.5 transition-colors ${hiddenCols.size > 0 ? "bg-primary/10 text-primary border-primary/30" : "bg-background hover:bg-muted"}`}>
            <Eye className="h-3.5 w-3.5" />
            <span>Колонки</span>
            {hiddenCols.size > 0 && <span className="bg-primary text-primary-foreground rounded-full text-[9px] w-4 h-4 flex items-center justify-center font-bold">{hiddenCols.size}</span>}
          </button>
          {showColPanel && (
            <div className="absolute right-0 top-9 bg-popover border border-border rounded-lg shadow-xl p-2 z-50 min-w-[180px]">
              <p className="text-[11px] font-semibold text-muted-foreground mb-1 px-1 uppercase tracking-wide">Видимость колонок</p>
              {allColumns.map(col => (
                <label key={col.key} className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded cursor-pointer">
                  <input type="checkbox" checked={!hiddenCols.has(col.key)}
                    onChange={() => setHiddenCols(prev => { const next = new Set(prev); if (next.has(col.key)) next.delete(col.key); else next.add(col.key); return next; })}
                    className="h-3.5 w-3.5 accent-primary" />
                  <span className="text-sm">{col.label}</span>
                </label>
              ))}
              {hiddenCols.size > 0 && (
                <button onClick={() => setHiddenCols(new Set())} className="w-full mt-1 px-2 py-1 text-[11px] text-primary hover:bg-primary/10 rounded transition-colors text-left">
                  Показать все
                </button>
              )}
            </div>
          )}
        </div>
        {sortConfig && (
          <button onClick={() => setSortConfig(null)} className="h-8 px-2 text-[11px] border border-border rounded-md bg-muted/50 hover:bg-muted flex items-center gap-1 text-muted-foreground">
            {sortConfig.dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {allColumns.find(c => c.key === sortConfig.key)?.label}
            <X className="h-3 w-3 ml-0.5" />
          </button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {(tableSearch.trim() || sortConfig) && rows.length !== processedRows.length
            ? <span className="text-primary font-medium">{processedRows.length}</span>
            : processedRows.length} / {rows.length} строк
        </span>
      </div>

      {/* ── Table ── */}
      <div className="overflow-auto max-h-[calc(100vh-18rem)] border rounded-lg bg-background">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-muted/70 backdrop-blur-sm border-b-2 border-border">
              <th className="px-3 py-2.5 text-left text-xs font-bold text-muted-foreground w-12 border-r border-border sticky left-0 bg-muted/70 z-20">#</th>
              {columns.map((col) => {
                const w = colWidths[col.key];
                const isSorted = sortConfig?.key === col.key;
                return (
                  <th key={col.key} style={w ? { width: w, minWidth: w } : { minWidth: 120 }}
                    className="relative text-left text-xs font-bold text-muted-foreground border-r border-border group/th">
                    <div className="flex items-center gap-1 px-3 py-2.5 cursor-pointer select-none hover:bg-muted/50 transition-colors pr-4"
                      onClick={() => handleSort(col.key)}>
                      {col.type === "number" && <Hash className="h-3 w-3 shrink-0" />}
                      {col.type === "date" && <CalendarDays className="h-3 w-3 shrink-0" />}
                      {col.type === "checkbox" && <CheckSquare className="h-3 w-3 shrink-0" />}
                      {col.type === "text" && <Type className="h-3 w-3 shrink-0" />}
                      <span className="truncate">{col.label}</span>
                      {isSorted
                        ? (sortConfig!.dir === "asc" ? <ChevronUp className="h-3 w-3 ml-auto shrink-0 text-primary" /> : <ChevronDown className="h-3 w-3 ml-auto shrink-0 text-primary" />)
                        : <ChevronsUpDown className="h-3 w-3 ml-auto shrink-0 opacity-0 group-hover/th:opacity-40 transition-opacity" />
                      }
                    </div>
                    {/* Resize handle */}
                    <div className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/50 active:bg-primary transition-colors z-10"
                      onMouseDown={(e) => startResize(e, col.key)} />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {processedRows.map((row, ri) => {
              const colorVal = rowColors[row.id] || "";
              const colorClass = ROW_COLORS.find(c => c.value === colorVal)?.class || "";
              return (
                <tr key={row.id} className={`border-b border-border/60 transition-colors ${colorClass || "hover:bg-muted/20"}`}
                  onContextMenu={(e) => handleCtx(e, row.id, null)}>
                  <td className={`px-3 py-2 text-xs text-muted-foreground/70 border-r border-border sticky left-0 font-mono ${colorClass ? colorClass : "bg-background"}`}>{ri + 1}</td>
                  {columns.map((col, ci) => renderCell(row, col, ri, ci))}
                </tr>
              );
            })}
          </tbody>
          {/* Stats footer row for number columns */}
          {numStats.length > 0 && processedRows.length > 0 && (
            <tfoot>
              <tr className="bg-muted/40 border-t-2 border-border">
                <td className="px-3 py-1.5 sticky left-0 bg-muted/40">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                    <SigmaSquare className="h-3 w-3" /> Σ
                  </div>
                </td>
                {columns.map(col => {
                  const stat = numStats.find(s => s.key === col.key);
                  return (
                    <td key={col.key} className="px-3 py-1.5 border-r border-border">
                      {stat ? (
                        <div className="text-right">
                          <span className="text-xs font-semibold text-foreground" title={`Сумма: ${stat.sum} | Среднее: ${stat.avg} | Заполнено: ${stat.count} строк`}>
                            {stat.sum.toLocaleString("ru-RU")}
                          </span>
                          <span className="text-[10px] text-muted-foreground ml-1.5">∅{stat.avg}</span>
                        </div>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          )}
        </table>
        {rows.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Table2 className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">Пустая таблица</p>
            <p className="text-xs mt-1">Нажмите «Добавить строку» чтобы начать</p>
          </div>
        )}
        {rows.length > 0 && processedRows.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">Нет совпадений</p>
            <p className="text-xs mt-1">Попробуйте другой запрос</p>
          </div>
        )}
      </div>
      {canEdit && (
        <button onClick={onAddRow}
          className="w-full py-2 text-sm text-muted-foreground hover:text-primary hover:bg-muted/50 border border-t-0 border-border rounded-b-lg transition-colors flex items-center justify-center gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Добавить строку
        </button>
      )}
      {ctxMenu && <ContextMenu state={ctxMenu} rows={processedRows} columns={columns} onClose={() => setCtxMenu(null)}
        onDeleteRow={() => onDeleteRow(ctxMenu.rowId)}
        onClearCell={() => { if (ctxMenu.colKey) onClearCell(ctxMenu.rowId, ctxMenu.colKey); }}
        onCopyCell={() => { if (ctxMenu.colKey) onCopyCell(ctxMenu.rowId, ctxMenu.colKey); }}
        onCopyRow={() => onCopyRow(ctxMenu.rowId)}
        onDuplicateRow={() => onDuplicateRow(ctxMenu.rowId)}
        onInsertRow={(pos) => onInsertRow(ctxMenu.rowId, pos)}
        onSetRowColor={(color) => onSetRowColor(ctxMenu.rowId, color)}
        rowColors={rowColors} />}
    </div>
  );
}

/* ====================== ADD COLUMN DIALOG ====================== */

function AddColumnDialog({ open, onOpenChange, onAdd }: {
  open: boolean; onOpenChange: (o: boolean) => void; onAdd: (label: string, type: DynamicColumn["type"]) => void;
}) {
  const [label, setLabel] = useState(""); const [type, setType] = useState<DynamicColumn["type"]>("text");
  const handleAdd = () => { if (!label.trim()) return; onAdd(label.trim(), type); setLabel(""); setType("text"); onOpenChange(false); };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Columns3 className="h-5 w-5" /> Добавить колонку</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Название</label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Название колонки" className="mt-1" autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }} />
          </div>
          <div>
            <label className="text-sm font-medium">Тип данных</label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {COL_TYPE_OPTIONS.map((opt) => (
                <button key={opt.value} onClick={() => setType(opt.value as DynamicColumn["type"])}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-all ${type === opt.value ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:bg-muted"}`}>
                  <opt.icon className="h-4 w-4" /> {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
            <Button onClick={handleAdd} disabled={!label.trim()}>Добавить</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TablesPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [tables, setTables] = useState<DynamicTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newVisibility, setNewVisibility] = useState("private");
  const [newColumns, setNewColumns] = useState<DynamicColumn[]>([{ key: "col_1", label: "Колонка 1", type: "text" }]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editVisibility, setEditVisibility] = useState("private");
  const [editColumns, setEditColumns] = useState<DynamicColumn[]>([]);
  const [activeTable, setActiveTable] = useState<DynamicTable | null>(null);
  const [rows, setRows] = useState<DynamicRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [addColOpen, setAddColOpen] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  const debouncedSave = useDebouncedSave(1500);
  const latestRows = useRef(rows);
  latestRows.current = rows;
  const [rowColors, setRowColors] = useState<Record<number, string>>({});

  // Google Sheets import
  const [gsImportOpen, setGsImportOpen] = useState(false);
  const [gsUrl, setGsUrl] = useState("");
  const [gsImporting, setGsImporting] = useState(false);
  const [gsPreview, setGsPreview] = useState<{ sheets: { gid: string; name: string; headers: string[]; rows: string[][] }[] } | null>(null);
  const [gsActiveSheet, setGsActiveSheet] = useState(0);

  const loadTables = useCallback(async () => {
    try { const data = await fetchDynamicTables(user ? parseInt(user.id) : undefined); setTables(data); }
    catch (e) { console.error("Error loading tables:", e); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { loadTables(); }, [loadTables]);

  const loadRows = async (tableId: number) => {
    setRowsLoading(true);
    try { const data = await fetchDynamicTableRows(tableId); setRows(data); }
    catch (e) { console.error("Error loading rows:", e); }
    finally { setRowsLoading(false); }
  };

  const openTable = async (table: DynamicTable) => { setActiveTable(table); await loadRows(table.id); };

  const handleCreateTable = async () => {
    if (!newTitle.trim() || !user) return;
    try {
      await createDynamicTable({ creator_id: parseInt(user.id), title: newTitle.trim(), columns_json: newColumns, visibility: newVisibility });
      toast.success("Таблица создана");
      setCreateOpen(false); setNewTitle(""); setNewColumns([{ key: "col_1", label: "Колонка 1", type: "text" }]); setNewVisibility("private");
      await loadTables();
    } catch { toast.error("Ошибка создания таблицы"); }
  };

  const handleDeleteTable = (id: number) => {
    const deleted = tables.find((t) => t.id === id);
    setTables((p) => p.filter((t) => t.id !== id));
    if (activeTable?.id === id) { setActiveTable(null); setRows([]); }
    const timer = setTimeout(() => { deleteDynamicTable(id).catch(() => toast.error("Ошибка удаления")); }, 5000);
    toast("Таблица удалена", {
      duration: 5000,
      action: { label: "Отменить", onClick: () => { clearTimeout(timer); if (deleted) setTables((p) => [...p, deleted]); } },
    });
  };

  const handleAddRow = async () => {
    if (!activeTable) return;
    const columns = parseColumns(activeTable.columns_json);
    const emptyRow: Record<string, string | boolean> = {};
    columns.forEach((c) => { emptyRow[c.key] = c.type === "checkbox" ? false : ""; });
    try { const newRow = await createDynamicTableRow(activeTable.id, emptyRow); setRows((prev) => [...prev, newRow]); }
    catch { toast.error("Ошибка добавления строки"); }
  };

  const handleCellChange = (rowId: number, key: string, value: string | number | boolean) => {
    setRows((prev) => prev.map((r) => r.id === rowId ? { ...r, row_data: { ...r.row_data, [key]: value } } : r));
    debouncedSave(`cell-${rowId}`, async () => {
      const currentRow = latestRows.current.find((r) => r.id === rowId);
      if (!currentRow) return;
      try { await updateDynamicTableRow(rowId, { ...currentRow.row_data, [key]: value }); playSave(); }
      catch (e) { console.error("Error saving cell:", e); }
    });
  };

  const handleDeleteRow = (rowId: number) => {
    const deleted = rows.find((r) => r.id === rowId);
    setRows((prev) => prev.filter((r) => r.id !== rowId));
    const timer = setTimeout(() => { deleteDynamicTableRow(rowId).catch(() => toast.error("Ошибка удаления")); }, 5000);
    toast("Строка удалена", {
      duration: 5000,
      action: { label: "Отменить", onClick: () => { clearTimeout(timer); if (deleted) setRows((prev) => [...prev, deleted]); } },
    });
  };

  const handleClearCell = (rowId: number, colKey: string) => {
    const col = parseColumns(activeTable?.columns_json ?? "[]").find(c => c.key === colKey);
    handleCellChange(rowId, colKey, col?.type === "checkbox" ? false : "");
  };

  const handleCopyCell = (rowId: number, colKey: string) => {
    const row = rows.find(r => r.id === rowId);
    if (!row) return;
    const val = String(row.row_data[colKey] ?? "");
    navigator.clipboard.writeText(val);
    toast.success("Ячейка скопирована");
  };

  const handleCopyRow = (rowId: number) => {
    const row = rows.find(r => r.id === rowId);
    if (!row || !activeTable) return;
    const cols = parseColumns(activeTable.columns_json);
    const text = cols.map(c => `${c.label}: ${row.row_data[c.key] ?? ""}`).join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Строка скопирована");
  };

  const handleDuplicateRow = async (rowId: number) => {
    const row = rows.find(r => r.id === rowId);
    if (!row || !activeTable) return;
    try {
      const newRow = await createDynamicTableRow(activeTable.id, { ...row.row_data });
      setRows(prev => [...prev, newRow]);
      toast.success("Строка дублирована");
    } catch { toast.error("Ошибка дублирования"); }
  };

  const handleInsertRow = async (rowId: number, position: "above" | "below") => {
    if (!activeTable) return;
    const columns = parseColumns(activeTable.columns_json);
    const emptyRow: Record<string, string | boolean> = {};
    columns.forEach(c => { emptyRow[c.key] = c.type === "checkbox" ? false : ""; });
    try {
      const newRow = await createDynamicTableRow(activeTable.id, emptyRow);
      const idx = rows.findIndex(r => r.id === rowId);
      if (idx === -1) { setRows(prev => [...prev, newRow]); return; }
      const insertIdx = position === "above" ? idx : idx + 1;
      setRows(prev => { const copy = [...prev]; copy.splice(insertIdx, 0, newRow); return copy; });
      toast.success(position === "above" ? "Строка вставлена выше" : "Строка вставлена ниже");
    } catch { toast.error("Ошибка вставки строки"); }
  };

  const handleSetRowColor = (rowId: number, color: string) => {
    setRowColors(prev => {
      const next = { ...prev };
      if (color) next[rowId] = color;
      else delete next[rowId];
      return next;
    });
  };

  const handleAddColumnToTable = async (label: string, type: DynamicColumn["type"]) => {
    if (!activeTable) return;
    const cols = parseColumns(activeTable.columns_json);
    const newKey = `col_${Date.now()}`;
    const newCols = [...cols, { key: newKey, label, type }];
    try {
      const updated = await updateDynamicTable(activeTable.id, { title: activeTable.title, columns_json: newCols, visibility: activeTable.visibility });
      setActiveTable(updated);
      setRows(prev => prev.map(r => ({ ...r, row_data: { ...r.row_data, [newKey]: type === "checkbox" ? false : "" } })));
      toast.success("Колонка добавлена"); await loadTables();
    } catch { toast.error("Ошибка добавления колонки"); }
  };

  const openSettings = () => {
    if (!activeTable) return;
    setEditTitle(activeTable.title); setEditVisibility(activeTable.visibility); setEditColumns(parseColumns(activeTable.columns_json)); setSettingsOpen(true);
  };

  const handleSaveSettings = async () => {
    if (!activeTable) return;
    try {
      const updated = await updateDynamicTable(activeTable.id, { title: editTitle, columns_json: editColumns, visibility: editVisibility });
      setActiveTable(updated); setSettingsOpen(false); toast.success("Настройки сохранены"); await loadTables();
    } catch { toast.error("Ошибка сохранения"); }
  };

  /* ---- IMPORT ---- */
  const excelDateToJSDate = (serial: number): string => {
    const utcDays = Math.floor(serial - 25569);
    const date = new Date(utcDays * 86400 * 1000);
    return date.toISOString().split("T")[0];
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeTable) return;
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array", cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const jsonData: (string | number | boolean | null)[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
      if (jsonData.length < 2) { toast.error("Файл пуст или содержит только заголовки"); return; }
      const cols = parseColumns(activeTable.columns_json);
      const headerRow = jsonData[0].map(h => String(h ?? "").trim());

      // Try exact label match first, then fuzzy (contains / starts with)
      const colMapping: (DynamicColumn | null)[] = headerRow.map(h => {
        const hLower = h.toLowerCase();
        const exact = cols.find(c => c.label.toLowerCase() === hLower);
        if (exact) return exact;
        const partial = cols.find(c => hLower.includes(c.label.toLowerCase()) || c.label.toLowerCase().includes(hLower));
        return partial ?? null;
      });

      // Fallback: if no headers matched, map by column order
      const matchedCount = colMapping.filter(Boolean).length;
      if (matchedCount === 0 && headerRow.length > 0) {
        for (let i = 0; i < Math.min(headerRow.length, cols.length); i++) {
          colMapping[i] = cols[i];
        }
        toast.info("Заголовки не совпали — импорт по порядку колонок");
      }

      let imported = 0;
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.every(cell => cell === null || cell === undefined || cell === "")) continue;
        const rowData: Record<string, string | number | boolean> = {};
        cols.forEach(c => { rowData[c.key] = c.type === "checkbox" ? false : ""; });
        row.forEach((cell, idx) => {
          const col = colMapping[idx];
          if (!col) return;
          if (col.type === "checkbox") {
            const v = String(cell ?? "").toLowerCase();
            rowData[col.key] = v === "да" || v === "yes" || v === "true" || v === "1" || v === "✓" || cell === true;
          } else if (col.type === "number") {
            const num = Number(cell);
            rowData[col.key] = isNaN(num) ? String(cell ?? "") : num;
          } else if (col.type === "date") {
            if (typeof cell === "number" && cell > 10000) {
              // Excel serial date
              rowData[col.key] = excelDateToJSDate(cell);
            } else {
              rowData[col.key] = String(cell ?? "");
            }
          } else {
            rowData[col.key] = String(cell ?? "");
          }
        });
        const newRow = await createDynamicTableRow(activeTable.id, rowData);
        setRows(prev => [...prev, newRow]);
        imported++;
      }
      toast.success(`Импортировано ${imported} строк`);
    } catch (err) {
      console.error("Import error:", err);
      toast.error("Ошибка импорта файла");
    }
    if (importFileRef.current) importFileRef.current.value = "";
  };

  /* ---- EXPORT ---- */
  const exportToExcel = () => {
    if (!activeTable) return;
    const cols = parseColumns(activeTable.columns_json);
    const wsData: string[][] = [cols.map(c => c.label)];
    rows.forEach(row => {
      wsData.push(cols.map(col => {
        const val = row.row_data[col.key];
        if (col.type === "checkbox") return (val === true || val === "true" || val === 1) ? "Да" : "Нет";
        if (col.type === "date" && val) { try { return new Date(String(val)).toLocaleDateString("ru-RU"); } catch { return String(val ?? ""); } }
        return String(val ?? "");
      }));
    });
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = cols.map((_, i) => ({ wch: Math.max(12, ...wsData.map(r => String(r[i] ?? "").length + 2)) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeTable.title.slice(0, 31));
    addExcelWatermarkSheet(XLSX, wb);
    XLSX.writeFile(wb, `${activeTable.title}.xlsx`);
    toast.success("Файл скачан");
  };

  const exportToCSV = () => {
    if (!activeTable) return;
    const cols = parseColumns(activeTable.columns_json);
    const wsData: string[][] = [cols.map(c => c.label)];
    rows.forEach(row => { wsData.push(cols.map(col => { const val = row.row_data[col.key]; if (col.type === "checkbox") return (val === true || val === "true" || val === 1) ? "Да" : "Нет"; return String(val ?? ""); })); });
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${activeTable.title}.csv`; a.click(); URL.revokeObjectURL(url);
    toast.success("CSV скачан");
  };

  const handlePrint = () => {
    if (!activeTable) return;
    const cols = parseColumns(activeTable.columns_json);
    const tHtml = `<table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:12px;">
      <thead><tr>${cols.map(c => `<th style="border:1px solid #ccc;padding:8px 12px;background:#f5f5f5;text-align:left;font-weight:600;">${c.label}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((row, i) => `<tr style="background:${i % 2 ? "#fafafa" : "#fff"}">${cols.map(col => {
        const val = row.row_data[col.key]; let d = String(val ?? "");
        if (col.type === "checkbox") d = (val === true || val === "true" || val === 1) ? "✓" : "—";
        if (col.type === "date" && val) { try { d = new Date(String(val)).toLocaleDateString("ru-RU"); } catch {} }
        return `<td style="border:1px solid #ccc;padding:6px 12px;">${d}</td>`;
      }).join("")}</tr>`).join("")}</tbody></table>`;
    printWithWatermark(
      activeTable.title,
      `Автор: ${activeTable.creator_name} | Дата: ${new Date().toLocaleDateString("ru-RU")}`,
      tHtml
    );
  };

  /* ---- GOOGLE SHEETS IMPORT ---- */
  const handleGsFetch = async () => {
    if (!gsUrl.trim()) return;
    setGsImporting(true);
    try {
      const data = await importGoogleSheet(gsUrl.trim());
      if (data.sheets && data.sheets.length > 0) {
        setGsPreview({ sheets: data.sheets });
        setGsActiveSheet(0);
      } else if (data.headers && data.rows) {
        setGsPreview({ sheets: [{ gid: "0", name: "Лист 1", headers: data.headers, rows: data.rows }] });
        setGsActiveSheet(0);
      } else {
        toast.error("Пустая таблица");
      }
    } catch (err: any) {
      toast.error(err.message || "Ошибка импорта");
    } finally { setGsImporting(false); }
  };

  const handleGsCreate = async () => {
    if (!gsPreview || !user) return;
    setGsImporting(true);
    try {
      let lastTable: any = null;
      let totalImported = 0;

      for (const sheet of gsPreview.sheets) {
        if (!sheet.headers.length) continue;

        const columns: DynamicColumn[] = sheet.headers.map((h, i) => {
          const key = `col_${i + 1}`;
          let type: DynamicColumn["type"] = "text";
          if (sheet.rows.length > 0) {
            const sample = sheet.rows[0][i];
            if (sample && !isNaN(Number(sample)) && sample.trim() !== "") type = "number";
            else if (sample && /^\d{4}-\d{2}-\d{2}/.test(sample)) type = "date";
          }
          return { key, label: h || `Колонка ${i + 1}`, type };
        });

        const title = gsPreview.sheets.length > 1
          ? `${sheet.name} — ${new Date().toLocaleDateString("ru-RU")}`
          : `Google Sheets — ${new Date().toLocaleDateString("ru-RU")}`;

        const table = await createDynamicTable({
          creator_id: parseInt(user.id), title, columns_json: columns, visibility: "private",
        });

        for (const row of sheet.rows) {
          if (row.every(c => !c)) continue;
          const rowData: Record<string, string | number> = {};
          columns.forEach((col, idx) => {
            const val = row[idx] ?? "";
            if (col.type === "number") {
              const num = Number(val);
              rowData[col.key] = isNaN(num) ? val : num;
            } else {
              rowData[col.key] = val;
            }
          });
          await createDynamicTableRow(table.id, rowData);
          totalImported++;
        }
        lastTable = table;
      }

      toast.success(`Импортировано ${totalImported} строк из ${gsPreview.sheets.length} лист(ов)`);
      setGsImportOpen(false); setGsUrl(""); setGsPreview(null); setGsActiveSheet(0);
      await loadTables();
      if (lastTable) {
        const freshTables = await fetchDynamicTables(parseInt(user.id));
        const created = freshTables.find((t: DynamicTable) => t.id === lastTable.id);
        if (created) openTable(created);
      }
    } catch (err: any) {
      toast.error(err.message || "Ошибка создания таблицы");
    } finally { setGsImporting(false); }
  };

  /* ---- UTILS ---- */
  const parseColumns = (json: string | DynamicColumn[]): DynamicColumn[] => {
    if (Array.isArray(json)) return json;
    try { return JSON.parse(json); } catch { return []; }
  };

  const addNewColumn = (target: "new" | "edit") => {
    const setter = target === "new" ? setNewColumns : setEditColumns;
    const cols = target === "new" ? newColumns : editColumns;
    setter([...cols, { key: `col_${cols.length + 1}`, label: `Колонка ${cols.length + 1}`, type: "text" }]);
  };
  const removeColumn = (target: "new" | "edit", idx: number) => {
    (target === "new" ? setNewColumns : setEditColumns)((prev) => prev.filter((_, i) => i !== idx));
  };
  const updateColumnLabel = (target: "new" | "edit", idx: number, label: string) => {
    (target === "new" ? setNewColumns : setEditColumns)((prev) => prev.map((c, i) => (i === idx ? { ...c, label } : c)));
  };
  const updateColumnType = (target: "new" | "edit", idx: number, type: DynamicColumn["type"]) => {
    (target === "new" ? setNewColumns : setEditColumns)((prev) => prev.map((c, i) => (i === idx ? { ...c, type } : c)));
  };

  const visIcon = (vis: string) => { const opt = VISIBILITY_OPTIONS.find((o) => o.value === vis); return opt ? <opt.icon className="h-3.5 w-3.5" /> : null; };
  const visLabel = (vis: string) => VISIBILITY_OPTIONS.find((o) => o.value === vis)?.label || vis;

  const canEditTable = (table: DynamicTable) => {
    if (!user) return false;
    if (user.role === "admin" || user.role === "umo_head") return true;
    if (table.creator_id === parseInt(user.id)) return true;
    if (table.visibility === "all_teachers") return true;
    return false;
  };
  const canManageTable = (table: DynamicTable) => {
    if (!user) return false;
    if (user.role === "admin" || user.role === "umo_head") return true;
    return table.creator_id === parseInt(user.id);
  };

  const filteredTables = useMemo(() =>
    tables.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()) || t.creator_name.toLowerCase().includes(search.toLowerCase())),
    [tables, search]);

  // ============= ACTIVE TABLE VIEW =============
  if (activeTable) {
    const columns = parseColumns(activeTable.columns_json);
    const isOwner = canManageTable(activeTable);
    const editable = canEditTable(activeTable);
    return (
      <div className="space-y-4 animate-in fade-in duration-300">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="icon" onClick={() => { setActiveTable(null); setRows([]); }}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold font-heading truncate">{activeTable.title}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground">{activeTable.creator_name}</span>
              <Badge variant="outline" className="text-[10px] gap-1">{visIcon(activeTable.visibility)} {visLabel(activeTable.visibility).split(" (")[0]}</Badge>
              <span className="text-[10px] text-muted-foreground">{rows.length} строк · {columns.length} колонок</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <TooltipProvider delayDuration={300}>
            {editable && (
              <Tooltip><TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setAddColOpen(true)}>
                  <Columns3 className="h-4 w-4" />
                </Button>
              </TooltipTrigger><TooltipContent>Добавить колонку</TooltipContent></Tooltip>
            )}
            {editable && (
              <Tooltip><TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => importFileRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                </Button>
              </TooltipTrigger><TooltipContent>Импорт файла</TooltipContent></Tooltip>
            )}
            <input ref={importFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
            <DropdownMenu>
              <Tooltip><TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8">
                    <FileDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger><TooltipContent>Экспорт</TooltipContent></Tooltip>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToExcel} className="gap-2"><FileSpreadsheet className="h-4 w-4" /> Excel (.xlsx)</DropdownMenuItem>
                <DropdownMenuItem onClick={exportToCSV} className="gap-2"><FileText className="h-4 w-4" /> CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={handlePrint} className="gap-2"><Printer className="h-4 w-4" /> Печать</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {isOwner && (
              <>
                <Tooltip><TooltipTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={openSettings}>
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger><TooltipContent>Настройки</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild>
                  <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => handleDeleteTable(activeTable.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger><TooltipContent>Удалить таблицу</TooltipContent></Tooltip>
              </>
            )}
            </TooltipProvider>
          </div>
        </div>
        {rowsLoading ? (
          <div className="space-y-2 py-4">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}</div>
        ) : (
          <SpreadsheetTable columns={columns} rows={rows} canEdit={editable}
            onCellChange={handleCellChange} onAddRow={handleAddRow} onDeleteRow={handleDeleteRow} onClearCell={handleClearCell}
            onCopyCell={handleCopyCell} onCopyRow={handleCopyRow} onDuplicateRow={handleDuplicateRow} onInsertRow={handleInsertRow}
            rowColors={rowColors} onSetRowColor={handleSetRowColor} />
        )}
        <AddColumnDialog open={addColOpen} onOpenChange={setAddColOpen} onAdd={handleAddColumnToTable} />
        {/* Settings Dialog */}
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5" /> Настройки таблицы</DialogTitle></DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div>
                <label className="text-sm font-medium">Название</label>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Доступ</label>
                <Select value={editVisibility} onValueChange={setEditVisibility}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VISIBILITY_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}><span className="flex items-center gap-2"><o.icon className="h-4 w-4" /> {o.label}</span></SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Колонки</label>
                <div className="space-y-2 mt-2">
                  {editColumns.map((col, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input value={col.label} onChange={(e) => updateColumnLabel("edit", idx, e.target.value)} className="flex-1 h-9" placeholder="Название колонки" />
                      <Select value={col.type} onValueChange={(v) => updateColumnType("edit", idx, v as DynamicColumn["type"])}>
                        <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>{COL_TYPE_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}><span className="flex items-center gap-1.5 text-xs"><o.icon className="h-3 w-3" />{o.label}</span></SelectItem>))}</SelectContent>
                      </Select>
                      {editColumns.length > 1 && (
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive shrink-0" onClick={() => removeColumn("edit", idx)}><Trash2 className="h-4 w-4" /></Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addNewColumn("edit")} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Добавить колонку</Button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button variant="outline" onClick={() => setSettingsOpen(false)}>Отмена</Button>
              <Button onClick={handleSaveSettings}>Сохранить</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ============= TABLE LIST VIEW (HUB) =============
  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-end flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { setGsImportOpen(true); setGsPreview(null); setGsUrl(""); }} className="gap-2">
            <Sheet className="h-4 w-4" /> <span className="hidden sm:inline">Google Sheets</span>
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="gap-2" size="sm"><Plus className="h-4 w-4" /> <span className="hidden sm:inline">Создать</span> таблицу</Button>
        </div>
      </div>
      <div className="relative max-w-full sm:max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Живой поиск по названию или автору..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl border p-4 space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-28" />
              <div className="flex gap-2"><Skeleton className="h-5 w-16 rounded-full" /><Skeleton className="h-5 w-16 rounded-full" /></div>
            </div>
          ))}
        </div>
      ) : filteredTables.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Table2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">{search ? "Ничего не найдено" : "Нет таблиц"}</p>
          <p className="text-sm mt-1">{search ? "Попробуйте изменить запрос" : "Создайте первую таблицу для начала работы"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTables.map((table) => {
            const columns = parseColumns(table.columns_json);
            return (
              <Card key={table.id} className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-primary/30 group" onClick={() => openTable(table)}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base group-hover:text-primary transition-colors line-clamp-1">{table.title}</CardTitle>
                    <Badge variant="outline" className="text-[10px] gap-1 shrink-0 ml-2">{visIcon(table.visibility)} {visLabel(table.visibility).split(" (")[0]}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><Pencil className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{table.creator_name}</span></div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Badge variant="secondary" className="text-[10px]">{columns.length} кол.</Badge>
                    {columns.some(c => c.type === "checkbox") && <Badge variant="secondary" className="text-[10px] gap-0.5"><CheckSquare className="h-2.5 w-2.5" /> чекбокс</Badge>}
                    <span className="text-[10px] text-muted-foreground ml-auto" title={new Date(table.updated_at).toLocaleString("ru-RU")}>{(() => {
                      const diff = Date.now() - new Date(table.updated_at).getTime();
                      const min = Math.floor(diff / 60000);
                      if (min < 60) return "только что";
                      const hr = Math.floor(min / 60);
                      if (hr < 24) return `${hr} ч. назад`;
                      const d = Math.floor(hr / 24);
                      if (d === 1) return "Вчера";
                      if (d < 7) return `${d} дн. назад`;
                      return new Date(table.updated_at).toLocaleDateString("ru-RU");
                    })()}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {/* Create Table Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5" /> Создать таблицу</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <div>
              <label className="text-sm font-medium">Название таблицы</label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Например: Результаты по Python" className="mt-1" autoFocus />
            </div>
            <div>
              <label className="text-sm font-medium">Доступ</label>
              <Select value={newVisibility} onValueChange={setNewVisibility}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{VISIBILITY_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}><span className="flex items-center gap-2"><o.icon className="h-4 w-4" /> {o.label}</span></SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Колонки</label>
              <div className="space-y-2 mt-2">
                {newColumns.map((col, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input value={col.label} onChange={(e) => updateColumnLabel("new", idx, e.target.value)} className="flex-1 h-9" placeholder="Название колонки" />
                    <Select value={col.type} onValueChange={(v) => updateColumnType("new", idx, v as DynamicColumn["type"])}>
                      <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>{COL_TYPE_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}><span className="flex items-center gap-1.5 text-xs"><o.icon className="h-3 w-3" />{o.label}</span></SelectItem>))}</SelectContent>
                    </Select>
                    {newColumns.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => removeColumn("new", idx)}><Trash2 className="h-4 w-4" /></Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => addNewColumn("new")} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Добавить колонку</Button>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Отмена</Button>
            <Button onClick={handleCreateTable} disabled={!newTitle.trim()}>Создать</Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Google Sheets Import Dialog */}
      <Dialog open={gsImportOpen} onOpenChange={(v) => { setGsImportOpen(v); if (!v) { setGsPreview(null); setGsUrl(""); setGsActiveSheet(0); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sheet className="h-5 w-5 text-green-600" /> Импорт из Google Sheets</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <div>
              <label className="text-sm font-medium">Ссылка на Google Таблицу</label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-2">Таблица должна быть открыта для просмотра по ссылке (Поделиться → Все у кого есть ссылка)</p>
              <div className="flex gap-2">
                <Input
                  value={gsUrl}
                  onChange={e => setGsUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="flex-1"
                  autoFocus
                  onKeyDown={e => e.key === "Enter" && !gsImporting && handleGsFetch()}
                />
                <Button onClick={handleGsFetch} disabled={gsImporting || !gsUrl.trim()} size="sm">
                  {gsImporting ? "Загрузка…" : "Загрузить"}
                </Button>
              </div>
            </div>
            {gsPreview && gsPreview.sheets.length > 0 && (() => {
              const sheet = gsPreview.sheets[gsActiveSheet] || gsPreview.sheets[0];
              return (
                <div className="space-y-3 animate-in fade-in duration-200">
                  {/* Sheet tabs */}
                  {gsPreview.sheets.length > 1 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      {gsPreview.sheets.map((s, idx) => (
                        <button
                          key={s.gid}
                          onClick={() => setGsActiveSheet(idx)}
                          className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                            idx === gsActiveSheet
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted/50 hover:bg-muted border-transparent"
                          }`}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{sheet.headers.length} колонок</Badge>
                    <Badge variant="secondary" className="text-xs">{sheet.rows.length} строк</Badge>
                    {gsPreview.sheets.length > 1 && (
                      <Badge variant="outline" className="text-xs">{gsPreview.sheets.length} листов — будут созданы отдельные таблицы</Badge>
                    )}
                  </div>
                  <div className="rounded-lg border overflow-x-auto max-h-[300px] overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-muted">
                        <tr>
                          {sheet.headers.map((h, i) => (
                            <th key={i} className="px-3 py-2 text-left font-semibold border-b whitespace-nowrap">{h || `Кол. ${i + 1}`}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sheet.rows.slice(0, 10).map((row, ri) => (
                          <tr key={ri} className="border-b last:border-0 hover:bg-muted/30">
                            {sheet.headers.map((_, ci) => (
                              <td key={ci} className="px-3 py-1.5 whitespace-nowrap max-w-[200px] truncate">{row[ci] ?? ""}</td>
                            ))}
                          </tr>
                        ))}
                        {sheet.rows.length > 10 && (
                          <tr><td colSpan={sheet.headers.length} className="px-3 py-2 text-center text-muted-foreground italic">
                            …и ещё {sheet.rows.length - 10} строк
                          </td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="outline" onClick={() => { setGsImportOpen(false); setGsPreview(null); setGsUrl(""); setGsActiveSheet(0); }}>Отмена</Button>
            <Button onClick={handleGsCreate} disabled={!gsPreview || gsImporting}>
              {gsImporting ? "Создание…" : gsPreview && gsPreview.sheets.length > 1 ? `Создать ${gsPreview.sheets.length} таблиц` : "Создать таблицу"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
