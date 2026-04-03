import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchBroadcasts, createBroadcast, markBroadcastRead, deleteBroadcast,
  fetchUnreadBroadcastCount,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { UserAvatar } from "@/components/UserAvatar";
import { RelativeTime } from "@/components/RelativeTime";
import { Skeleton } from "@/components/ui/skeleton";
import i18n from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import {
  Radio, Plus, CheckCheck, Eye, Trash2, AlertTriangle, Info, AlertCircle,
  Megaphone,
} from "lucide-react";

const PRIORITY_CONFIG = {
  normal: { label: "Обычный", color: "bg-blue-500/10 text-blue-600 border-blue-200", icon: Info },
  important: { label: "Важный", color: "bg-amber-500/10 text-amber-600 border-amber-200", icon: AlertTriangle },
  critical: { label: "Критический", color: "bg-red-500/10 text-red-600 border-red-200", icon: AlertCircle },
};

function fmtDate(d: string) {
  const locale = { ru: "ru-RU", kk: "kk-KZ", en: "en-US" }[i18n.language] ?? "ru-RU";
  return new Date(d).toLocaleString(locale, {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function BroadcastPage() {
  const { user } = useAuth();
  const uid = Number(user?.id) || 0;
  const isAdmin = user?.role === "admin" || user?.role === "umo_head";
  const { toast } = useToast();

  const [messages, setMessages] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [msgs, unread] = await Promise.all([
        fetchBroadcasts(uid),
        fetchUnreadBroadcastCount(uid),
      ]);
      setMessages(msgs);
      setUnreadCount(unread.count);
    } catch { /* ignore */ }
    setLoading(false);
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  const handleMarkRead = async (msgId: number) => {
    await markBroadcastRead(msgId, uid);
    toast({ title: "Отмечено прочитанным" });
    load();
  };

  const handleDelete = async (msgId: number) => {
    await deleteBroadcast(msgId);
    toast({ title: "Сообщение удалено" });
    load();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Megaphone className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Каналы</h1>
            <p className="text-sm text-muted-foreground">
              Важные объявления для всех сотрудников
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2 text-xs">{unreadCount} непрочитанных</Badge>
              )}
            </p>
          </div>
        </div>
        {isAdmin && (
          <Button className="gap-1.5" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> Новое объявление
          </Button>
        )}
      </div>

      {/* Messages */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl border p-4 space-y-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <div className="flex items-center gap-3"><Skeleton className="h-6 w-6 rounded-full" /><Skeleton className="h-3 w-32" /></div>
            </div>
          ))}
        </div>
      ) : messages.length === 0 ? (
        <div className="text-center py-20">
          <Radio className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">Пока нет объявлений</p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => {
            const prio = PRIORITY_CONFIG[msg.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.normal;
            const PrioIcon = prio.icon;
            return (
              <Card key={msg.id} className={`border ${!msg.is_read ? "border-primary/40 shadow-md" : "opacity-80"}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${prio.color}`}>
                        <PrioIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className={`font-semibold ${!msg.is_read ? "text-foreground" : "text-muted-foreground"}`}>
                            {msg.title}
                          </h3>
                          <Badge variant="outline" className={`text-xs ${prio.color}`}>{prio.label}</Badge>
                          {msg.is_read ? (
                            <Badge variant="outline" className="text-xs text-green-600 gap-1">
                              <CheckCheck className="h-3 w-3" /> Прочитано
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">Непрочитано</Badge>
                          )}
                        </div>
                        {msg.content && (
                          <p className={`text-sm mt-1 whitespace-pre-wrap ${!msg.is_read ? "" : "text-muted-foreground"}`}>
                            {msg.content}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <UserAvatar user={{ full_name: msg.author_name, avatar_url: msg.author_avatar }} size="xs" />
                            <span>{msg.author_name}</span>
                          </div>
                          <RelativeTime date={msg.created_at} />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!msg.is_read && (
                        <Button size="sm" className="gap-1.5 h-8" onClick={() => handleMarkRead(msg.id)}>
                          <Eye className="h-3.5 w-3.5" /> Прочитано
                        </Button>
                      )}
                      {isAdmin && (
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(msg.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      {showCreate && (
        <CreateBroadcastDialog
          userId={uid}
          onClose={() => setShowCreate(false)}
          onCreated={load}
        />
      )}
    </div>
  );
}

function CreateBroadcastDialog({ userId, onClose, onCreated }: { userId: number; onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState("normal");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await createBroadcast({ author_id: userId, title: title.trim(), content: content.trim(), priority });
      toast({ title: "Объявление опубликовано" });
      onCreated();
      onClose();
    } catch {
      toast({ title: "Ошибка", variant: "destructive" });
    }
    setSubmitting(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" /> Новое объявление
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium mb-1 block">Заголовок *</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Заголовок объявления" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Содержание</label>
            <Textarea value={content} onChange={e => setContent(e.target.value)}
              placeholder="Подробное описание..." rows={4} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Приоритет</label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">🔵 Обычный</SelectItem>
                <SelectItem value="important">🟡 Важный</SelectItem>
                <SelectItem value="critical">🔴 Критический</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || submitting}>
            Опубликовать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
