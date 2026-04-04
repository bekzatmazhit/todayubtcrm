import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Hash, Users, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/contexts/AuthContext";
import { fetchChatMessages, sendChatMessage, fetchUsers } from "@/lib/api";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface ChatMessage {
  id: number;
  sender_id: number;
  sender_name: string;
  sender_surname: string;
  sender_avatar: string | null;
  room: string;
  text: string;
  created_at: string;
}

const ROOMS = [
  { id: "general", label: "Общий", icon: Hash },
  { id: "teachers", label: "Преподаватели", icon: Users },
  { id: "admins", label: "Администрация", icon: Users },
];

export default function ChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [room, setRoom] = useState("general");
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  // Load messages
  const loadMessages = useCallback(async () => {
    try {
      const msgs = await fetchChatMessages(room);
      setMessages(msgs);
    } catch {}
  }, [room]);

  // Load users
  useEffect(() => {
    fetchUsers().then(setAllUsers).catch(() => {});
  }, []);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // WebSocket connection
  useEffect(() => {
    if (!user) return;
    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.hostname}:3001`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'auth', userId: user!.id }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'chat_message' && data.payload) {
            setMessages(prev => {
              if (prev.find(m => m.id === data.payload.id)) return prev;
              return [...prev, data.payload];
            });
          } else if (data.type === 'online_users') {
            setOnlineUsers(data.payload || []);
          }
        } catch {}
      };

      ws.onclose = () => {
        reconnectTimer.current = setTimeout(connect, 3000);
      };
    }
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [user]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !user || sending) return;
    setSending(true);
    try {
      await sendChatMessage(Number(user.id), newMessage.trim(), room);
      setNewMessage("");
    } catch {}
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group messages by date
  const groupedMessages: { date: string; msgs: ChatMessage[] }[] = [];
  for (const msg of messages.filter(m => m.room === room)) {
    const dateStr = msg.created_at?.split("T")[0] || msg.created_at?.split(" ")[0] || "";
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.date === dateStr) {
      last.msgs.push(msg);
    } else {
      groupedMessages.push({ date: dateStr, msgs: [msg] });
    }
  }

  function formatDateLabel(dateStr: string) {
    try {
      const d = new Date(dateStr);
      const today = new Date();
      if (d.toDateString() === today.toDateString()) return "Сегодня";
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (d.toDateString() === yesterday.toDateString()) return "Вчера";
      return format(d, "d MMMM yyyy", { locale: ru });
    } catch { return dateStr; }
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Sidebar — rooms + online users */}
      <div className="w-64 border-r bg-muted/30 flex flex-col shrink-0 hidden md:flex">
        <div className="p-4" />
        <Separator />
        <div className="p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Каналы</p>
          {ROOMS.map(r => (
            <button
              key={r.id}
              onClick={() => setRoom(r.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                room === r.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              <r.icon className="h-4 w-4" />
              {r.label}
            </button>
          ))}
        </div>
        <Separator />
        <div className="p-3 flex-1 overflow-auto">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Онлайн — {onlineUsers.length}
          </p>
          {allUsers
            .filter(u => onlineUsers.includes(String(u.id)))
            .map(u => (
              <div key={u.id} className="flex items-center gap-2 px-2 py-1.5 text-sm">
                <div className="relative">
                  <UserAvatar user={{ full_name: `${u.name} ${u.surname}`, avatar_url: u.avatar_url }} size="sm" />
                  <Circle className="absolute -bottom-0.5 -right-0.5 h-3 w-3 fill-emerald-500 text-emerald-500" />
                </div>
                <span className="truncate">{u.name} {u.surname}</span>
              </div>
            ))}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="h-14 border-b flex items-center px-4 gap-3 shrink-0">
          <Hash className="h-5 w-5 text-muted-foreground" />
          <span className="font-semibold">{ROOMS.find(r => r.id === room)?.label || room}</span>
          {/* Mobile room switcher */}
          <div className="flex md:hidden gap-1 ml-auto">
            {ROOMS.map(r => (
              <button
                key={r.id}
                onClick={() => setRoom(r.id)}
                className={`px-2 py-1 rounded text-xs ${room === r.id ? "bg-primary text-primary-foreground" : "bg-muted"}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1">
          {groupedMessages.length === 0 && (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Нет сообщений. Начните разговор!
            </div>
          )}
          {groupedMessages.map(group => (
            <div key={group.date}>
              <div className="flex items-center gap-3 my-4">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground font-medium shrink-0">{formatDateLabel(group.date)}</span>
                <Separator className="flex-1" />
              </div>
              {group.msgs.map((msg, i) => {
                const isOwn = String(msg.sender_id) === user?.id;
                const prevMsg = i > 0 ? group.msgs[i - 1] : null;
                const showAvatar = !prevMsg || prevMsg.sender_id !== msg.sender_id;
                return (
                  <div key={msg.id} className={`flex gap-3 ${showAvatar ? "mt-3" : "mt-0.5"} ${isOwn ? "" : ""}`}>
                    <div className="w-8 shrink-0">
                      {showAvatar && (
                        <UserAvatar
                          user={{ full_name: `${msg.sender_name} ${msg.sender_surname}`, avatar_url: msg.sender_avatar }}
                          size="sm"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      {showAvatar && (
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className="text-sm font-semibold">{msg.sender_name} {msg.sender_surname}</span>
                          <span className="text-xs text-muted-foreground">
                            {msg.created_at ? format(new Date(msg.created_at.replace(" ", "T")), "HH:mm") : ""}
                          </span>
                        </div>
                      )}
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="border-t p-3 shrink-0">
          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Сообщение в #${ROOMS.find(r => r.id === room)?.label || room}...`}
              className="flex-1"
              maxLength={2000}
            />
            <Button onClick={handleSend} disabled={!newMessage.trim() || sending} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
