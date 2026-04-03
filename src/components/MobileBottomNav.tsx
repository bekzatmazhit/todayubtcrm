import { useLocation, useNavigate } from "react-router-dom";
import { Calendar, Users, ListTodo, FolderOpen, LayoutGrid } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const tabs = [
  { path: "/", icon: Calendar, label: "Расписание" },
  { path: "/students", icon: Users, label: "Ученики" },
  { path: "/tasks", icon: ListTodo, label: "Задачи" },
  { path: "/storage", icon: FolderOpen, label: "Файлы" },
  { path: "/_more", icon: LayoutGrid, label: "Ещё" },
];

export function MobileBottomNav() {
  const isMobile = useIsMobile();
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (!isMobile || !isAuthenticated) return null;

  // Don't show on login page
  if (location.pathname === "/login") return null;

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    if (path === "/_more") {
      return !["/", "/students", "/tasks", "/storage"].includes(location.pathname);
    }
    return location.pathname.startsWith(path);
  };

  const handleTap = (path: string) => {
    if (path === "/_more") {
      // Open sidebar via trigger
      const trigger = document.querySelector<HTMLButtonElement>("[data-sidebar='trigger']");
      if (trigger) trigger.click();
      return;
    }
    navigate(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="flex items-center justify-around h-14">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          return (
            <button
              key={tab.path}
              onClick={() => handleTap(tab.path)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors relative",
                "active:scale-95 active:bg-muted/50",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
              )}
              <tab.icon className="h-5 w-5" strokeWidth={active ? 2.5 : 1.5} />
              <span className="text-[10px] font-medium leading-none">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
