import { Settings, Save, Eye, EyeOff, KeyRound, User, Phone, Mail, Camera, Trash2, Paintbrush } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useEffect, useState, useRef, useCallback } from "react";
import { fetchUser, updateUser, uploadAvatar, deleteAvatar } from "@/lib/api";
import { UserAvatar } from "@/components/UserAvatar";
import { formatPhone } from "@/lib/utils";
import {
  applyCrmBackground,
  clearCrmBackgroundImageUrl,
  getCrmBackground,
  getCrmBackgroundImageUrl,
  setCrmBackground,
  setCrmBackgroundImageUrl,
  type CrmBackground,
} from "@/lib/background";
import { applyCrmStyle, getCrmStyle, setCrmStyle, type CrmStyle } from "@/lib/style";
import { useTheme } from "@/components/ThemeProvider";
import { useTranslation } from "react-i18next";

const ROLE_LABELS: Record<string, string> = {
  admin: "Администратор",
  umo_head: "Начальник УМО",
  teacher: "Преподаватель",
};

export default function SettingsPage() {
  const { user, updateAvatar } = useAuth();
  const { theme, setTheme } = useTheme();
  const { i18n } = useTranslation();
  const [profile, setProfile] = useState<any>(null);
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [phone, setPhone] = useState("");
  const [background, setBackground] = useState<CrmBackground>(() => getCrmBackground());
  const [backgroundImageUrl, setBackgroundImageUrl] = useState(() => getCrmBackgroundImageUrl());
  const [style, setStyle] = useState<CrmStyle>(() => getCrmStyle());
  const [saving, setSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUser(user.id).then((data) => {
        if (data) {
          setProfile(data);
          setName(data.name || "");
          setSurname(data.surname || "");
          setPhone(data.phone ? formatPhone(data.phone) : "");
        }
      });
    }
  }, [user]);

  useEffect(() => {
    applyCrmBackground(background);
  }, [background]);

  useEffect(() => {
    applyCrmStyle(style);
  }, [style]);

  const handleSaveProfile = async () => {
    if (!user || !name.trim() || !surname.trim()) {
      toast.error("Имя и фамилия обязательны");
      return;
    }
    setSaving(true);
    try {
      await updateUser(parseInt(user.id), { name: name.trim(), surname: surname.trim(), phone: phone.trim() || null });
      toast.success("Профиль обновлён");
    } catch {
      toast.error("Ошибка при сохранении");
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (!user) return;
    if (!currentPassword) {
      toast.error("Введите текущий пароль");
      return;
    }
    if (newPassword.length < 4) {
      toast.error("Новый пароль должен быть не менее 4 символов");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Пароли не совпадают");
      return;
    }
    setChangingPw(true);
    try {
      await updateUser(parseInt(user.id), { current_password: currentPassword, password: newPassword });
      toast.success("Пароль изменён");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      const msg = err.message || "";
      if (msg.includes("неверный") || msg.includes("Текущий")) {
        toast.error("Текущий пароль неверный");
      } else {
        toast.error("Ошибка при смене пароля");
      }
    }
    setChangingPw(false);
  };

  const handleAvatarSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Только JPEG, PNG или WebP");
      return;
    }
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleAvatarUpload = async () => {
    if (!user || !avatarFile) return;
    setUploadingAvatar(true);
    try {
      const result = await uploadAvatar(user.id, avatarFile);
      updateAvatar(result.avatar_url);
      setProfile((p: any) => p ? { ...p, avatar_url: result.avatar_url } : p);
      setAvatarFile(null);
      setAvatarPreview(null);
      toast.success("Фото профиля обновлено");
    } catch {
      toast.error("Ошибка загрузки фото");
    }
    setUploadingAvatar(false);
  };

  const handleAvatarDelete = async () => {
    if (!user) return;
    setUploadingAvatar(true);
    try {
      await deleteAvatar(user.id);
      updateAvatar(null);
      setProfile((p: any) => p ? { ...p, avatar_url: null } : p);
      setAvatarFile(null);
      setAvatarPreview(null);
      toast.success("Фото удалено");
    } catch {
      toast.error("Ошибка удаления фото");
    }
    setUploadingAvatar(false);
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Settings className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Настройки</h1>
          <p className="text-sm text-muted-foreground">Управление профилем</p>
        </div>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="w-full justify-between">
          <TabsTrigger value="profile" className="flex-1">Профиль</TabsTrigger>
          <TabsTrigger value="security" className="flex-1">Безопасность</TabsTrigger>
          <TabsTrigger value="appearance" className="flex-1">Оформление</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" />
                Личные данные
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative group shrink-0">
                  {avatarPreview ? (
                    <div className="h-16 w-16 rounded-full overflow-hidden border-2 border-primary/30">
                      <img src={avatarPreview} alt="Preview" className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <UserAvatar
                      user={{ ...profile, full_name: user?.full_name, avatar_url: profile?.avatar_url }}
                      size="lg"
                      className="h-16 w-16 text-lg"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => avatarRef.current?.click()}
                    className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                  >
                    <Camera className="h-4 w-4 text-white" />
                  </button>
                  <input
                    ref={avatarRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleAvatarSelect}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.full_name}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {avatarFile ? (
                      <>
                        <Button size="sm" className="h-8 text-xs gap-1" onClick={handleAvatarUpload} disabled={uploadingAvatar}>
                          <Save className="h-3 w-3" />
                          {uploadingAvatar ? "Загрузка..." : "Сохранить фото"}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setAvatarFile(null); setAvatarPreview(null); }}>
                          Отмена
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => avatarRef.current?.click()}>
                          <Camera className="h-3 w-3" />
                          Загрузить фото
                        </Button>
                        {(profile?.avatar_url || user?.avatar_url) && (
                          <Button size="sm" variant="ghost" className="h-8 text-xs gap-1 text-destructive hover:text-destructive" onClick={handleAvatarDelete} disabled={uploadingAvatar}>
                            <Trash2 className="h-3 w-3" />
                            Удалить
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Имя</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Фамилия</Label>
                  <Input value={surname} onChange={(e) => setSurname(e.target.value)} placeholder="Фамилия" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Phone className="h-3 w-3" />Телефон
                  </Label>
                  <Input value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="+7 (___) ___-__-__" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Mail className="h-3 w-3" />Email
                  </Label>
                  <Input value={profile?.email || user?.email || ""} disabled className="bg-muted/50" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Роль</Label>
                  <Input value={ROLE_LABELS[user?.role || ""] || user?.role || ""} disabled className="bg-muted/50" />
                </div>
                <div className="hidden sm:block" />
              </div>

              <Button onClick={handleSaveProfile} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? "Сохранение..." : "Сохранить"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="h-4 w-4" />
                Смена пароля
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Текущий пароль</Label>
                <div className="relative">
                  <Input
                    type={showCurrentPw ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Введите текущий пароль"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground"
                    tabIndex={-1}
                  >
                    {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Separator />

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Новый пароль</Label>
                <div className="relative">
                  <Input
                    type={showNewPw ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Минимум 4 символа"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground"
                    tabIndex={-1}
                  >
                    {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Подтвердите пароль</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Повторите новый пароль"
                />
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-destructive">Пароли не совпадают</p>
                )}
              </div>

              <Button
                onClick={handleChangePassword}
                disabled={changingPw || !currentPassword || !newPassword || newPassword !== confirmPassword}
                variant="outline"
                className="gap-2"
              >
                <KeyRound className="h-4 w-4" />
                {changingPw ? "Сохранение..." : "Изменить пароль"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Paintbrush className="h-4 w-4" />
                Оформление
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Тема</Label>
                  <Select value={theme} onValueChange={(v) => setTheme(v as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите тему" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Светлая</SelectItem>
                      <SelectItem value="dark">Тёмная</SelectItem>
                      <SelectItem value="system">Система</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Язык</Label>
                  <Select
                    value={i18n.language}
                    onValueChange={(lang) => {
                      i18n.changeLanguage(lang);
                      localStorage.setItem("language", lang);
                      toast.success("Язык обновлён");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите язык" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ru">Русский</SelectItem>
                      <SelectItem value="kk">Қазақша</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Фон приложения</Label>
                <Select
                  value={background}
                  onValueChange={(value) => {
                    const next = value as CrmBackground;
                    setBackground(next);
                    setCrmBackground(next);
                    applyCrmBackground(next);
                    toast.success("Фон обновлён");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите фон" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solid">По умолчанию</SelectItem>
                    <SelectItem value="dots">Точки</SelectItem>
                    <SelectItem value="grid">Сетка</SelectItem>
                    <SelectItem value="stripes">Диагональные линии</SelectItem>
                    <SelectItem value="crosshatch">Крест-штриховка</SelectItem>
                    <SelectItem value="rings">Кольца</SelectItem>
                    <SelectItem value="gradient">Мягкий градиент</SelectItem>
                    <SelectItem value="microdots">Мелкие точки</SelectItem>
                    <SelectItem value="macrodots">Крупные точки</SelectItem>
                    <SelectItem value="diagonal-grid">Диагональная сетка</SelectItem>
                    <SelectItem value="isometric">Изометрия</SelectItem>
                    <SelectItem value="checker">Шахматка</SelectItem>
                    <SelectItem value="confetti">Конфетти</SelectItem>
                    <SelectItem value="paper">Бумага</SelectItem>
                    <SelectItem value="waves">Волны</SelectItem>
                    <SelectItem value="sunburst">Лучики</SelectItem>
                    <SelectItem value="topo">Топография</SelectItem>
                    <SelectItem value="image">Картинка (по ссылке)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Сохраняется на этом устройстве и применяется сразу.</p>
              </div>

              {background === "image" && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Картинка фона (URL)</Label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      value={backgroundImageUrl}
                      onChange={(e) => setBackgroundImageUrl(e.target.value)}
                      placeholder="https://..."
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const value = backgroundImageUrl.trim();
                          if (!value) {
                            toast.error("Вставьте ссылку на картинку");
                            return;
                          }
                          try {
                            const parsed = new URL(value);
                            if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
                              toast.error("Только http/https ссылки");
                              return;
                            }
                            setCrmBackgroundImageUrl(value);
                            setBackground("image");
                            setCrmBackground("image");
                            applyCrmBackground("image");
                            toast.success("Картинка фона применена");
                          } catch {
                            toast.error("Некорректная ссылка");
                          }
                        }}
                      >
                        Применить
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          clearCrmBackgroundImageUrl();
                          setBackgroundImageUrl("");
                          setBackground("solid");
                          setCrmBackground("solid");
                          applyCrmBackground("solid");
                          toast.success("Картинка фона очищена");
                        }}
                      >
                        Очистить
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Картинка ставится как cover и затемняется цветом темы.</p>
                </div>
              )}

              <Separator />

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Стиль</Label>
                <Select
                  value={style}
                  onValueChange={(value) => {
                    const next = value as CrmStyle;
                    setStyle(next);
                    setCrmStyle(next);
                    applyCrmStyle(next);
                    toast.success("Стиль обновлён");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите стиль" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default</SelectItem>
                    <SelectItem value="vibrant">Яркий</SelectItem>
                    <SelectItem value="primary-accent">Акцент: основной</SelectItem>
                    <SelectItem value="neutral-accent">Акцент: нейтральный</SelectItem>
                    <SelectItem value="contrast">Контрастный</SelectItem>
                    <SelectItem value="rounded">Более круглый</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Меняет акцентные подсветки и выделения.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
