export type CrmBackground =
  | "solid"
  | "dots"
  | "grid"
  | "stripes"
  | "crosshatch"
  | "rings"
  | "gradient"
  | "microdots"
  | "macrodots"
  | "diagonal-grid"
  | "isometric"
  | "checker"
  | "confetti"
  | "paper"
  | "waves"
  | "sunburst"
  | "topo"
  | "image";

const STORAGE_KEY = "today_crm_background";
const IMAGE_URL_KEY = "today_crm_background_image_url";

const CLASS_BY_BACKGROUND: Record<CrmBackground, string> = {
  solid: "crm-bg-solid",
  dots: "crm-bg-dots",
  grid: "crm-bg-grid",
  stripes: "crm-bg-stripes",
  crosshatch: "crm-bg-crosshatch",
  rings: "crm-bg-rings",
  gradient: "crm-bg-gradient",
  microdots: "crm-bg-microdots",
  macrodots: "crm-bg-macrodots",
  "diagonal-grid": "crm-bg-diagonal-grid",
  isometric: "crm-bg-isometric",
  checker: "crm-bg-checker",
  confetti: "crm-bg-confetti",
  paper: "crm-bg-paper",
  waves: "crm-bg-waves",
  sunburst: "crm-bg-sunburst",
  topo: "crm-bg-topo",
  image: "crm-bg-image",
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
      raw === "gradient" ||
      raw === "microdots" ||
      raw === "macrodots" ||
      raw === "diagonal-grid" ||
      raw === "isometric" ||
      raw === "checker" ||
      raw === "confetti" ||
      raw === "paper" ||
      raw === "waves" ||
      raw === "sunburst" ||
      raw === "topo" ||
      raw === "image"
    ) {
      return raw;
    }
  } catch {
    // ignore
  }
  return "solid";
}

export function getCrmBackgroundImageUrl(): string {
  try {
    return localStorage.getItem(IMAGE_URL_KEY) || "";
  } catch {
    return "";
  }
}

export function setCrmBackgroundImageUrl(url: string) {
  try {
    localStorage.setItem(IMAGE_URL_KEY, url);
  } catch {
    // ignore
  }
}

export function clearCrmBackgroundImageUrl() {
  try {
    localStorage.removeItem(IMAGE_URL_KEY);
  } catch {
    // ignore
  }
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

  if (background === "image") {
    const url = getCrmBackgroundImageUrl();
    if (url) {
      body.style.setProperty("--crm-bg-image", `url(\"${url.replace(/\"/g, "\\\"")}\")`);
    } else {
      body.style.removeProperty("--crm-bg-image");
    }
  } else {
    body.style.removeProperty("--crm-bg-image");
  }
}
