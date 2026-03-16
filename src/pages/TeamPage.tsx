import { UsersRound, Star, Mail, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/UserAvatar";
import { fetchUsers } from "@/lib/api";
import { useState, useEffect } from "react";

const ROLE_LABELS: Record<string, string> = {
  admin: "Администратор",
  umo_head: "Начальник УМО",
  teacher: "Преподаватель",
};

export default function TeamPage() {
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    fetchUsers().then(setUsers);
  }, []);

  return (
    <div>
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
                <UserAvatar user={u} size="lg" />
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
