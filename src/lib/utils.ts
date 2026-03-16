import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format any phone string to +7 (XXX) XXX-XX-XX on the fly */
export function formatPhone(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (!digits) return "";

  // Kazakhstan convention: leading 8 → 7
  if (digits.startsWith("8")) {
    digits = "7" + digits.slice(1);
  }

  // 10 digits without country code → prepend 7
  if (digits.length === 10) {
    digits = "7" + digits;
  }

  digits = digits.slice(0, 11);
  const r = digits.slice(1); // subscriber part after country code

  if (r.length === 0) return "+7";
  if (r.length <= 3) return `+7 (${r}`;
  if (r.length <= 6) return `+7 (${r.slice(0, 3)}) ${r.slice(3)}`;
  if (r.length <= 8) return `+7 (${r.slice(0, 3)}) ${r.slice(3, 6)}-${r.slice(6)}`;
  return `+7 (${r.slice(0, 3)}) ${r.slice(3, 6)}-${r.slice(6, 8)}-${r.slice(8)}`;
}
