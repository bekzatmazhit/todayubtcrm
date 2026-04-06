import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Printer, Calendar, AlertCircle } from "lucide-react";

const API_BASE = "/api";

// Group color palette — hex values matching Tailwind 500 shades used in CalendarPage
const GROUP_COLORS_HEX = [
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#8b5cf6", // violet-500
  "#f59e0b", // amber-500
  "#f43f5e", // rose-500
  "#06b6d4", // cyan-500
  "#f97316", // orange-500
  "#ec4899", // pink-500
  "#14b8a6", // teal-500
  "#6366f1", // indigo-500
  "#84cc16", // lime-500
  "#ef4444", // red-500
];
const getGroupColorHex = (groupId: number) => GROUP_COLORS_HEX[(groupId - 1) % GROUP_COLORS_HEX.length];

interface ScheduleEntry {
  id: number;
  group_id: number | null;
  group_name: string | null;
  custom_label: string | null;
  subject_name: string;
  teacher_name: string;
  room_name: string;
  start_time: string;
  end_time: string;
  time_label: string | null;
  cycle: "PSP" | "VChS";
}

interface Group {
  id: number;
  name: string;
}

interface PublicData {
  entries: ScheduleEntry[];
  group: Group | null;
  groups: Group[];
  token: string;
}

const CYCLE_LABELS: Record<string, { full: string; days: string }> = {
  PSP: { full: "ПСП", days: "Понедельник / Среда / Пятница" },
  VChS: { full: "ВЧС", days: "Вторник / Четверг / Суббота" },
};

