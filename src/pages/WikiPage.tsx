import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import {
  fetchWikiCategories, createWikiCategory, updateWikiCategory, deleteWikiCategory,
  fetchWikiArticles, fetchWikiArticle, createWikiArticle, updateWikiArticle, deleteWikiArticle,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BookOpen, ChevronRight, ChevronDown, Plus, Search, FileText,
  Pencil, Trash2, MoreHorizontal, FolderPlus, Save, X, Clock,
  User, Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, Quote, Code, Link as LinkIcon, AlignLeft,
  AlignCenter, AlignRight, Heading1, Heading2, Heading3,
  Highlighter, Undo, Redo, Minus, PanelLeft,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { RelativeTime } from "@/components/RelativeTime";
import { useIsMobile } from "@/hooks/use-mobile";

/* ====================== TYPES ====================== */

interface WikiCategory {
  id: number;
  name: string;
  order_index: number;
}

interface WikiArticle {
  id: number;
  category_id: number;
  title: string;
  content: string;
  author_id: number | null;
  author_name: string | null;
  category_name?: string;
  created_at: string;
  updated_at: string;
}

/* ====================== EDITOR TOOLBAR ====================== */

function EditorToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;

  const setLink = () => {
    const url = window.prompt("URL ссылки:");
    if (url) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  };

  const ToolbarButton = ({ onClick, active, children, title }: {
    onClick: () => void; active?: boolean; children: React.ReactNode; title?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "p-1.5 rounded-md transition-colors hover:bg-muted",
        active && "bg-primary/10 text-primary"
      )}
    >
      {children}
    </button>
  );

  const iconSize = "h-4 w-4";

  return (
    <div className="flex items-center gap-0.5 flex-wrap border-b border-border px-3 py-2 bg-muted/30">
      <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Отменить">
        <Undo className={iconSize} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Повторить">
        <Redo className={iconSize} />
      </ToolbarButton>

      <Separator orientation="vertical" className="h-6 mx-1" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive("heading", { level: 1 })} title="Заголовок 1"
      >
        <Heading1 className={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive("heading", { level: 2 })} title="Заголовок 2"
      >
        <Heading2 className={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive("heading", { level: 3 })} title="Заголовок 3"
      >
        <Heading3 className={iconSize} />
      </ToolbarButton>

      <Separator orientation="vertical" className="h-6 mx-1" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")} title="Жирный"
      >
        <Bold className={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")} title="Курсив"
      >
        <Italic className={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive("underline")} title="Подчеркнутый"
      >
        <UnderlineIcon className={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive("strike")} title="Зачеркнутый"
      >
        <Strikethrough className={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        active={editor.isActive("highlight")} title="Выделение"
      >
        <Highlighter className={iconSize} />
      </ToolbarButton>

      <Separator orientation="vertical" className="h-6 mx-1" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")} title="Маркированный список"
      >
        <List className={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")} title="Нумерованный список"
      >
        <ListOrdered className={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive("blockquote")} title="Цитата"
      >
        <Quote className={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive("codeBlock")} title="Блок кода"
      >
        <Code className={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Разделитель"
      >
        <Minus className={iconSize} />
      </ToolbarButton>

      <Separator orientation="vertical" className="h-6 mx-1" />

      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        active={editor.isActive({ textAlign: "left" })} title="По левому краю"
      >
        <AlignLeft className={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        active={editor.isActive({ textAlign: "center" })} title="По центру"
      >
        <AlignCenter className={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        active={editor.isActive({ textAlign: "right" })} title="По правому краю"
      >
        <AlignRight className={iconSize} />
      </ToolbarButton>

      <Separator orientation="vertical" className="h-6 mx-1" />

      <ToolbarButton onClick={setLink} active={editor.isActive("link")} title="Ссылка">
        <LinkIcon className={iconSize} />
      </ToolbarButton>
    </div>
  );
}

/* ====================== MAIN PAGE ====================== */

export default function WikiPage() {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin" || user?.role === "umo_head";

  const [categories, setCategories] = useState<WikiCategory[]>([]);
  const [articles, setArticles] = useState<WikiArticle[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<WikiArticle | null>(null);
  const [expandedCats, setExpandedCats] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");

  // Dialogs
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showNewArticle, setShowNewArticle] = useState(false);
  const [newArticleTitle, setNewArticleTitle] = useState("");
  const [newArticleCatId, setNewArticleCatId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "category" | "article"; id: number; name: string } | null>(null);
  const [renameCat, setRenameCat] = useState<{ id: number; name: string } | null>(null);
  const [renameCatName, setRenameCatName] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  // TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({ placeholder: "Начните писать..." }),
      Underline,
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight,
    ],
    content: "",
    editable: false,
    editorProps: {
      attributes: {
        class: "wiki-editor-content outline-none",
      },
    },
  });

  /* ---- DATA LOADING ---- */

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cats, arts] = await Promise.all([fetchWikiCategories(), fetchWikiArticles()]);
      setCategories(cats);
      setArticles(arts);
      // Auto-expand all categories
      setExpandedCats(new Set(cats.map((c: WikiCategory) => c.id)));
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // When selected article changes, update editor
  useEffect(() => {
    if (editor && selectedArticle) {
      editor.commands.setContent(selectedArticle.content || "");
      editor.setEditable(false);
      setEditing(false);
    }
  }, [selectedArticle, editor]);

  /* ---- ARTICLE ACTIONS ---- */

  const handleSelectArticle = async (articleId: number) => {
    try {
      const full = await fetchWikiArticle(articleId);
      setSelectedArticle(full);
      if (isMobile) setSidebarOpen(false);
    } catch {
      toast({ title: "Ошибка", description: "Не удалось загрузить статью", variant: "destructive" });
    }
  };

  const startEditing = () => {
    if (!selectedArticle || !editor) return;
    setEditing(true);
    setEditTitle(selectedArticle.title);
    editor.setEditable(true);
    editor.commands.focus("end");
  };

  const cancelEditing = () => {
    if (!selectedArticle || !editor) return;
    setEditing(false);
    setEditTitle("");
    editor.commands.setContent(selectedArticle.content || "");
    editor.setEditable(false);
  };

  const saveArticle = async () => {
    if (!selectedArticle || !editor) return;
    try {
      const updated = await updateWikiArticle(selectedArticle.id, {
        title: editTitle || selectedArticle.title,
        content: editor.getHTML(),
      });
      setSelectedArticle(updated);
      setEditing(false);
      editor.setEditable(false);
      setArticles((prev) => prev.map((a) => a.id === updated.id ? { ...a, title: updated.title } : a));
      toast({ title: "Сохранено" });
    } catch {
      toast({ title: "Ошибка", description: "Не удалось сохранить", variant: "destructive" });
    }
  };

  /* ---- CATEGORY ACTIONS ---- */

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const cat = await createWikiCategory(newCategoryName.trim());
      setCategories((prev) => [...prev, cat]);
      setExpandedCats((prev) => new Set([...prev, cat.id]));
      setNewCategoryName("");
      setShowNewCategory(false);
      toast({ title: "Категория создана" });
    } catch {
      toast({ title: "Ошибка", variant: "destructive" });
    }
  };

  const handleRenameCategory = async () => {
    if (!renameCat || !renameCatName.trim()) return;
    try {
      await updateWikiCategory(renameCat.id, { name: renameCatName.trim() });
      setCategories((prev) => prev.map((c) => c.id === renameCat.id ? { ...c, name: renameCatName.trim() } : c));
      setRenameCat(null);
      toast({ title: "Категория переименована" });
    } catch {
      toast({ title: "Ошибка", variant: "destructive" });
    }
  };

  /* ---- ARTICLE CREATE ---- */

  const handleCreateArticle = async () => {
    if (!newArticleTitle.trim() || !newArticleCatId) return;
    try {
      const article = await createWikiArticle({
        category_id: newArticleCatId,
        title: newArticleTitle.trim(),
        content: "",
        author_id: user ? parseInt(user.id) : undefined,
      });
      setArticles((prev) => [...prev, article]);
      setNewArticleTitle("");
      setShowNewArticle(false);
      // Open the new article and start editing
      setSelectedArticle(article);
      setTimeout(() => {
        setEditing(true);
        setEditTitle(article.title);
        editor?.setEditable(true);
        editor?.commands.setContent("");
        editor?.commands.focus("end");
      }, 100);
      toast({ title: "Статья создана" });
    } catch {
      toast({ title: "Ошибка", variant: "destructive" });
    }
  };

  /* ---- DELETE ---- */

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === "category") {
        await deleteWikiCategory(deleteTarget.id);
        setCategories((prev) => prev.filter((c) => c.id !== deleteTarget.id));
        setArticles((prev) => prev.filter((a) => a.category_id !== deleteTarget.id));
        if (selectedArticle?.category_id === deleteTarget.id) setSelectedArticle(null);
      } else {
        await deleteWikiArticle(deleteTarget.id);
        setArticles((prev) => prev.filter((a) => a.id !== deleteTarget.id));
        if (selectedArticle?.id === deleteTarget.id) setSelectedArticle(null);
      }
      setDeleteTarget(null);
      toast({ title: "Удалено" });
    } catch {
      toast({ title: "Ошибка при удалении", variant: "destructive" });
    }
  };

  /* ---- SEARCH ---- */

  const filteredArticles = useMemo(() => {
    if (!searchQuery.trim()) return articles;
    const q = searchQuery.toLowerCase();
    return articles.filter(
      (a) => a.title.toLowerCase().includes(q) || a.category_name?.toLowerCase().includes(q)
    );
  }, [articles, searchQuery]);

  const articlesByCategory = useMemo(() => {
    const map = new Map<number, WikiArticle[]>();
    filteredArticles.forEach((a) => {
      const existing = map.get(a.category_id) || [];
      existing.push(a);
      map.set(a.category_id, existing);
    });
    return map;
  }, [filteredArticles]);

  const toggleCategory = (catId: number) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId); else next.add(catId);
      return next;
    });
  };

  const formatDate = (dateStr: string) => {
    const locale = { ru: "ru-RU", kk: "kk-KZ", en: "en-US" }[i18n.language] ?? "ru-RU";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
    } catch { return dateStr; }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        <div className="w-72 shrink-0 border-r p-4 space-y-3 hidden md:block">
          <Skeleton className="h-8 w-full rounded-lg" />
          <Skeleton className="h-6 w-32" />
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
        </div>
        <div className="flex-1 p-4 md:p-6 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-full md:w-96" />
          <Skeleton className="h-[300px] w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const sidebarContent = (
    <>
      {/* Header */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Plus className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowNewCategory(true)}>
                  <FolderPlus className="h-4 w-4 mr-2" />
                  Новая категория
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    if (categories.length === 0) {
                      toast({ title: "Сначала создайте категорию", variant: "destructive" });
                      return;
                    }
                    setNewArticleCatId(categories[0].id);
                    setShowNewArticle(true);
                  }}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Новая статья
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Поиск..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm bg-background"
          />
        </div>
      </div>

      <Separator />

      {/* Tree */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {categories.length === 0 && (
            <div className="text-center py-8 px-4">
              <BookOpen className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">
                {isAdmin ? "Создайте первую категорию" : "База знаний пуста"}
              </p>
            </div>
          )}
          {categories.map((cat) => {
            const catArticles = articlesByCategory.get(cat.id) || [];
            const isExpanded = expandedCats.has(cat.id);
            return (
              <div key={cat.id}>
                <div className="flex items-center group">
                  <button
                    onClick={() => toggleCategory(cat.id)}
                    className="flex items-center gap-1.5 flex-1 px-2 py-1.5 rounded-md hover:bg-muted text-sm font-medium text-foreground/80 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className="truncate">{cat.name}</span>
                    <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1.5 shrink-0">
                      {catArticles.length}
                    </Badge>
                  </button>
                  {isAdmin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost" size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setNewArticleCatId(cat.id); setShowNewArticle(true); }}>
                          <Plus className="h-3.5 w-3.5 mr-2" />Добавить статью
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setRenameCat(cat); setRenameCatName(cat.name); }}>
                          <Pencil className="h-3.5 w-3.5 mr-2" />Переименовать
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteTarget({ type: "category", id: cat.id, name: cat.name })}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />Удалить
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                {isExpanded && (
                  <div className="ml-3 pl-3 border-l border-border/50 space-y-0.5 mt-0.5 mb-1">
                    {catArticles.length === 0 && (
                      <p className="text-[11px] text-muted-foreground px-2 py-1 italic">Нет статей</p>
                    )}
                    {catArticles.map((art) => (
                      <button
                        key={art.id}
                        onClick={() => handleSelectArticle(art.id)}
                        className={cn(
                          "flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm transition-colors text-left group/item",
                          selectedArticle?.id === art.id
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-foreground/70 hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate flex-1">{art.title}</span>
                        {isAdmin && (
                          <Button
                            variant="ghost" size="icon"
                            className="h-5 w-5 opacity-0 group-hover/item:opacity-100 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget({ type: "article", id: art.id, name: art.title });
                            }}
                          >
                            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                          </Button>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </>
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* ====== MOBILE SIDEBAR SHEET ====== */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-72 p-0 flex flex-col">
          {sidebarContent}
        </SheetContent>
      </Sheet>

      {/* ====== DESKTOP SIDEBAR ====== */}
      <div className="w-72 shrink-0 border-r border-border hidden md:flex flex-col bg-muted/20">
        {sidebarContent}
      </div>

      {/* ====== MAIN CONTENT ====== */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!selectedArticle ? (
          /* Empty state */
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center space-y-4 max-w-sm">
              <div className="relative mx-auto w-20 h-20">
                <div className="absolute inset-0 bg-primary/10 rounded-2xl rotate-6" />
                <div className="absolute inset-0 bg-primary/5 rounded-2xl -rotate-3" />
                <div className="relative flex items-center justify-center h-full">
                  <BookOpen className="h-10 w-10 text-primary" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-heading font-bold text-foreground">База знаний TODAY</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Выберите статью из списка {isMobile ? "" : "слева "}или воспользуйтесь поиском
                </p>
              </div>
              {isMobile && (
                <Button variant="outline" onClick={() => setSidebarOpen(true)} className="gap-2">
                  <PanelLeft className="h-4 w-4" />
                  Открыть каталог
                </Button>
              )}
              {isAdmin && categories.length === 0 && (
                <Button onClick={() => setShowNewCategory(true)} className="gap-2">
                  <FolderPlus className="h-4 w-4" />
                  Создать первую категорию
                </Button>
              )}
            </div>
          </div>
        ) : (
          /* Article view */
          <>
            {/* Article header */}
            <div className="border-b border-border px-4 md:px-8 py-3 md:py-4 flex items-center justify-between gap-2 md:gap-4 shrink-0 bg-background">
              {isMobile && (
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setSidebarOpen(true)}>
                  <PanelLeft className="h-4 w-4" />
                </Button>
              )}
              <div className="min-w-0 flex-1">
                {editing ? (
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="text-xl font-heading font-bold border-none shadow-none px-0 h-auto focus-visible:ring-0"
                    placeholder="Название статьи"
                  />
                ) : (
                  <h1 className="text-xl font-heading font-bold text-foreground truncate">
                    {selectedArticle.title}
                  </h1>
                )}
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {selectedArticle.category_name && (
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {selectedArticle.category_name}
                    </Badge>
                  )}
                  {selectedArticle.author_name && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {selectedArticle.author_name}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <RelativeTime date={selectedArticle.updated_at || selectedArticle.created_at} />
                  </span>
                </div>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                  {editing ? (
                    <>
                      <Button size="sm" onClick={saveArticle} className="gap-1.5">
                        <Save className="h-3.5 w-3.5" /><span className="hidden sm:inline">Сохранить</span>
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelEditing} className="gap-1.5">
                        <X className="h-3.5 w-3.5" /><span className="hidden sm:inline">Отмена</span>
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={startEditing} className="gap-1.5">
                        <Pencil className="h-3.5 w-3.5" /><span className="hidden sm:inline">Редактировать</span>
                      </Button>
                      <Button
                        size="sm" variant="outline"
                        className="gap-1.5 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget({ type: "article", id: selectedArticle.id, name: selectedArticle.title })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Editor toolbar (only when editing) */}
            {editing && <EditorToolbar editor={editor} />}

            {/* Article body */}
            <ScrollArea className="flex-1">
              <div className="max-w-3xl mx-auto px-4 md:px-8 py-4 md:py-6">
                <EditorContent editor={editor} />
              </div>
            </ScrollArea>
          </>
        )}
      </div>

      {/* ====== DIALOGS ====== */}

      {/* New Category */}
      <Dialog open={showNewCategory} onOpenChange={setShowNewCategory}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Новая категория</DialogTitle></DialogHeader>
          <Input
            placeholder="Название категории"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreateCategory(); }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCategory(false)}>Отмена</Button>
            <Button onClick={handleCreateCategory} disabled={!newCategoryName.trim()}>Создать</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Category */}
      <Dialog open={!!renameCat} onOpenChange={(o) => { if (!o) setRenameCat(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Переименовать категорию</DialogTitle></DialogHeader>
          <Input
            placeholder="Новое название"
            value={renameCatName}
            onChange={(e) => setRenameCatName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleRenameCategory(); }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameCat(null)}>Отмена</Button>
            <Button onClick={handleRenameCategory} disabled={!renameCatName.trim()}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Article */}
      <Dialog open={showNewArticle} onOpenChange={setShowNewArticle}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Новая статья</DialogTitle></DialogHeader>
          <Input
            placeholder="Название статьи"
            value={newArticleTitle}
            onChange={(e) => setNewArticleTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreateArticle(); }}
            autoFocus
          />
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Button
                key={c.id}
                variant={newArticleCatId === c.id ? "default" : "outline"}
                size="sm"
                onClick={() => setNewArticleCatId(c.id)}
              >
                {c.name}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewArticle(false)}>Отмена</Button>
            <Button onClick={handleCreateArticle} disabled={!newArticleTitle.trim() || !newArticleCatId}>
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Удалить {deleteTarget?.type === "category" ? "категорию" : "статью"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === "category"
                ? `Категория «${deleteTarget?.name}» и все её статьи будут удалены безвозвратно.`
                : `Статья «${deleteTarget?.name}» будет удалена безвозвратно.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
