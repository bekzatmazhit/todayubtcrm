import { useLocation, Link, useNavigate } from "react-router-dom";
import { ChevronRight, Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const ROUTE_NAMES: Record<string, string> = {
  "students": "Студенты",
  "student-360": "Профиль (360)",
  "ent-results": "ЕНТ",
  "admission": "Поступление",
  "curatorship": "Кураторство",
  "team": "Команда",
  "tasks": "Задачи",
  "storage": "Хранилище",
  "wiki": "База знаний",
  "settings": "Настройки",
  "admin": "Админ-панель",
  "grades": "Оценки",
  "broadcast": "Рассылка",
  "chat": "Чаты",
  "docs": "Документы",
  "quiz-results": "Квизы",
  "teacher-analytics": "Аналитика",
  "reports": "Отчеты",
  "calendar": "Расписание"
};

export function GlobalBreadcrumbs() {
  const location = useLocation();
  const navigate = useNavigate();
  const paths = location.pathname.split("/").filter(p => p);

  if (paths.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground ml-3 hidden md:flex">
      <Button variant="ghost" size="icon" className="h-6 w-6 mr-1" onClick={() => navigate(-1)} title="Назад">
        <ArrowLeft className="h-3.5 w-3.5" />
      </Button>

      <Link to="/" className="hover:text-foreground transition-colors flex items-center">
        <Home className="h-3.5 w-3.5" />
      </Link>

      {paths.map((path, index) => {
        const url = `/${paths.slice(0, index + 1).join("/")}`;
        const isLast = index === paths.length - 1;
        const name = ROUTE_NAMES[path] || path;
        
        // Hide very long UUIDs or IDs, just show short hash
        const displayName = path.length > 15 ? path.substring(0, 6) + "..." : name;

        return (
          <div key={url} className="flex items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            {isLast ? (
              <span className="font-medium text-foreground">{displayName}</span>
            ) : (
              <Link to={url} className="hover:text-foreground transition-colors">
                {displayName}
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
