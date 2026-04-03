import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const LOCALE_MAP: Record<string, string> = { ru: "ru-RU", kk: "kk-KZ", en: "en-US" };

function getRelative(date: Date, locale: string): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const days = Math.floor(hr / 24);

  if (sec < 60) return "только что";
  if (min < 60) return `${min} мин. назад`;
  if (hr < 24) return `${hr} ч. назад`;
  if (days === 1) return "Вчера";
  if (days < 7) return `${days} дн. назад`;
  if (days < 30) {
    const w = Math.floor(days / 7);
    return `${w} нед. назад`;
  }
  if (days < 365) {
    const m = Math.floor(days / 30);
    return `${m} мес. назад`;
  }
  return date.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

function formatExact(date: Date, locale: string): string {
  return date.toLocaleString(locale, {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

interface Props {
  date: string | Date;
  className?: string;
}

export function RelativeTime({ date, className }: Props) {
  const { i18n } = useTranslation();
  const locale = LOCALE_MAP[i18n.language] ?? "ru-RU";
  const parsed = date instanceof Date ? date : new Date(date);
  const [text, setText] = useState(() => getRelative(parsed, locale));

  useEffect(() => {
    setText(getRelative(parsed, locale));
    const id = setInterval(() => setText(getRelative(parsed, locale)), 60_000);
    return () => clearInterval(id);
  }, [parsed.getTime(), locale]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={className} style={{ cursor: "default" }}>{text}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {formatExact(parsed, locale)}
      </TooltipContent>
    </Tooltip>
  );
}
