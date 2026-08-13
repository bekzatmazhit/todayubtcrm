import React from "react";
import { Card, CardContent } from "@/components/ui/card";

export function MetricCard({
  icon: Icon, label, value, sub, iconClass,
}: { icon: React.ElementType; label: string; value: string | number | null; sub?: string; iconClass?: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconClass || "bg-primary/10"}`}>
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className="text-2xl font-bold mt-0.5">{value ?? "—"}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
