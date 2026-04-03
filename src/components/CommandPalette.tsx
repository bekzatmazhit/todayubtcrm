import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Calendar, Users, BarChart3, Shield, ListTodo, FolderOpen,
  BookOpen, ClipboardCheck, Settings, LogOut,
  LayoutDashboard, UsersRound, Search, Command, ArrowRight,
} from "lucide-react";

interface PaletteAction {
  id: string;
  label: string;
  category: string;
  icon: React.ReactNode;
  keywords: string;
  action: () => void;
}

export function CommandPalette({ onLogout }: { onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const actions = useMemo<PaletteAction[]>(() => {
    const nav: PaletteAction[] = [
      { id: "nav-calendar", label: "Перейти в Расписание", category: "Навигация", icon: <Calendar className="h-4 w-4" />, keywords: "календарь расписание calendar schedule", action: () => navigate("/") },
      { id: "nav-students", label: "Перейти в Ученики", category: "Навигация", icon: <Users className="h-4 w-4" />, keywords: "ученики студенты students", action: () => navigate("/students") },
      { id: "nav-ent", label: "Результаты ЕНТ", category: "Навигация", icon: <BarChart3 className="h-4 w-4" />, keywords: "ент результаты ent results баллы", action: () => navigate("/ent-results") },
      { id: "nav-curatorship", label: "Кураторство", category: "Навигация", icon: <Shield className="h-4 w-4" />, keywords: "кураторство curatorship", action: () => navigate("/curatorship") },
      { id: "nav-tasks", label: "Задачи", category: "Навигация", icon: <ListTodo className="h-4 w-4" />, keywords: "задачи tasks todo", action: () => navigate("/tasks") },
      { id: "nav-storage", label: "Хранилище", category: "Навигация", icon: <FolderOpen className="h-4 w-4" />, keywords: "хранилище storage файлы files таблицы tables", action: () => navigate("/storage") },
      { id: "nav-wiki", label: "База знаний", category: "Навигация", icon: <BookOpen className="h-4 w-4" />, keywords: "база знаний wiki вики", action: () => navigate("/wiki") },
      { id: "nav-grades", label: "Оценки", category: "Навигация", icon: <ClipboardCheck className="h-4 w-4" />, keywords: "оценки grades", action: () => navigate("/grades") },
      { id: "nav-settings", label: "Настройки", category: "Навигация", icon: <Settings className="h-4 w-4" />, keywords: "настройки settings", action: () => navigate("/settings") },
    ];
    if (user?.role === "admin" || user?.role === "umo_head") {
      nav.push(
        { id: "nav-team", label: "Команда", category: "Навигация", icon: <UsersRound className="h-4 w-4" />, keywords: "команда team сотрудники", action: () => navigate("/team") },
        { id: "nav-admin", label: "Админ-панель", category: "Навигация", icon: <LayoutDashboard className="h-4 w-4" />, keywords: "админ admin панель dashboard", action: () => navigate("/admin") },
      );
    }

    const cmds: PaletteAction[] = [
      { id: "cmd-search-student", label: "Найти ученика...", category: "Действия", icon: <Search className="h-4 w-4" />, keywords: "поиск найти ученика search student", action: () => navigate("/students?focus=search") },
      { id: "cmd-new-task", label: "Создать новую Задачу", category: "Действия", icon: <ListTodo className="h-4 w-4" />, keywords: "создать задача new task создать задачу", action: () => navigate("/tasks?action=create") },
      { id: "cmd-logout", label: "Выйти из аккаунта", category: "Система", icon: <LogOut className="h-4 w-4" />, keywords: "выйти logout exit выход", action: onLogout },
    ];

    return [...nav, ...cmds];
  }, [navigate, user, onLogout]);

  const filtered = useMemo(() => {
    if (!query.trim()) return actions;
    const q = query.toLowerCase();
    return actions.filter(a =>
      a.label.toLowerCase().includes(q) ||
      a.keywords.toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q)
    );
  }, [actions, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[selectedIndex] as HTMLElement;
    if (item) item.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const executeAction = useCallback((action: PaletteAction) => {
    setOpen(false);
    setQuery("");
    // Small delay to let the dialog close first
    setTimeout(() => action.action(), 50);
  }, []);

  // Global keyboard listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen(prev => {
          if (!prev) {
            setQuery("");
            setSelectedIndex(0);
          }
          return !prev;
        });
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filtered[selectedIndex]) executeAction(filtered[selectedIndex]);
        break;
      case "Escape":
        setOpen(false);
        setQuery("");
        break;
    }
  };

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, PaletteAction[]>();
    filtered.forEach(a => {
      if (!map.has(a.category)) map.set(a.category, []);
      map.get(a.category)!.push(a);
    });
    return map;
  }, [filtered]);

  // Flat index across groups
  let flatIndex = 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQuery(""); }}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden rounded-xl border shadow-2xl [&>button]:hidden" onKeyDown={handleKeyDown}>
        <DialogTitle className="sr-only">Палитра команд</DialogTitle>
        {/* Search input */}
        <div className="flex items-center border-b px-3 gap-2">
          <Command className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Введите команду или найдите..."
            className="border-0 shadow-none focus-visible:ring-0 h-12 text-sm"
            autoFocus
          />
          <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[320px] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-20" />
              <p>Ничего не найдено</p>
              <p className="text-xs mt-1">Попробуйте другой запрос</p>
            </div>
          ) : (
            <>
              {[...grouped.entries()].map(([category, items]) => (
                <div key={category}>
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {category}
                  </div>
                  {items.map(action => {
                    const thisIndex = flatIndex++;
                    const isSelected = thisIndex === selectedIndex;
                    return (
                      <button
                        key={action.id}
                        className={`w-full px-3 py-2 text-sm text-left flex items-center gap-3 transition-colors ${
                          isSelected
                            ? "bg-accent text-accent-foreground"
                            : "text-foreground hover:bg-accent/50"
                        }`}
                        onClick={() => executeAction(action)}
                        onMouseEnter={() => setSelectedIndex(thisIndex)}
                      >
                        <span className={`${isSelected ? "text-primary" : "text-muted-foreground"} shrink-0`}>
                          {action.icon}
                        </span>
                        <span className="flex-1 truncate">{action.label}</span>
                        {isSelected && <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-3 py-2 flex items-center gap-4 text-[10px] text-muted-foreground bg-muted/30">
          <span className="flex items-center gap-1">
            <kbd className="inline-flex h-4 items-center rounded border px-1 font-mono text-[9px]">↑</kbd>
            <kbd className="inline-flex h-4 items-center rounded border px-1 font-mono text-[9px]">↓</kbd>
            навигация
          </span>
          <span className="flex items-center gap-1">
            <kbd className="inline-flex h-4 items-center rounded border px-1 font-mono text-[9px]">↵</kbd>
            выбрать
          </span>
          <span className="flex items-center gap-1">
            <kbd className="inline-flex h-4 items-center rounded border px-1 font-mono text-[9px]">Ctrl</kbd>
            <kbd className="inline-flex h-4 items-center rounded border px-1 font-mono text-[9px]">K</kbd>
            открыть
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
