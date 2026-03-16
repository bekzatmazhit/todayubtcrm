import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Construction, ClipboardCheck } from "lucide-react";

export default function GradesPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-3xl font-bold font-heading flex items-center gap-2 md:gap-3">
            <ClipboardCheck className="h-8 w-8 text-primary" />
            {t("Grades")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("Grades module for tracking student credits")}</p>
        </div>
      </div>

      {/* Under Construction Banner */}
      <Card className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900/40">
            <Construction className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-amber-800 dark:text-amber-300">{t("Under Development")}</h3>
              <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-700 dark:text-amber-400">
                Beta
              </Badge>
            </div>
            <p className="text-sm text-amber-700/80 dark:text-amber-400/80 mt-0.5">
              {t("This module is being finalized. Core functionality is active.")}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Placeholder content */}
      <div className="text-center py-20 text-muted-foreground">
        <ClipboardCheck className="h-16 w-16 mx-auto mb-4 opacity-20" />
        <p className="text-lg font-medium">Модуль зачетов</p>
        <p className="text-sm mt-2 max-w-md mx-auto">
          Здесь будет система учёта зачётов и промежуточных аттестаций студентов.
          Основной функционал находится в процессе финальной настройки.
        </p>
      </div>
    </div>
  );
}
