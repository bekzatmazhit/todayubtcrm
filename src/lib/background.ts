export type CrmBackground = "solid" | "dots" | "grid" | "stripes" | "crosshatch" | "rings" | "gradient";

const STORAGE_KEY = "today_crm_background";

const CLASS_BY_BACKGROUND: Record<CrmBackground, string> = {
  solid: "crm-bg-solid",
  dots: "crm-bg-dots",
  grid: "crm-bg-grid",
  stripes: "crm-bg-stripes",
  crosshatch: "crm-bg-crosshatch",
  rings: "crm-bg-rings",
  gradient: "crm-bg-gradient",
};

const ALL_BACKGROUND_CLASSES = Object.values(CLASS_BY_BACKGROUND);

export function getCrmBackground(): CrmBackground {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (
      raw === "solid" ||
      raw === "dots" ||
      raw === "grid" ||
      raw === "stripes" ||
      raw === "crosshatch" ||
      raw === "rings" ||
      raw === "gradient"
    ) {
      return raw;
    }
  } catch {
    // ignore
  }
  return "solid";
}

export function setCrmBackground(background: CrmBackground) {
  try {
    localStorage.setItem(STORAGE_KEY, background);
  } catch {
    // ignore
  }
}

export function applyCrmBackground(background: CrmBackground) {
  if (typeof document === "undefined") return;
  const body = document.body;
  if (!body) return;

  body.classList.remove(...ALL_BACKGROUND_CLASSES);
  body.classList.add(CLASS_BY_BACKGROUND[background]);
}
