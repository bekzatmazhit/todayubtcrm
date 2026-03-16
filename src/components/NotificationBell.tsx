import { useState, useEffect, useCallback } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type AppNotification,
} from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { RelativeTime } from "@/components/RelativeTime";

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    const data = await fetchMyNotifications(parseInt(user.id));
    setNotifications(data);
  }, [user]);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30_000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleClick = async (notif: AppNotification) => {
    if (!notif.is_read) {
      await markNotificationRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: 1 } : n))
      );
    }
    if (notif.action_url) {
      navigate(notif.action_url);
      setOpen(false);
    }
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    await markAllNotificationsRead(parseInt(user.id));
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1 leading-none">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-sm text-foreground">Уведомления</h3>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Прочитать все
            </button>
          )}
        </div>
        <div className="max-h-[340px] overflow-y-auto divide-y divide-border/50">
          {notifications.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Нет уведомлений
            </div>
          ) : (
            notifications.map((notif) => (
              <button
                key={notif.id}
                onClick={() => handleClick(notif)}
                className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${
                  !notif.is_read ? "bg-blue-50 dark:bg-blue-950/20" : ""
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {!notif.is_read && (
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                  )}
                  <div className={!notif.is_read ? "" : "pl-[18px]"}>
                    <p className="text-sm font-medium text-foreground leading-tight">
                      {notif.title}
                    </p>
                    {notif.message && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {notif.message}
                      </p>
                    )}
                    <RelativeTime date={notif.created_at} className="text-[10px] text-muted-foreground/60 mt-1 block" />
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
