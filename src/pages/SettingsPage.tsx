import { Settings, Save, Eye, EyeOff, KeyRound, User, Phone, Mail, Camera, Trash2, Paintbrush } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useEffect, useState, useRef, useCallback } from "react";
import { fetchUser, updateUser, uploadAvatar, deleteAvatar } from "@/lib/api";
import { UserAvatar } from "@/components/UserAvatar";
import { formatPhone } from "@/lib/utils";
import { applyCrmBackground, getCrmBackground, setCrmBackground, type CrmBackground } from "@/lib/background";
import { applyCrmStyle, getCrmStyle, setCrmStyle, type CrmStyle } from "@/lib/style";

const ROLE_LABELS: Record<string, string> = {
  admin: "Администратор",
  umo_head: "Начальник УМО",
  teacher: "Преподаватель",
};

export default function SettingsPage() {
  const { user, updateAvatar } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [phone, setPhone] = useState("");
  const [background, setBackground] = useState<CrmBackground>(() => getCrmBackground());
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

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            Личные данные
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Avatar Section */}
          <div className="flex items-center gap-5">
            <div className="relative group">
              {avatarPreview ? (
                <div className="h-20 w-20 rounded-full overflow-hidden border-2 border-primary/30">
                  <img src={avatarPreview} alt="Preview" className="h-full w-full object-cover" />
                </div>
              ) : (
                <UserAvatar
                  user={{ ...profile, full_name: user?.full_name, avatar_url: profile?.avatar_url }}
                  size="lg"
                  className="h-20 w-20 text-xl"
                />
              )}
              <button
                type="button"
                onClick={() => avatarRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
              >
                <Camera className="h-5 w-5 text-white" />
              </button>
              <input
                ref={avatarRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarSelect}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">{user?.full_name}</p>
              <div className="flex gap-2">
                {avatarFile ? (
                  <>
                    <Button size="sm" className="h-7 text-xs gap-1" onClick={handleAvatarUpload} disabled={uploadingAvatar}>
                      <Save className="h-3 w-3" />
                      {uploadingAvatar ? "Загрузка..." : "Сохранить фото"}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setAvatarFile(null); setAvatarPreview(null); }}>
                      Отмена
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => avatarRef.current?.click()}>
                      <Camera className="h-3 w-3" />
                      Загрузить фото
                    </Button>
                    {(profile?.avatar_url || user?.avatar_url) && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" onClick={handleAvatarDelete} disabled={uploadingAvatar}>
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
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Имя"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Фамилия</Label>
              <Input
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
                placeholder="Фамилия"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Phone className="h-3 w-3" />Телефон
            </Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="+7 (___) ___-__-__"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Mail className="h-3 w-3" />Email
            </Label>
            <Input value={profile?.email || user?.email || ""} disabled className="bg-muted/50" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Роль</Label>
            <Input value={ROLE_LABELS[user?.role || ""] || user?.role || ""} disabled className="bg-muted/50" />
          </div>

          <Button onClick={handleSaveProfile} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Сохранение..." : "Сохранить"}
          </Button>
        </CardContent>
      </Card>

      {/* Password Card */}
      <Card className="mt-6">
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

      {/* Appearance Card */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Paintbrush className="h-4 w-4" />
            Оформление
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
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
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Сохраняется на этом устройстве и применяется сразу.</p>
          </div>

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
    </div>
  );
}