export default function PublicSchedulePage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PublicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCycle, setActiveCycle] = useState<"PSP" | "VChS">("PSP");
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/public/schedule/${token}`)
      .then(r => {
        if (!r.ok) return r.json().then(e => Promise.reject(e.error || "Ошибка"));
        return r.json();
      })
      .then((d: PublicData) => {
        setData(d);
        // Auto-select first cycle that has data
        const cycles = ["PSP", "VChS"] as const;
        for (const c of cycles) {
          if (d.entries.some(e => e.cycle === c)) {
            setActiveCycle(c);
            break;
          }
        }
      })
      .catch((e: string) => setError(e))
      .finally(() => setLoading(false));
  }, [token]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <p className="text-lg font-medium text-gray-700">{error || "Расписание не найдено"}</p>
        <p className="text-sm text-gray-500">Ссылка недействительна или срок её действия истёк.</p>
      </div>
    );
  }

  const { entries, group, groups } = data;
  const isMultiGroup = !group;

  const groupColorMap: Record<number, string> = {};
  for (const g of groups) groupColorMap[g.id] = getGroupColorHex(g.id);

  // Only show cycles that have at least one entry
  const presentCycles = (["PSP", "VChS"] as const).filter(c => entries.some(e => e.cycle === c));

  const title = group ? `Расписание группы ${group.name}` : "Расписание";

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-page { box-shadow: none !important; padding: 0 !important; }
          .cycle-tab { display: none !important; }
          .print-cycle-section { break-inside: avoid; }
          table { border-collapse: collapse; }
          th, td { border: 1px solid #d1d5db !important; }
          @page { margin: 1.5cm; }
        }
      `}</style>

      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-5xl mx-auto" ref={printRef}>
          {/* Header */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6 no-print">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2.5 rounded-xl">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{title}</h1>
                  <p className="text-sm text-gray-500">Today UBT</p>
                </div>
              </div>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Printer className="h-4 w-4" />
                Скачать PDF
              </button>
            </div>
          </div>

          {/* Print header (only visible in print) */}
          <div className="hidden print:block mb-6">
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-sm text-gray-500">Today UBT — {new Date().toLocaleDateString("ru-RU")}</p>
          </div>

          {/* Cycle selector */}
          {presentCycles.length > 1 && (
            <div className="flex gap-2 mb-5 no-print cycle-tab">
              {presentCycles.map(c => (
                <button
                  key={c}
                  onClick={() => setActiveCycle(c)}
                  className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    activeCycle === c
                      ? "bg-primary text-white border-primary"
                      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {CYCLE_LABELS[c].full}
                  <span className="ml-2 text-xs opacity-70 hidden sm:inline">({CYCLE_LABELS[c].days})</span>
                </button>
              ))}
            </div>
          )}

          {/* Schedule content — loop all cycles in print mode, active only on screen */}
          {presentCycles.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
              <p className="text-gray-400">Расписание ещё не составлено</p>
            </div>
          ) : (
            <>
              {/* Screen view: only active cycle */}
              <div className="no-print">
                <ScheduleBlock
                  cycle={activeCycle}
                  entries={entries.filter(e => e.cycle === activeCycle)}
                  isMultiGroup={isMultiGroup}
                  groupColorMap={groupColorMap}
                />
              </div>

              {/* Print view: all cycles */}
              <div className="hidden print:block space-y-8">
                {presentCycles.map(c => (
                  <div key={c} className="print-cycle-section">
                    <ScheduleBlock
                      cycle={c}
                      entries={entries.filter(e => e.cycle === c)}
                      isMultiGroup={isMultiGroup}
                      groupColorMap={groupColorMap}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Group legend for multi-group view */}
          {isMultiGroup && groups.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 mt-5">
              <p className="text-xs font-semibold text-gray-500 mb-2">ГРУППЫ</p>
              <div className="flex flex-wrap gap-2">
                {groups.map(g => (
                  <div key={g.id} className="flex items-center gap-1.5 text-xs">
                    <span
                      className="w-3 h-3 rounded-sm inline-block"
                      style={{ backgroundColor: groupColorMap[g.id] }}
                    />
                    <span>{g.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <p className="text-center text-xs text-gray-400 mt-8 no-print">
            Актуальное расписание предоставлено Today UBT
          </p>
        </div>
      </div>
    </>
  );
}

function ScheduleBlock({
  cycle,
  entries,
  isMultiGroup,
  groupColorMap,
}: {
  cycle: "PSP" | "VChS";
  entries: ScheduleEntry[];
  isMultiGroup: boolean;
  groupColorMap: Record<number, string>;
}) {
  if (entries.length === 0) return null;

  const sorted = [...entries].sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
  const { full, days } = CYCLE_LABELS[cycle];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Cycle header */}
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60 flex items-baseline gap-2">
        <h2 className="font-bold text-base text-gray-800">{full}</h2>
        <span className="text-xs text-gray-500">{days}</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/40">
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3 w-32">Время</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Предмет</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Преподаватель</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Кабинет</th>
              {isMultiGroup && (
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Группа</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map((entry, idx) => {
              const groupColor = entry.group_id ? (groupColorMap[entry.group_id] || "#6b7280") : "#6b7280";
              return (
                <tr
                  key={entry.id}
                  className={`hover:bg-gray-50/60 transition-colors ${idx % 2 === 0 ? "" : "bg-gray-50/20"}`}
                >
                  {/* Left color bar + time */}
                  <td className="px-5 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-1 h-10 rounded-full flex-shrink-0"
                        style={{ backgroundColor: isMultiGroup ? groupColor : "#6366f1" }}
                      />
                      <div>
                        <div className="font-semibold text-gray-800 text-xs leading-tight">
                          {entry.start_time?.slice(0, 5)}
                        </div>
                        <div className="text-gray-400 text-xs leading-tight">
                          {entry.end_time?.slice(0, 5)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{entry.subject_name}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{entry.teacher_name}</td>
                  <td className="px-4 py-3 text-gray-500">{entry.room_name}</td>
                  {isMultiGroup && (
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
                        style={{ backgroundColor: groupColor }}
                      >
                        {entry.group_name || entry.custom_label || "—"}
                      </span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
