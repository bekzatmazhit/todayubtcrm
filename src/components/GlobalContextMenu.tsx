import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { fetchStudents, fetchTasks, fetchUsers } from "@/lib/api";
import { UserAvatar } from "@/components/UserAvatar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft, ArrowRight, RotateCcw, Home, Copy, ExternalLink,
  Clipboard, Search, Settings, BookOpen, Users, BarChart3,
  ListTodo, FolderOpen, ClipboardCheck, Calendar,
  User, GraduationCap, Megaphone, X,
} from "lucide-react";

interface MenuAction {
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  onClick: () => void;
  danger?: boolean;
  dividerAfter?: boolean;
}

interface ContextMenuPosition {
  x: number;
  y: number;
}

interface SearchResult {
  id: number;
  type: "student" | "task" | "user";
  title: string;
  subtitle?: string;
  avatar_url?: string;
  url: string;
}

export function GlobalContextMenu() {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<ContextMenuPosition>({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState("");
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [cachedData, setCachedData] = useState<{ students: any[]; tasks: any[]; users: any[] } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const close = useCallback(() => {
    setVisible(false);
    setSearchMode(false);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedIdx(0);
  }, []);

  // Load data for search on first open
  const loadSearchData = useCallback(async () => {
    if (cachedData) return cachedData;
    setSearchLoading(true);
    try {
      const [students, tasks, users] = await Promise.all([
        fetchStudents().catch(() => []),
        fetchTasks().catch(() => []),
        fetchUsers().catch(() => []),
      ]);
      const data = { students, tasks, users };
      setCachedData(data);
      setSearchLoading(false);
      return data;
    } catch {
      setSearchLoading(false);
      return { students: [], tasks: [], users: [] };
    }
  }, [cachedData]);

  // Invalidate cache after 2 minutes
  useEffect(() => {
    if (!cachedData) return;
    const timer = setTimeout(() => setCachedData(null), 120_000);
    return () => clearTimeout(timer);
  }, [cachedData]);

  // Run search against cached data
  const runSearch = useCallback((q: string, data: { students: any[]; tasks: any[]; users: any[] }) => {
    if (!q.trim()) { setSearchResults([]); return; }
    const query = q.toLowerCase();
    const results: SearchResult[] = [];

    // Search students
    data.students.forEach((s: any) => {
      const name = s.full_name || `${s.name || ""} ${s.surname || ""}`.trim();
      if (name.toLowerCase().includes(query) || (s.phone && s.phone.includes(query))) {
        results.push({
          id: s.id, type: "student", title: name,
          subtitle: s.group_name || "Без группы",
          url: "/students",
        });
      }
    });

    // Search tasks
    data.tasks.forEach((t: any) => {
      if (t.title?.toLowerCase().includes(query) || t.description?.toLowerCase().includes(query)) {
        results.push({
          id: t.id, type: "task", title: t.title,
          subtitle: `${t.status} • ${t.priority || "medium"}`,
          url: "/tasks",
        });
      }
    });

    // Search users/teachers
    data.users.forEach((u: any) => {
      const name = `${u.name || ""} ${u.surname || ""}`.trim();
      if (name.toLowerCase().includes(query) || (u.email && u.email.toLowerCase().includes(query))) {
        results.push({
          id: u.id, type: "user", title: name,
          subtitle: u.email || (u.role_id === 1 ? "Админ" : u.role_id === 2 ? "УМО" : "Учитель"),
          avatar_url: u.avatar_url,
          url: "/team",
        });
      }
    });

    setSearchResults(results.slice(0, 12));
    setSelectedIdx(0);
  }, []);

  // Effect for search query changes
  useEffect(() => {
    if (!searchMode || !cachedData) return;
    runSearch(searchQuery, cachedData);
  }, [searchQuery, searchMode, cachedData, runSearch]);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        target.closest("[data-no-global-ctx]")
      ) return;

      e.preventDefault();
      const sel = window.getSelection()?.toString() || "";
      setSelectedText(sel);

      const x = Math.min(e.clientX, window.innerWidth - 320);
      const y = Math.min(e.clientY, window.innerHeight - 420);
      setPosition({ x, y });
      setVisible(true);
      setSearchMode(false);
      setSearchQuery("");
      setSearchResults([]);
    };

    const handleClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.closest("[data-ctx-menu]")) return;
      close();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [close]);

  // Focus search input when entering search mode
  useEffect(() => {
    if (searchMode) {
      loadSearchData();
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [searchMode, loadSearchData]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, searchResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && searchResults[selectedIdx]) {
      e.preventDefault();
      navigate(searchResults[selectedIdx].url);
      close();
    } else if (e.key === "Escape") {
      if (searchQuery) {
        setSearchQuery("");
        setSearchResults([]);
      } else {
        setSearchMode(false);
      }
    }
  };

  const typeIcon = (type: string) => {
    if (type === "student") return <GraduationCap className="h-3.5 w-3.5" />;
    if (type === "task") return <ListTodo className="h-3.5 w-3.5" />;
    return <User className="h-3.5 w-3.5" />;
  };
  const typeLabel = (type: string) => {
    if (type === "student") return "Ученик";
    if (type === "task") return "Задача";
    return "Сотрудник";
  };
  const typeColor = (type: string) => {
    if (type === "student") return "text-blue-500 bg-blue-500/10";
    if (type === "task") return "text-amber-500 bg-amber-500/10";
    return "text-green-500 bg-green-500/10";
  };

  if (!visible) return null;

  const actions: MenuAction[] = [];

  // Navigation
  actions.push({
    label: "Назад", icon: <ArrowLeft className="h-3.5 w-3.5" />, shortcut: "Alt+←",
    onClick: () => window.history.back(),
  });
  actions.push({
    label: "Вперёд", icon: <ArrowRight className="h-3.5 w-3.5" />, shortcut: "Alt+→",
    onClick: () => window.history.forward(),
  });
  actions.push({
    label: "Обновить", icon: <RotateCcw className="h-3.5 w-3.5" />, shortcut: "F5",
    onClick: () => window.location.reload(), dividerAfter: true,
  });

  // Text actions
  if (selectedText) {
    actions.push({
      label: "Копировать", icon: <Copy className="h-3.5 w-3.5" />, shortcut: "Ctrl+C",
      onClick: () => navigator.clipboard.writeText(selectedText),
    });
    actions.push({
      label: `Найти «${selectedText.slice(0, 18)}${selectedText.length > 18 ? "…" : ""}» в CRM`,
      icon: <Search className="h-3.5 w-3.5" />,
      onClick: () => {
        setSearchMode(true);
        setSearchQuery(selectedText);
        loadSearchData().then(data => {
          if (data) runSearch(selectedText, data);
        });
      },
      dividerAfter: true,
    });
  }

  // Quick Search action
  actions.push({
    label: "Быстрый поиск…", icon: <Search className="h-3.5 w-3.5" />, shortcut: "/",
    onClick: () => { setSearchMode(true); },
    dividerAfter: true,
  });

  // Quick navigation
  const navItems = [
    { path: "/", label: "Календарь", icon: <Calendar className="h-3.5 w-3.5" /> },
    { path: "/students", label: "Ученики", icon: <Users className="h-3.5 w-3.5" /> },
    { path: "/ent-results", label: "Результаты ЕНТ", icon: <BarChart3 className="h-3.5 w-3.5" /> },
    { path: "/tasks", label: "Задачи", icon: <ListTodo className="h-3.5 w-3.5" /> },
    { path: "/broadcasts", label: "Каналы", icon: <Megaphone className="h-3.5 w-3.5" /> },
    { path: "/wiki", label: "База знаний", icon: <BookOpen className="h-3.5 w-3.5" /> },
    { path: "/grades", label: "Оценки", icon: <ClipboardCheck className="h-3.5 w-3.5" /> },
    { path: "/storage", label: "Хранилище", icon: <FolderOpen className="h-3.5 w-3.5" /> },
  ];

  const otherPages = navItems.filter(n => n.path !== location.pathname);
  if (otherPages.length > 0) {
    otherPages.slice(0, 5).forEach((item, idx) => {
      actions.push({
        label: item.label, icon: item.icon,
        onClick: () => navigate(item.path),
        dividerAfter: idx === Math.min(otherPages.length, 5) - 1,
      });
    });
  }

  if (location.pathname !== "/settings") {
    actions.push({
      label: "Настройки", icon: <Settings className="h-3.5 w-3.5" />,
      onClick: () => navigate("/settings"),
    });
  }

  return (
    <div className="fixed inset-0 z-[9999]" onClick={close}>
      <div
        data-ctx-menu
        className="fixed bg-popover/95 border border-border rounded-xl shadow-2xl min-w-[280px] max-w-[340px] animate-in fade-in zoom-in-95 duration-100 origin-top-left backdrop-blur-md"
        style={{ left: position.x, top: position.y }}
        onClick={e => e.stopPropagation()}
      >
        {searchMode ? (
          /* ========== SEARCH MODE ========== */
          <div className="py-2">
            <div className="px-2.5 pb-2 flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Input
                ref={searchRef}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Поиск по ученикам, задачам, сотрудникам…"
                className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 bg-transparent px-0"
                autoFocus
              />
              <button onClick={() => setSearchMode(false)} className="shrink-0 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="h-px bg-border mx-2" />
            <ScrollArea className="max-h-[280px]">
              {searchLoading ? (
                <div className="py-6 text-center text-xs text-muted-foreground">Загрузка данных…</div>
              ) : searchResults.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  {searchQuery.trim() ? "Ничего не найдено" : "Начните вводить для поиска"}
                </div>
              ) : (
                <div className="py-1">
                  {searchResults.map((r, idx) => (
                    <button key={`${r.type}-${r.id}`}
                      className={`w-full px-3 py-2 text-left flex items-center gap-2.5 transition-colors text-[13px] ${
                        idx === selectedIdx ? "bg-accent" : "hover:bg-accent/50"
                      }`}
                      onMouseEnter={() => setSelectedIdx(idx)}
                      onClick={() => { navigate(r.url); close(); }}
                    >
                      <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${typeColor(r.type)}`}>
                        {r.avatar_url ? (
                          <UserAvatar user={{ full_name: r.title, avatar_url: r.avatar_url }} size="xs" />
                        ) : typeIcon(r.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-foreground">{r.title}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{r.subtitle}</p>
                      </div>
                      <Badge variant="outline" className="text-[9px] shrink-0 px-1.5">
                        {typeLabel(r.type)}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
            <div className="h-px bg-border mx-2" />
            <div className="px-3 py-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>↑↓ навигация</span>
              <span>Enter — перейти</span>
              <span>Esc — закрыть</span>
            </div>
          </div>
        ) : (
          /* ========== ACTIONS MODE ========== */
          <div className="py-1.5">
            {actions.map((action, idx) => (
              <div key={idx}>
                <button
                  className={`w-full px-3 py-1.5 text-[13px] text-left flex items-center gap-2.5 transition-colors rounded-sm mx-0.5 ${
                    action.danger
                      ? "text-destructive hover:bg-destructive/10"
                      : "text-foreground hover:bg-accent"
                  }`}
                  style={{ width: "calc(100% - 4px)" }}
                  onClick={() => { action.onClick(); if (!action.label.includes("поиск") && !action.label.includes("Найти")) close(); }}
                >
                  <span className="text-muted-foreground">{action.icon}</span>
                  <span className="flex-1 truncate">{action.label}</span>
                  {action.shortcut && (
                    <span className="text-[10px] text-muted-foreground/60 ml-2 font-mono">{action.shortcut}</span>
                  )}
                </button>
                {action.dividerAfter && <div className="h-px bg-border my-1 mx-2" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
