import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Printer, Loader2, Download, FileText } from "lucide-react";
import { useState, useEffect, useRef } from "react";
// @ts-ignore
import html2pdf from "html2pdf.js";

interface ParentReportModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  student: any;
  overview: any;
}

const MONTHS: Record<string, string> = {
  "01": "Январь", "02": "Февраль", "03": "Март", "04": "Апрель", 
  "05": "Май", "06": "Июнь", "07": "Июль", "08": "Август", 
  "09": "Сентябрь", "10": "Октябрь", "11": "Ноябрь", "12": "Декабрь"
};

export function ParentReportModal({ open, onOpenChange, student, overview }: ParentReportModalProps) {
  const [loading, setLoading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [reportText, setReportText] = useState("");
  const printRef = useRef<HTMLDivElement>(null);

  const h = overview?.historical || {};
  const entByMonth = overview?.ent?.byMonth || [];
  const latestEnt = entByMonth.length > 0 ? entByMonth[entByMonth.length - 1] : null;

  const attRate = h.attendance_rate ?? 0;
  const hwRate = h.homework_rate ?? 0;
  const presentCount = h.present_count ?? 0;
  const absentCount = h.absent_count ?? 0;
  const lateCount = h.late_count ?? 0;
  const totalLessons = h.total_lessons ?? 0;

  useEffect(() => {
    if (open) {
      setLoading(true);
      // Mock AI Generation delay
      const timer = setTimeout(() => {
        let text = `Уважаемый родитель, направляем вам краткий отчет об успеваемости ученика ${student?.full_name}.\n\n`;
        
        text += `Посещаемость составляет ${attRate}%, а процент выполнения домашних заданий — ${hwRate}%. `;
        if (attRate < 80) text += `Рекомендуем обратить внимание на частые пропуски занятий. `;
        else if (attRate > 95) text += `Отличный показатель посещаемости! `;
        
        if (latestEnt && latestEnt.subjects && latestEnt.subjects.length > 0) {
          const m = latestEnt.month.split("-")[1];
          const monthName = MONTHS[m] || latestEnt.month;
          text += `\n\nРезультаты ЕНТ (${monthName}):\n`;
          latestEnt.subjects.forEach((e: any) => {
            text += `- ${e.name}: ${e.score} баллов\n`;
          });
          text += `Итого: ${latestEnt.total} баллов.\n`;
        }
        
        text += `\n\nС уважением,\nУчебная часть (куратор: ${student?.group?.curatorName || student?.curator_name || "не назначен"})`;
        
        setReportText(text);
        setLoading(false);
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      setReportText("");
    }
  }, [open, student, overview]);

  const handleGeneratePdf = async () => {
    if (!printRef.current) return;
    
    setGeneratingPdf(true);
    
    // We temporarily show the hidden elements for PDF generation
    const el = printRef.current;
    el.style.display = 'block';
    
    const currentMonthNum = new Date().getMonth() + 1;
    const currentMonthStr = currentMonthNum < 10 ? `0${currentMonthNum}` : `${currentMonthNum}`;
    const monthName = MONTHS[currentMonthStr] || currentMonthStr;

    const opt = {
      margin:       [10, 10, 10, 10], // top, left, bottom, right
      filename:     `${student?.full_name?.replace(/ /g, "_") || 'Ученик'}_${monthName}_Отчет.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
      // .outputPdf('bloburl') to open in a new tab
      const pdf = await html2pdf().set(opt).from(el).outputPdf('bloburl');
      window.open(pdf, '_blank');
    } catch (e) {
      console.error("PDF generation failed", e);
    } finally {
      el.style.display = 'none';
      setGeneratingPdf(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-500" />
            Отчет для родителя
          </DialogTitle>
          <DialogDescription>
            Текст сгенерирован на основе успеваемости ученика за выбранный период.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground animate-pulse">Анализируем данные ученика...</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-muted/30 p-6 rounded-xl border text-sm text-foreground whitespace-pre-wrap">
              {reportText}
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Закрыть</Button>
              <Button 
                onClick={handleGeneratePdf} 
                disabled={generatingPdf}
                className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {generatingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {generatingPdf ? "Создание PDF..." : "Открыть как PDF"}
              </Button>
            </div>
            
            {/* Hidden container specifically for HTML2PDF rendering */}
            <div style={{ display: 'none' }}>
              <div ref={printRef} className="bg-white text-black p-8 font-sans" style={{ width: '800px', maxWidth: 'none', margin: '0 auto' }}>
                
                {/* PDF Header */}
                <div className="flex items-center justify-between border-b-2 border-indigo-600 pb-6 mb-8">
                  <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Отчет об успеваемости</h1>
                    <p className="text-slate-500 mt-2 font-medium">Дата формирования: {new Date().toLocaleDateString("ru-RU")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-slate-900">{student?.full_name}</p>
                    <p className="text-lg text-slate-500 mt-1">{student?.group_name || student?.group?.name || "Без группы"}</p>
                  </div>
                </div>

                {/* KPI Cards */}
                <div className="flex justify-between gap-6 mb-8">
                  <div className="flex-1 bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <p className="text-slate-500 text-sm font-medium mb-1 uppercase tracking-wider">Посещаемость</p>
                    <p className={`text-3xl font-black ${attRate >= 80 ? 'text-emerald-600' : 'text-red-500'}`}>{attRate}%</p>
                    <p className="text-slate-500 text-xs mt-2">
                      Присутствовал: {presentCount} из {totalLessons}
                    </p>
                  </div>
                  <div className="flex-1 bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <p className="text-slate-500 text-sm font-medium mb-1 uppercase tracking-wider">Домашние задания</p>
                    <p className={`text-3xl font-black ${hwRate >= 80 ? 'text-indigo-600' : 'text-amber-500'}`}>{hwRate}%</p>
                    <p className="text-slate-500 text-xs mt-2">Процент выполнения ДЗ</p>
                  </div>
                  <div className="flex-1 bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <p className="text-slate-500 text-sm font-medium mb-1 uppercase tracking-wider">Опоздания</p>
                    <p className={`text-3xl font-black ${lateCount > 2 ? 'text-red-500' : 'text-slate-900'}`}>{lateCount}</p>
                    <p className="text-slate-500 text-xs mt-2">Всего опозданий</p>
                  </div>
                </div>

                {/* AI Summary */}
                <div className="mb-8">
                  <h2 className="text-lg font-bold text-slate-800 mb-3 uppercase tracking-wider border-b border-slate-200 pb-2">Резюме</h2>
                  <div className="bg-indigo-50/50 rounded-xl p-5 border border-indigo-100">
                    <p className="text-slate-700 text-base leading-relaxed whitespace-pre-wrap">
                      {reportText}
                    </p>
                  </div>
                </div>

                {/* ENT Results (if any) */}
                {latestEnt && latestEnt.subjects && latestEnt.subjects.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-lg font-bold text-slate-800 mb-4 uppercase tracking-wider border-b border-slate-200 pb-2">
                      Результаты ЕНТ ({MONTHS[latestEnt.month.split("-")[1]] || latestEnt.month})
                    </h2>
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr>
                          <th className="border-b-2 border-slate-200 py-3 px-4 text-slate-500 font-semibold uppercase text-xs tracking-wider">Предмет</th>
                          <th className="border-b-2 border-slate-200 py-3 px-4 text-slate-500 font-semibold uppercase text-xs tracking-wider">Балл</th>
                        </tr>
                      </thead>
                      <tbody>
                        {latestEnt.subjects.map((s: any, i: number) => (
                          <tr key={i} className={i % 2 === 0 ? 'bg-slate-50/50' : 'bg-white'}>
                            <td className="border-b border-slate-100 py-3 px-4 font-medium text-slate-700">{s.name}</td>
                            <td className="border-b border-slate-100 py-3 px-4 font-bold text-slate-900">{s.score}</td>
                          </tr>
                        ))}
                        <tr className="bg-slate-100">
                          <td className="py-3 px-4 font-bold text-slate-900 uppercase">Итого</td>
                          <td className="py-3 px-4 font-black text-indigo-600 text-lg">{latestEnt.total}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Footer */}
                <div className="mt-16 pt-6 border-t border-slate-200 text-center">
                  <p className="text-slate-400 text-sm">
                    Отчет сгенерирован автоматически системой управления обучением.
                  </p>
                  <p className="text-slate-400 text-sm mt-1">
                    Куратор: {student?.group?.curatorName || student?.curator_name || "не назначен"}
                  </p>
                </div>

              </div>
            </div>
            
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
