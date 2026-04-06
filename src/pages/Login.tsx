import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Eye, EyeOff, X, User, Image, Link, ChevronUp, Check } from "lucide-react";
import { TodayLogo } from "@/components/TodayLogo";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface LastLogin {
  email: string;
  full_name: string;
  role: string;
  timestamp: number;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Администратор",
  umo_head: "Начальник УМО",
  teacher: "Преподаватель",
};

const BG_PRESETS = [
  "https://images.unsplash.com/photo-1497366216548-37526070297c?w=3840&q=90&fit=crop",
  "https://images.unsplash.com/photo-1523050854058-8df90110c476?w=3840&q=90&fit=crop",
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=3840&q=90&fit=crop",
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=3840&q=90&fit=crop",
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=3840&q=90&fit=crop",
  "https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=3840&q=90&fit=crop",
  "https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?w=3840&q=90&fit=crop",
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const API_BASE = import.meta.env.VITE_API_URL || "/api";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [lastLogin, setLastLogin] = useState<LastLogin | null>(null);
  const [showLastLogin, setShowLastLogin] = useState(true);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const passwordRef = useRef<HTMLInputElement>(null);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [bgPickerOpen, setBgPickerOpen] = useState(false);
  const [bgImage, setBgImage] = useState<string | null>(() => localStorage.getItem("login_bg_image"));
  const [customUrl, setCustomUrl] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("today_crm_last_login");
      if (saved) {
        const data = JSON.parse(saved) as LastLogin;
        setLastLogin(data);
        setEmail(data.email);
        // Auto-focus password when last login is detected
        setTimeout(() => passwordRef.current?.focus(), 150);
      }
    } catch { /* ignore */ }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDismissLastLogin = () => {
    setShowLastLogin(false);
    setEmail("");
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail) return;
    setForgotLoading(true);
    try {
      const res = await fetch(`${API_BASE}/password-reset-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "Запрос отправлен", description: "Администратор получил уведомление. Ожидайте сброс пароля." });
      setShowForgot(false);
      setForgotEmail("");
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    } finally {
      setForgotLoading(false);
    }
  };

  const selectBg = (url: string | null) => {
    setBgImage(url);
    if (url) localStorage.setItem("login_bg_image", url);
    else localStorage.removeItem("login_bg_image");
    setBgPickerOpen(false);
    setCustomUrl("");
  };

  const timeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "только что";
    if (mins < 60) return `${mins} мин. назад`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} ч. назад`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "вчера";
    return `${days} дн. назад`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/30 p-4 relative overflow-hidden">
      {/* Custom background image */}
      {bgImage && (
        <div className="fixed inset-0 z-0">
          <img src={bgImage} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/30 dark:bg-black/50" />
        </div>
      )}

      {/* Background pattern & decorative elements */}
      {!bgImage && (
      <div className="fixed inset-0 pointer-events-none">
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        {/* Gradient blobs */}
        <div className="absolute -top-24 -right-24 w-[500px] h-[500px] bg-indigo-400/15 dark:bg-indigo-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute top-1/2 -left-32 w-[400px] h-[400px] bg-violet-400/15 dark:bg-violet-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '10s' }} />
        <div className="absolute -bottom-20 right-1/4 w-[350px] h-[350px] bg-blue-400/10 dark:bg-blue-500/8 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '12s' }} />
        {/* Decorative shapes */}
        <div className="absolute top-[15%] left-[10%] w-16 h-16 border border-indigo-200/40 dark:border-indigo-700/20 rounded-lg rotate-12" />
        <div className="absolute bottom-[20%] right-[15%] w-20 h-20 border border-purple-200/30 dark:border-purple-700/15 rounded-full" />
        <div className="absolute top-[60%] left-[5%] w-12 h-12 border border-blue-200/30 dark:border-blue-700/15 rounded-lg -rotate-6" />
        <div className="absolute top-[10%] right-[25%] w-8 h-8 bg-indigo-300/10 dark:bg-indigo-600/10 rounded-full" />
        <div className="absolute bottom-[35%] left-[20%] w-6 h-6 bg-violet-300/15 dark:bg-violet-600/10 rounded-full" />
      </div>
      )}

      <div className="w-full max-w-sm relative z-10">
        {/* Logo & Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <TodayLogo size={56} />
          </div>
          <h1 className={`text-2xl font-bold tracking-tight ${bgImage ? 'text-white drop-shadow-md' : 'text-foreground'}`}>
            TODAY
          </h1>
          <p className={`text-sm mt-1 ${bgImage ? 'text-white/80 drop-shadow-sm' : 'text-muted-foreground'}`}>
            Система управления образованием
          </p>
          <QuoteOfTheDay hasBg={!!bgImage} />
        </div>

        {/* Last Login Prompt */}
        {lastLogin && showLastLogin && (
          <div className="mb-5 rounded-xl border bg-card/80 backdrop-blur-sm p-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{lastLogin.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {ROLE_LABELS[lastLogin.role] || lastLogin.role} · {timeAgo(lastLogin.timestamp)}
                  </p>
                </div>
              </div>
              <button
                onClick={handleDismissLastLogin}
                className="text-muted-foreground/60 hover:text-muted-foreground transition-colors shrink-0 mt-0.5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Последний вход с этого аккаунта. Введите пароль для входа.
            </p>
          </div>
        )}

        {/* Login Form */}
        <div className="rounded-xl border bg-card/80 backdrop-blur-sm shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3 animate-in fade-in duration-200">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name.surname@today.edu"
                disabled={loading}
                className="h-12 bg-background/50 text-base"
                autoComplete="email"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Пароль
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  ref={passwordRef}
                  className="h-12 bg-background/50 pr-10 text-base"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
              disabled={loading || !email || !password}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Вход...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="h-4 w-4" />
                  Войти
                </span>
              )}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => { setForgotEmail(email); setShowForgot(true); }}
            className="w-full text-center text-xs text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors mt-3"
          >
            Забыл пароль?
          </button>
        </div>

        {/* Footer */}
        <p className={`text-center text-xs mt-6 ${bgImage ? 'text-white/60 drop-shadow-sm' : 'text-muted-foreground/60'}`}>
          TODAY Education Center © {new Date().getFullYear()}
        </p>
      </div>

      {/* Background image picker — bottom-right */}
      <div className="fixed bottom-4 right-4 z-20">
        {bgPickerOpen && (
          <div className="mb-2 bg-card/95 backdrop-blur-md border rounded-xl shadow-xl p-3 w-72 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <p className="text-xs font-medium text-muted-foreground mb-2">Фон страницы входа</p>
            <div className="grid grid-cols-4 gap-1.5 mb-2">
              {/* No background option */}
              <button
                onClick={() => selectBg(null)}
                className={`aspect-square rounded-lg border-2 flex items-center justify-center text-xs transition-all ${!bgImage ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950' : 'border-muted hover:border-foreground/30'}`}
              >
                {!bgImage ? <Check className="h-4 w-4 text-indigo-600" /> : <X className="h-3.5 w-3.5 text-muted-foreground" />}
              </button>
              {BG_PRESETS.map((url, i) => (
                <button
                  key={i}
                  onClick={() => selectBg(url)}
                  className={`aspect-square rounded-lg border-2 overflow-hidden transition-all ${bgImage === url ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-muted hover:border-foreground/30'}`}
                >
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <Input
                value={customUrl}
                onChange={e => setCustomUrl(e.target.value)}
                placeholder="Ссылка на изображение..."
                className="h-7 text-xs"
              />
              <Button size="sm" variant="outline" className="h-7 px-2 shrink-0" disabled={!customUrl.trim()}
                onClick={() => selectBg(customUrl.trim())}>
                <Link className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-full bg-card/80 backdrop-blur-sm shadow-md border"
          onClick={() => setBgPickerOpen(!bgPickerOpen)}
        >
          {bgPickerOpen ? <ChevronUp className="h-4 w-4" /> : <Image className="h-4 w-4" />}
        </Button>
      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={showForgot} onOpenChange={setShowForgot}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Забыли пароль?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Введите ваш email. Запрос на сброс пароля будет отправлен администратору.
          </p>
          <Input
            type="email"
            value={forgotEmail}
            onChange={e => setForgotEmail(e.target.value)}
            placeholder="name@today.edu"
            className="h-10"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForgot(false)}>Отмена</Button>
            <Button onClick={handleForgotPassword} disabled={!forgotEmail || forgotLoading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {forgotLoading ? "Отправка..." : "Отправить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Quote of the Day ── */

const QUOTES = [
  { text: "Образование — это самое мощное оружие, которое вы можете использовать, чтобы изменить мир.", author: "Нельсон Мандела" },
  { text: "Учитесь так, словно вы постоянно ощущаете нехватку своих знаний.", author: "Конфуций" },
  { text: "Если мы учим сегодня так, как учили вчера, мы крадём у наших детей завтра.", author: "Джон Дьюи" },
  { text: "Живи так, будто завтра умрёшь. Учись так, будто будешь жить вечно.", author: "Махатма Ганди" },
  { text: "Инвестиции в знания приносят наибольший доход.", author: "Бенджамин Франклин" },
  { text: "Кто владеет информацией — тот владеет миром.", author: "Натан Ротшильд" },
  { text: "Каждый день — это шанс стать лучше, чем вчера.", author: "TODAY" },
  { text: "Дисциплина — мост между целями и достижениями.", author: "Джим Рон" },
  { text: "Не ошибается тот, кто ничего не делает.", author: "Теодор Рузвельт" },
  { text: "Будущее принадлежит тем, кто верит в красоту своей мечты.", author: "Элеонора Рузвельт" },
  { text: "Великие дела складываются не из силы, а из упорства.", author: "Сэмюэл Джонсон" },
  { text: "Образование — пропуск в будущее, ибо завтра принадлежит тем, кто готовится к нему сегодня.", author: "Малкольм Икс" },
  { text: "Успех — это не конец, неудача — не приговор. Значение имеет лишь мужество продолжать.", author: "Уинстон Черчилль" },
  { text: "Учитель влияет на вечность: он никогда не знает, где заканчивается его влияние.", author: "Генри Адамс" },
  { text: "Секрет успеха в том, чтобы начать.", author: "Марк Твен" },
  { text: "Труд — это не наказание. Труд — это возможность.", author: "Генри Форд" },
];

function QuoteOfTheDay({ hasBg = false }: { hasBg?: boolean }) {
  const today = new Date();
  const dayIndex = (today.getFullYear() * 366 + today.getMonth() * 31 + today.getDate()) % QUOTES.length;
  const q = QUOTES[dayIndex];
  return (
    <div className="mt-3 px-3">
      <p className={`text-xs italic leading-relaxed ${hasBg ? 'text-white/70 drop-shadow-sm' : 'text-muted-foreground/70'}`}>
        «{q.text}»
      </p>
      <p className={`text-[10px] mt-1 ${hasBg ? 'text-white/50' : 'text-muted-foreground/50'}`}>— {q.author}</p>
    </div>
  );
}
