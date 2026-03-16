import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { DOC_CATEGORIES, DOC_ARTICLES, type DocArticle } from "@/data/docs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  BookOpen,
  Keyboard,
  Users,
  Table2,
  Calendar,
  ListTodo,
  Shield,
  ChevronRight,
  Info,
  AlertTriangle,
  FileText,
  Moon,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/ThemeProvider";

const ICON_MAP: Record<string, React.ElementType> = {
  BookOpen,
  Keyboard,
  Users,
  Table2,
  Calendar,
  ListTodo,
  Shield,
};

interface TocItem {
  id: string;
  text: string;
  level: number;
}

function extractToc(markdown: string): TocItem[] {
  const lines = markdown.split("\n");
  const toc: TocItem[] = [];
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = line.match(/^(#{1,3})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].replace(/\*\*/g, "").trim();
      const id = text
        .toLowerCase()
        .replace(/[^a-zа-яёғқңөұүһәі0-9\s-]/gi, "")
        .replace(/\s+/g, "-");
      toc.push({ id, text, level });
    }
  }
  return toc;
}

function generateHeadingId(text: string): string {
  const clean = typeof text === "string" ? text : String(text);
  return clean
    .toLowerCase()
    .replace(/\*\*/g, "")
    .replace(/[^a-zа-яёғқңөұүһәі0-9\s-]/gi, "")
    .replace(/\s+/g, "-");
}

function childrenToText(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(childrenToText).join("");
  if (children && typeof children === "object" && "props" in children) {
    return childrenToText((children as React.ReactElement).props.children);
  }
  return "";
}

