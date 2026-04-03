import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Group person avatar mapping ─────────────────────────────────────────────
import imgFarabi from "@/assets/group-logos/аль-фараби.jpg";
import imgKunanbayev from "@/assets/group-logos/кунанбаев.png";
import imgBaitursynov from "@/assets/group-logos/байтурсынов.jpg";
import imgAltynSarin from "@/assets/group-logos/алтынсарин.jpg";
import imgUalikhanov from "@/assets/group-logos/уалиханов.jpg";
import imgSatpayev from "@/assets/group-logos/сатпаев.jpg";
import imgAsfendiyarov from "@/assets/group-logos/асфендияров.png";
import imgBokeykhanov from "@/assets/group-logos/бокейханов.jpg";
import imgSeifullin from "@/assets/group-logos/сейфуллин.jpg";
import imgZhumabayev from "@/assets/group-logos/жумабаев.jpg";
import imgKonayev from "@/assets/group-logos/конаев.png";
import imgAitkhozhyn from "@/assets/group-logos/айтхожин.jpg";

export interface GroupPersonData {
  personName: string;
  initials: string;
  color: string;
  url: string;
}

const GROUP_PERSON_MAP: { keys: string[]; data: GroupPersonData }[] = [
  {
    keys: ["аль-фараби", "al-farabi", "alpharabi", "фараби", "farabi"],
    data: { personName: "Аль-Фараби", initials: "АФ", color: "#7c3aed", url: imgFarabi },
  },
  {
    keys: ["абай", "abai", "abay", "кунанбай", "кунанбаев"],
    data: { personName: "Абай Құнанбайұлы", initials: "АК", color: "#1d4ed8", url: imgKunanbayev },
  },
  {
    keys: ["байтурсын", "baitursynov", "байтурсынов"],
    data: { personName: "Ахмет Байтұрсынов", initials: "АБ", color: "#b45309", url: imgBaitursynov },
  },
  {
    keys: ["алтынсарин", "altynсарин", "altynssarin", "ыбырай"],
    data: { personName: "Ыбырай Алтынсарин", initials: "ЫА", color: "#0f766e", url: imgAltynSarin },
  },
  {
    keys: ["уалиханов", "валиханов", "шоқан", "чокан", "valikhanov", "chokan"],
    data: { personName: "Шоқан Уәлиханов", initials: "ШУ", color: "#1e3a5f", url: imgUalikhanov },
  },
  {
    keys: ["сатпаев", "satpayev", "қаныш", "каныш"],
    data: { personName: "Қаныш Сәтпаев", initials: "ҚС", color: "#166534", url: imgSatpayev },
  },
  {
    keys: ["асфендияров", "asfendiyarov", "санжар"],
    data: { personName: "Санжар Асфендияров", initials: "СА", color: "#7c2d12", url: imgAsfendiyarov },
  },
  {
    keys: ["бокейханов", "bokeykhanov", "бөкейхан", "алихан"],
    data: { personName: "Әлихан Бөкейханов", initials: "ӘБ", color: "#1e40af", url: imgBokeykhanov },
  },
  {
    keys: ["сейфуллин", "seifullin", "сакен"],
    data: { personName: "Сакен Сейфуллин", initials: "СС", color: "#831843", url: imgSeifullin },
  },
  {
    keys: ["жумабаев", "zhumabayev", "мағжан", "магжан"],
    data: { personName: "Мағжан Жұмабаев", initials: "МЖ", color: "#78350f", url: imgZhumabayev },
  },
  {
    keys: ["конаев", "қонаев", "konayev", "динмухамед", "димаш"],
    data: { personName: "Дінмұхамед Қонаев", initials: "ДҚ", color: "#134e4a", url: imgKonayev },
  },
  {
    keys: ["айтхожин", "aitkhozhyn", "мурат"],
    data: { personName: "Мұрат Айтхожин", initials: "МА", color: "#4c1d95", url: imgAitkhozhyn },
  },
  {
    keys: ["ауэзов", "auezov", "mukhtar", "мухтар", "әуезов"],
    data: { personName: "Мұхтар Әуезов", initials: "МӘ", color: "#065f46",
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Mukhtar_Auezov.jpg/100px-Mukhtar_Auezov.jpg" },
  },
  {
    keys: ["ньютон", "newton"],
    data: { personName: "Исаак Ньютон", initials: "НЮ", color: "#1e40af",
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/GodfreyKneller-IsaacNewton-1689.jpg/100px-GodfreyKneller-IsaacNewton-1689.jpg" },
  },
  {
    keys: ["эйнштейн", "einstein"],
    data: { personName: "Альберт Эйнштейн", initials: "АЭ", color: "#92400e",
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Albert_Einstein_Head.jpg/100px-Albert_Einstein_Head.jpg" },
  },
  {
    keys: ["пушкин", "pushkin"],
    data: { personName: "Александр Пушкин", initials: "АП", color: "#831843",
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/Pushkin_1827_Tropin.jpg/100px-Pushkin_1827_Tropin.jpg" },
  },
  {
    keys: ["ломоносов", "lomonosov"],
    data: { personName: "Михаил Ломоносов", initials: "МЛ", color: "#134e4a",
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Lomonosov3.jpg/100px-Lomonosov3.jpg" },
  },
  {
    keys: ["коперник", "copernicus"],
    data: { personName: "Николай Коперник", initials: "НК", color: "#1e3a5f",
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Nikolaus_Kopernikus.jpg/100px-Nikolaus_Kopernikus.jpg" },
  },
  {
    keys: ["леонардо", "da vinci", "давинчи", "vinci"],
    data: { personName: "Леонардо да Винчи", initials: "ЛД", color: "#78350f",
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Leonardo_self.jpg/100px-Leonardo_self.jpg" },
  },
  {
    keys: ["менделеев", "mendeleev"],
    data: { personName: "Дмитрий Менделеев", initials: "ДМ", color: "#166534",
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Dmitry_Mendeleyev.png/100px-Dmitry_Mendeleyev.png" },
  },
  {
    keys: ["дарвин", "darwin"],
    data: { personName: "Чарльз Дарвин", initials: "ЧД", color: "#14532d",
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Charles_Darwin_seated_crop.jpg/100px-Charles_Darwin_seated_crop.jpg" },
  },
  {
    keys: ["цицерон", "cicero"],
    data: { personName: "Цицерон", initials: "ЦЦ", color: "#7c2d12",
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Cicero_-_Musei_Capitolini.JPG/100px-Cicero_-_Musei_Capitolini.JPG" },
  },
  {
    keys: ["сократ", "socrates"],
    data: { personName: "Сократ", initials: "СО", color: "#4c1d95",
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Socrate_du_Louvre.jpg/100px-Socrate_du_Louvre.jpg" },
  },
  {
    keys: ["аристотель", "aristotle", "aristoteles"],
    data: { personName: "Аристотель", initials: "АР", color: "#1e3a8a",
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Aristotle_Altemps_Inv8575.jpg/100px-Aristotle_Altemps_Inv8575.jpg" },
  },
  {
    keys: ["платон", "plato"],
    data: { personName: "Платон", initials: "ПЛ", color: "#312e81",
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Plato_Silanion_Musei_Capitolini_MC1377.jpg/100px-Plato_Silanion_Musei_Capitolini_MC1377.jpg" },
  },
];

export function getGroupPersonData(groupName: string): GroupPersonData | null {
  if (!groupName) return null;
  const lower = groupName.toLowerCase();
  for (const entry of GROUP_PERSON_MAP) {
    if (entry.keys.some(k => lower.includes(k))) return entry.data;
  }
  return null;
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
