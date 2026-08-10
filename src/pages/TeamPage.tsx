import { UsersRound, Star, Mail, Phone, Camera } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/UserAvatar";
import { fetchUsers, uploadAvatar } from "@/lib/api";
import { useState, useEffect, useRef } from "react";

const ROLE_LABELS: Record<string, string> = {
  admin: "Администратор",
  umo_head: "Начальник УМО",
  teacher: "Преподаватель",
};

export default function TeamPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchUsers().then(setUsers);
  }, []);

  const handleAvatarClick = (id: number) => {
    setUploadingId(id);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !uploadingId) return;
    const file = e.target.files[0];
    
    try {
      const res = await uploadAvatar(uploadingId, file);
      if (res && res.user) {
        setUsers(users.map(u => u.id === uploadingId ? { ...u, avatar_url: res.user.avatar_url } : u));
      }
    } catch (err) {
      console.error("Failed to upload avatar", err);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
      setUploadingId(null);
    }
  };

  return (
    <div>
      <input 
        type="file" 
        accept="image/jpeg, image/png, image/webp" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
      />
      <div className="flex items-center gap-3 mb-4 md:mb-6">
        <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <UsersRound className="h-4 w-4 md:h-5 md:w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg md:text-2xl font-heading font-bold text-foreground">Команда</h1>
          <p className="text-sm text-muted-foreground">{users.length} сотрудников</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {users.map((u) => (
          <Card key={u.id} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <div 
                  className="relative cursor-pointer group rounded-full"
                  onClick={() => handleAvatarClick(u.id)}
                >
                  <UserAvatar user={u} size="lg" />
                  <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">{u.name} {u.surname}</p>
                  <Badge variant="secondary" className="text-[10px] mt-1">
                    {ROLE_LABELS[u.role] || u.role}
                  </Badge>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                {u.email && (
                  <div className="flex items-center gap-1.5 truncate">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate">{u.email}</span>
                  </div>
                )}
                {u.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3 shrink-0" />
                    <span>{u.phone}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
