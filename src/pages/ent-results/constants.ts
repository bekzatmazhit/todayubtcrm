export const ACADEMIC_MONTHS = [
  { value: "2026-08", label: "Август", short: "Авг" },
  { value: "2026-09", label: "Сентябрь", short: "Сен" },
  { value: "2026-10", label: "Октябрь", short: "Окт" },
  { value: "2026-11", label: "Ноябрь", short: "Ноя" },
  { value: "2026-12", label: "Декабрь", short: "Дек" },
  { value: "2027-01", label: "Январь", short: "Янв" },
  { value: "2027-02", label: "Февраль", short: "Фев" },
  { value: "2027-03", label: "Март", short: "Мар" },
  { value: "2027-04", label: "Апрель", short: "Апр" },
  { value: "2027-05", label: "Май", short: "Май" },
  { value: "2027-06", label: "Июнь", short: "Июн" },
  { value: "2027-07", label: "Июль", short: "Июл" },
];

export const REAL_EXAM_TYPES = [
  { value: "1000-01", label: "Пробный ЕНТ", short: "Проб.ЕНТ" },
  { value: "1000-03", label: "Настоящий ЕНТ", short: "Наст.ЕНТ" },
  { value: "1001-01", label: "Грант 1", short: "Грант 1" },
  { value: "1001-02", label: "Грант 2", short: "Грант 2" },
];

export const MONTH_LABELS: Record<string, string> = {};
export const MONTH_SHORT: Record<string, string> = {};
for (const m of ACADEMIC_MONTHS) { MONTH_LABELS[m.value] = m.label; MONTH_SHORT[m.value] = m.short; }
for (const m of REAL_EXAM_TYPES) { MONTH_LABELS[m.value] = m.label; MONTH_SHORT[m.value] = m.short; }

export const ENT_PROFILE_SUBJECTS: Record<number, { id: number; name: string; short: string; max: number }[]> = {
  1: [ // ФМ (Физ-Мат)
    { id: 1, name: "Математическая грамотность", short: "МГ", max: 20 },
    { id: 8, name: "Грамотность чтения", short: "ГЧ", max: 10 },
    { id: 3, name: "История Казахстана", short: "ИК", max: 10 },
    { id: 2, name: "Математика", short: "Мат", max: 50 },
    { id: 5, name: "Физика", short: "Физ", max: 50 },
  ],
  2: [ // БХ (Био-Хим)
    { id: 1, name: "Математическая грамотность", short: "МГ", max: 20 },
    { id: 8, name: "Грамотность чтения", short: "ГЧ", max: 10 },
    { id: 3, name: "История Казахстана", short: "ИК", max: 10 },
    { id: 6, name: "Биология", short: "Био", max: 50 },
    { id: 7, name: "Химия", short: "Хим", max: 50 },
  ],
  3: [ // ГЕ (Гео-Мат)
    { id: 1, name: "Математическая грамотность", short: "МГ", max: 20 },
    { id: 8, name: "Грамотность чтения", short: "ГЧ", max: 10 },
    { id: 3, name: "История Казахстана", short: "ИК", max: 10 },
    { id: 2, name: "Математика", short: "Мат", max: 50 },
    { id: 4, name: "География", short: "Гео", max: 50 },
  ],
};

export const MANDATORY_SUBJECTS = [
  { id: 1, name: "Математическая грамотность", short: "МГ", max: 20 },
  { id: 8, name: "Грамотность чтения", short: "ГЧ", max: 10 },
  { id: 3, name: "История Казахстана", short: "ИК", max: 10 },
];

export const CHART_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#3b82f6"];

export const GROUP_ROW_COLORS = [
  'bg-blue-500/[0.03]',
  'bg-violet-500/[0.03]',
  'bg-amber-500/[0.03]',
  'bg-emerald-500/[0.03]',
  'bg-rose-500/[0.03]',
  'bg-cyan-500/[0.03]',
  'bg-orange-500/[0.03]',
  'bg-pink-500/[0.03]',
];
export const getGroupRowColor = (groupId: number) => GROUP_ROW_COLORS[(groupId - 1) % GROUP_ROW_COLORS.length];

export function getScoreColor(score: number, max: number) {
  const pct = score / max;
  if (pct >= 0.8) return "text-emerald-600 dark:text-emerald-400 font-bold";
  if (pct >= 0.6) return "text-foreground font-semibold";
  if (pct >= 0.4) return "text-orange-500 font-medium";
  return "text-red-500 font-medium";
}

export function getScoreBg(score: number, max: number) {
  const pct = score / max;
  if (pct >= 0.8) return "bg-emerald-500";
  if (pct >= 0.6) return "bg-blue-500";
  if (pct >= 0.4) return "bg-orange-500";
  return "bg-red-500";
}

export function getMatrixCellBg(score: number, max: number) {
  if (!score || score <= 0) return "";
  const pct = score / max;
  if (pct >= 0.85) return "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold";
  if (pct >= 0.70) return "bg-green-500/15 text-green-700 dark:text-green-400 font-medium";
  if (pct >= 0.50) return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-500 font-medium";
  if (pct >= 0.35) return "bg-orange-500/20 text-orange-700 dark:text-orange-400 font-medium";
  return "bg-red-500/20 text-red-700 dark:text-red-400 font-medium";
}
