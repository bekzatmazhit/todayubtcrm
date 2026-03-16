export type CrmStyle =
  | "default"
  | "vibrant"
  | "primary-accent"
  | "neutral-accent"
  | "contrast"
  | "rounded";

const STORAGE_KEY = "today_crm_style";

const CLASS_BY_STYLE: Record<CrmStyle, string | null> = {
  default: null,
  vibrant: "crm-style-vibrant",
  "primary-accent": "crm-style-primary-accent",
  "neutral-accent": "crm-style-neutral-accent",
  contrast: "crm-style-contrast",
  rounded: "crm-style-rounded",
};

const ALL_STYLE_CLASSES = Object.values(CLASS_BY_STYLE).filter(Boolean) as string[];

export function getCrmStyle(): CrmStyle {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (
      raw === "default" ||
      raw === "vibrant" ||
      raw === "primary-accent" ||
      raw === "neutral-accent" ||
      raw === "contrast" ||
      raw === "rounded"
    ) {
      return raw;
    }
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
