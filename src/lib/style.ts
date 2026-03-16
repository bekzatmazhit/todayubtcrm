export type CrmStyle = "default" | "primary-accent" | "neutral-accent";

const STORAGE_KEY = "today_crm_style";

const CLASS_BY_STYLE: Record<CrmStyle, string | null> = {
  default: null,
  "primary-accent": "crm-style-primary-accent",
  "neutral-accent": "crm-style-neutral-accent",
};

const ALL_STYLE_CLASSES = Object.values(CLASS_BY_STYLE).filter(Boolean) as string[];

export function getCrmStyle(): CrmStyle {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "default" || raw === "primary-accent" || raw === "neutral-accent") return raw;
  } catch {
    // ignore
  }
  return "default";
}

export function setCrmStyle(style: CrmStyle) {
  try {
    localStorage.setItem(STORAGE_KEY, style);
  } catch {
    // ignore
  }
}

export function applyCrmStyle(style: CrmStyle) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (!root) return;

  root.classList.remove(...ALL_STYLE_CLASSES);
  const nextClass = CLASS_BY_STYLE[style];
  if (nextClass) root.classList.add(nextClass);
}
