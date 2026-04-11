import { useState, useEffect } from "react";
import { fetchActiveBanners } from "@/lib/api";
import { Info, AlertTriangle, AlertCircle, X } from "lucide-react";

const TYPE_CONFIG: Record<string, { bg: string; text: string; icon: typeof Info }> = {
  info: { bg: "bg-blue-600", text: "text-white", icon: Info },
  warning: { bg: "bg-amber-500", text: "text-white", icon: AlertTriangle },
  danger: { bg: "bg-red-600", text: "text-white", icon: AlertCircle },
};

export function AdminBanner() {
  const [banners, setBanners] = useState<any[]>([]);
  const [dismissed, setDismissed] = useState<Set<number>>(() => {
    try {
      const stored = localStorage.getItem("dismissed_banners");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  useEffect(() => {
    fetchActiveBanners().then(setBanners).catch(() => {});
    const interval = setInterval(() => {
      fetchActiveBanners().then(setBanners).catch(() => {});
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const dismiss = (id: number) => {
    setDismissed(prev => {
      const next = new Set(prev).add(id);
      localStorage.setItem("dismissed_banners", JSON.stringify([...next]));
      return next;
    });
  };

  const visible = banners.filter(b => !dismissed.has(b.id));
  if (visible.length === 0) return null;

  return (
    <div className="w-full flex flex-col shrink-0">
      {visible.map(banner => {
        const config = TYPE_CONFIG[banner.type] || TYPE_CONFIG.info;
        const Icon = config.icon;
        return (
          <div key={banner.id}
            className={`${config.bg} ${config.text} px-4 py-1.5 flex items-center gap-2 text-sm relative overflow-hidden`}>
            <Icon className="h-4 w-4 shrink-0" />
            <div className="flex-1 overflow-hidden whitespace-nowrap">
              <div className="inline-block animate-marquee">
                {banner.text}
              </div>
            </div>
            <button onClick={() => dismiss(banner.id)}
              className="shrink-0 p-0.5 rounded hover:bg-white/20 transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
