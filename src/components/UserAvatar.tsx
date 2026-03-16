import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

/* ── Identicon generation (GitHub-style 5×5 symmetric pattern) ── */

function hashDJB2(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function hashFNV(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return Math.abs(h);
}

function generateIdenticonUrl(name: string): string {
  const gridHash = hashDJB2(name);
  const colorHash = hashFNV(name);

  const hue = colorHash % 360;
  const sat = 55 + ((colorHash >> 9) % 20);
  const lum = 40 + ((colorHash >> 14) % 15);
  const fg = `hsl(${hue},${sat}%,${lum}%)`;
  const bg = `hsl(${hue},${sat}%,92%)`;

  let rects = `<rect width="5" height="5" fill="${bg}"/>`;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      if ((gridHash >> (row * 3 + col)) & 1) {
        rects += `<rect x="${col}" y="${row}" width="1" height="1" fill="${fg}"/>`;
        if (col < 2) {
          rects += `<rect x="${4 - col}" y="${row}" width="1" height="1" fill="${fg}"/>`;
        }
      }
    }
  }

  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 5">${rects}</svg>`
  )}`;
}

/* ── Helpers ── */

function getInitials(name?: string, surname?: string, fullName?: string): string {
  if (name && surname) return (name[0] + surname[0]).toUpperCase();
  if (fullName) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (parts[0]?.[0] || "?").toUpperCase();
  }
  return "?";
}

interface UserAvatarProps {
  user?: {
    id?: number | string;
    name?: string;
    surname?: string;
    full_name?: string;
    avatar_url?: string | null;
  } | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const SIZE_MAP = {
  xs: "h-6 w-6 min-w-[1.5rem] text-[10px]",
  sm: "h-8 w-8 min-w-[2rem] text-xs",
  md: "h-10 w-10 min-w-[2.5rem] text-sm",
  lg: "h-16 w-16 min-w-[4rem] text-lg",
};

export function UserAvatar({ user, size = "md", className }: UserAvatarProps) {
  const initials = getInitials(user?.name, user?.surname, user?.full_name);
  const sizeClass = SIZE_MAP[size];
  const avatarUrl = user?.avatar_url
    ? (user.avatar_url.startsWith("http") ? user.avatar_url : `http://localhost:3001${user.avatar_url}`)
    : null;

  const identiconUrl = useMemo(() => {
    if (avatarUrl) return null;
    const n = user?.name || user?.full_name || user?.surname || "";
    return n ? generateIdenticonUrl(n) : null;
  }, [avatarUrl, user?.name, user?.full_name, user?.surname]);

  return (
    <Avatar className={cn(sizeClass, className)}>
      {(avatarUrl || identiconUrl) && (
        <AvatarImage src={(avatarUrl || identiconUrl)!} alt={initials} />
      )}
      <AvatarFallback className={cn(sizeClass, "bg-muted text-muted-foreground font-semibold")}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