export default function DocsPage() {
  const [activeArticleId, setActiveArticleId] = useState(DOC_ARTICLES[0]?.id ?? "");
  const [activeTocId, setActiveTocId] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  const activeArticle = useMemo(
    () => DOC_ARTICLES.find((a) => a.id === activeArticleId) ?? DOC_ARTICLES[0],
    [activeArticleId]
  );

  const toc = useMemo(() => extractToc(activeArticle.content), [activeArticle]);

  const articlesByCategory = useMemo(() => {
    const map: Record<string, DocArticle[]> = {};
    for (const cat of DOC_CATEGORIES) {
      map[cat.id] = DOC_ARTICLES.filter((a) => a.category === cat.id);
    }
    return map;
  }, []);

  const openCategories = useMemo(() => {
    const cat = activeArticle.category;
    return [cat];
  }, [activeArticle.category]);

  // Intersection Observer for TOC highlighting
  useEffect(() => {
    const container = contentRef.current;
    if (!container || toc.length === 0) return;

    const headings = container.querySelectorAll("h1[id], h2[id], h3[id]");
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveTocId(entry.target.id);
            break;
          }
        }
      },
      { root: container, rootMargin: "-10% 0px -80% 0px", threshold: 0 }
    );

    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [activeArticle, toc]);

  const scrollToHeading = useCallback((id: string) => {
    const el = contentRef.current?.querySelector(`#${CSS.escape(id)}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveTocId(id);
    }
  }, []);

  const markdownComponents = useMemo(
    () => ({
      h1: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
        const text = childrenToText(children);
        const id = generateHeadingId(text);
        return (
          <h1 id={id} className="text-3xl font-bold mt-8 mb-4 text-foreground scroll-mt-4" {...props}>
            {children}
          </h1>
        );
      },
      h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
        const text = childrenToText(children);
        const id = generateHeadingId(text);
        return (
          <h2 id={id} className="text-2xl font-semibold mt-8 mb-3 text-foreground scroll-mt-4 border-b pb-2 border-border" {...props}>
            {children}
          </h2>
        );
      },
      h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
        const text = childrenToText(children);
        const id = generateHeadingId(text);
        return (
          <h3 id={id} className="text-xl font-semibold mt-6 mb-2 text-foreground scroll-mt-4" {...props}>
            {children}
          </h3>
        );
      },
      p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
        <p className="mb-4 leading-7 text-muted-foreground" {...props}>{children}</p>
      ),
      ul: ({ children, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
        <ul className="mb-4 ml-6 list-disc space-y-1 text-muted-foreground" {...props}>{children}</ul>
      ),
      ol: ({ children, ...props }: React.HTMLAttributes<HTMLOListElement>) => (
        <ol className="mb-4 ml-6 list-decimal space-y-1 text-muted-foreground" {...props}>{children}</ol>
      ),
      li: ({ children, ...props }: React.HTMLAttributes<HTMLLIElement>) => (
        <li className="leading-7" {...props}>{children}</li>
      ),
      table: ({ children, ...props }: React.HTMLAttributes<HTMLTableElement>) => (
        <div className="mb-6 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm" {...props}>{children}</table>
        </div>
      ),
      thead: ({ children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
        <thead className="bg-muted/50 border-b border-border" {...props}>{children}</thead>
      ),
      th: ({ children, ...props }: React.HTMLAttributes<HTMLTableCellElement>) => (
        <th className="px-4 py-2.5 text-left font-semibold text-foreground" {...props}>{children}</th>
      ),
      td: ({ children, ...props }: React.HTMLAttributes<HTMLTableCellElement>) => (
        <td className="px-4 py-2.5 border-t border-border text-muted-foreground" {...props}>{children}</td>
      ),
      blockquote: ({ children }: { children?: React.ReactNode }) => {
        const text = childrenToText(children);
        const isWarning = text.includes("Важно:");
        const Icon = isWarning ? AlertTriangle : Info;
        const borderColor = isWarning ? "border-amber-500" : "border-blue-500";
        const bgColor = isWarning ? "bg-amber-500/10" : "bg-blue-500/10";
        const iconColor = isWarning ? "text-amber-500" : "text-blue-500";

        return (
          <div className={cn("mb-6 flex gap-3 rounded-lg border-l-4 p-4", borderColor, bgColor)}>
            <Icon className={cn("mt-0.5 h-5 w-5 flex-shrink-0", iconColor)} />
            <div className="[&>p]:mb-0 [&>p]:text-foreground">{children}</div>
          </div>
        );
      },
      code: ({ className, children, ...props }: React.HTMLAttributes<HTMLElement>) => {
        const isBlock = className?.startsWith("language-") || className?.includes("hljs");
        if (isBlock) {
          return (
            <code className={cn(className, "text-sm")} {...props}>
              {children}
            </code>
          );
        }
        return (
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono text-foreground" {...props}>
            {children}
          </code>
        );
      },
      pre: ({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) => (
        <pre className="mb-6 overflow-x-auto rounded-lg border border-border bg-[#0d1117] p-4 text-sm" {...props}>
          {children}
        </pre>
      ),
      strong: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
        <strong className="font-semibold text-foreground" {...props}>{children}</strong>
      ),
      hr: () => <Separator className="my-8" />,
    }),
    []
  );

  const { theme, setTheme } = useTheme();

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Top header */}
      <header className="h-14 flex-shrink-0 border-b border-border bg-background flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-primary" />
          <span className="font-heading font-bold text-lg">TODAY</span>
          <Separator orientation="vertical" className="h-5 mx-1" />
          <span className="text-sm text-muted-foreground">Документация</span>
        </div>
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="rounded-md p-2 hover:bg-muted transition-colors"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </header>

      {/* Main 3-column layout */}
      <div className="flex flex-1 min-h-0">
        {/* LEFT — Navigation Sidebar */}
        <aside className="w-64 flex-shrink-0 border-r border-border bg-muted/30">
          <ScrollArea className="h-full">
            <div className="p-4">
              <Accordion type="multiple" defaultValue={openCategories} className="space-y-1">
                {DOC_CATEGORIES.map((cat) => {
                  const Icon = ICON_MAP[cat.icon] || BookOpen;
                  const articles = articlesByCategory[cat.id] || [];
                  return (
                    <AccordionItem key={cat.id} value={cat.id} className="border-none">
                      <AccordionTrigger className="py-2 px-2 rounded-md hover:bg-muted text-sm font-medium hover:no-underline [&[data-state=open]]:text-primary">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span>{cat.title}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-1">
                        <div className="ml-4 border-l border-border pl-3 space-y-0.5">
                          {articles.map((art) => (
                            <button
                              key={art.id}
                              onClick={() => {
                                setActiveArticleId(art.id);
                                contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                              className={cn(
                                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors text-left",
                                activeArticleId === art.id
                                  ? "bg-primary/10 text-primary font-medium"
                                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                              )}
                            >
                              <ChevronRight className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{art.title}</span>
                            </button>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>
          </ScrollArea>
        </aside>

      {/* CENTER — Article Content */}
      <main className="flex-1 min-w-0">
        <ScrollArea className="h-full" ref={contentRef}>
          <article className="max-w-3xl mx-auto px-8 py-8">
            <div className="mb-6">
              <span className="inline-block text-xs font-medium uppercase tracking-wider text-primary mb-2">
                {DOC_CATEGORIES.find((c) => c.id === activeArticle.category)?.title}
              </span>
            </div>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={markdownComponents}
            >
              {activeArticle.content}
            </ReactMarkdown>

            {/* Prev / Next navigation */}
            <Separator className="my-8" />
            <div className="flex justify-between gap-4 pb-8">
              {(() => {
                const idx = DOC_ARTICLES.findIndex((a) => a.id === activeArticle.id);
                const prev = idx > 0 ? DOC_ARTICLES[idx - 1] : null;
                const next = idx < DOC_ARTICLES.length - 1 ? DOC_ARTICLES[idx + 1] : null;
                return (
                  <>
                    {prev ? (
                      <button
                        onClick={() => {
                          setActiveArticleId(prev.id);
                          contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="flex-1 text-left rounded-lg border border-border p-4 hover:bg-muted transition-colors group"
                      >
                        <span className="text-xs text-muted-foreground">← Назад</span>
                        <p className="text-sm font-medium text-foreground group-hover:text-primary mt-1 truncate">{prev.title}</p>
                      </button>
                    ) : (
                      <div className="flex-1" />
                    )}
                    {next ? (
                      <button
                        onClick={() => {
                          setActiveArticleId(next.id);
                          contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="flex-1 text-right rounded-lg border border-border p-4 hover:bg-muted transition-colors group"
                      >
                        <span className="text-xs text-muted-foreground">Далее →</span>
                        <p className="text-sm font-medium text-foreground group-hover:text-primary mt-1 truncate">{next.title}</p>
                      </button>
                    ) : (
                      <div className="flex-1" />
                    )}
                  </>
                );
              })()}
            </div>
          </article>
        </ScrollArea>
      </main>

      {/* RIGHT — Table of Contents */}
      <aside className="w-56 flex-shrink-0 border-l border-border bg-muted/30 hidden xl:block">
        <ScrollArea className="h-full">
          <div className="p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              На этой странице
            </h3>
            <nav className="space-y-0.5">
              {toc.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToHeading(item.id)}
                  className={cn(
                    "block w-full text-left text-sm py-1 transition-colors truncate",
                    item.level === 1 && "font-medium",
                    item.level === 2 && "pl-3",
                    item.level === 3 && "pl-6",
                    activeTocId === item.id
                      ? "text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {item.text}
                </button>
              ))}
            </nav>
          </div>
        </ScrollArea>
      </aside>
      </div>
    </div>
  );
}
