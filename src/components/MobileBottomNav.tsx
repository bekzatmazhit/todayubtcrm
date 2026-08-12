import { useLocation, useNavigate } from "react-router-dom";
import { Calendar, Users, ListTodo, FolderOpen, LayoutGrid, BarChart3, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const tabs = [
  { path: "/", icon: Calendar, label: "Расписание" },
  { path: "/students", icon: Users, label: "Журнал" },
  { path: "/ent-results", icon: BarChart3, label: "ЕНТ" },
  { path: "/curatorship", icon: Shield, label: "ОС" },
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
      return !["/", "/students", "/ent-results", "/curatorship"].includes(location.pathname);
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-2xl border-t border-border/50 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.4)] md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="flex items-center justify-around h-16 px-2">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          return (
            <button
              key={tab.path}
              onClick={() => handleTap(tab.path)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all duration-300 relative group",
                "active:scale-90",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className={cn(
                "relative flex items-center justify-center w-12 h-8 rounded-full transition-all duration-300",
                active ? "bg-primary/10 scale-110" : "bg-transparent group-hover:bg-muted/50"
              )}>
                <tab.icon className={cn("h-5 w-5 transition-transform duration-300", active ? "scale-110" : "")} strokeWidth={active ? 2.5 : 2} />
              </div>
              <span className={cn(
                "text-[10px] font-semibold leading-none transition-all duration-300",
                active ? "opacity-100 transform translate-y-0" : "opacity-70"
              )}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
