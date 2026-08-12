import React, { useState, useEffect, useRef } from 'react';
import { 
  fetchGroups, 
  fetchStudents, 
  fetchAttendanceReport,
  fetchEntReport,
  fetchTeacherFeedbackByStudent,
  fetchMonthlyReport,
  fetchMonthlyReportsHistory,
  saveMonthlyReport,
  generateAiReport
} from '@/lib/api';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2, Download, Search, FileText, Sparkles, MessageCircle, Send, Plus, RefreshCw, Calendar, TrendingUp, AlertCircle, Wand2, Save } from "lucide-react";
import { toast } from "sonner";
import html2pdf from "html2pdf.js";
import ReportPDFTemplate from '@/components/ReportPDFTemplate';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Генерируем последние 12 месяцев
const generateMonths = () => {
  const months = [];
  const date = new Date();
  const formatter = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' });
  
  for (let i = 0; i < 12; i++) {
    const m = new Date(date.getFullYear(), date.getMonth() - i, 1);
    const value = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
    const label = formatter.format(m);
    months.push({ 
      value, 
      label: label.charAt(0).toUpperCase() + label.slice(1) 
    });
  }
  return months;
};

export default function ReportsPage() {
  const availableMonths = generateMonths();
  
  const [groups, setGroups] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(availableMonths[0].value);
  
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  
  // Data for report
  const [reportData, setReportData] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(false);
  
  // History
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Editor for meeting outcomes
  const [outcomes, setOutcomes] = useState('');
  const [teacherSummary, setTeacherSummary] = useState('');
  const [saving, setSaving] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [generatingTeacherAi, setGeneratingTeacherAi] = useState(false);

  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoadingGroups(true);
    fetchGroups().then((res) => {
      setGroups(res);
      if (res.length > 0 && !selectedGroupId) {
        setSelectedGroupId(String(res[0].id));
      }
    }).catch(console.error).finally(() => setLoadingGroups(false));
  }, []);

  useEffect(() => {
    if (selectedGroupId) {
      setLoadingStudents(true);
      fetchStudents(parseInt(selectedGroupId, 10)).then((res: any) => {
        const list = Array.isArray(res) ? res : (res.students || []);
        setStudents(list);
        setSelectedStudentId(''); 
        setReportData(null);
        setHistoryData([]);
      }).catch(console.error).finally(() => setLoadingStudents(false));
    } else {
      setStudents([]);
      setSelectedStudentId('');
      setReportData(null);
      setHistoryData([]);
    }
  }, [selectedGroupId]);

  useEffect(() => {
    if (selectedStudentId && selectedMonth) {
      loadStudentData();
      loadStudentHistory();
    } else {
      setReportData(null);
    }
  }, [selectedStudentId, selectedMonth]);

  const loadStudentHistory = async () => {
    if (!selectedStudentId) return;
    setLoadingHistory(true);
    try {
      const data = await fetchMonthlyReportsHistory(parseInt(selectedStudentId, 10));
      setHistoryData(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadStudentData = async () => {
    setLoadingData(true);
    try {
      const sId = parseInt(selectedStudentId, 10);
      const gId = parseInt(selectedGroupId, 10);
      
      const [y, m] = selectedMonth.split('-');
      const d = new Date(parseInt(y), parseInt(m) - 1, 1);
      d.setMonth(d.getMonth() - 3);
      const fromMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      const [attRes, entRes, feedbackRes, reportRes] = await Promise.all([
        fetchAttendanceReport(selectedMonth, gId),
        fetchEntReport(gId, fromMonth, selectedMonth),
        fetchTeacherFeedbackByStudent(sId, selectedMonth),
        fetchMonthlyReport(sId, selectedMonth)
      ]);

      const studentAtt = (attRes.rows || []).filter((r: any) => r.student_id === sId);
      const present = studentAtt.filter((r: any) => r.status === 'present').length;
      const total = studentAtt.length;
      const attRate = total > 0 ? Math.round((present / total) * 100) : 0;
      
      const hwTotal = studentAtt.filter((r: any) => r.homework).length;
      const hwDone = studentAtt.filter((r: any) => r.homework === 'done').length;
      const hwRate = hwTotal > 0 ? Math.round((hwDone / hwTotal) * 100) : 0;

      const studentEnt = (entRes.rows || [])
        .filter((r: any) => r.student_id === sId)
        .sort((a: any, b: any) => a.month.localeCompare(b.month));

      const entByMonthMap = new Map();
      studentEnt.forEach((r: any) => {
        if (!entByMonthMap.has(r.month)) entByMonthMap.set(r.month, 0);
        entByMonthMap.set(r.month, entByMonthMap.get(r.month) + r.score);
      });
      const entTrends = Array.from(entByMonthMap.entries()).map(([month, score]) => ({ month, score })).sort((a, b) => a.month.localeCompare(b.month));

      let currentEnt = 0;
      let prevEnt = 0;
      if (entTrends.length > 0) {
        currentEnt = entTrends.find(t => t.month === selectedMonth)?.score || 0;
        const past = entTrends.filter(t => t.month < selectedMonth);
        if (past.length > 0) prevEnt = past[past.length - 1].score;
      }

      setReportData({
        attendance: { list: studentAtt, total, present, rate: attRate },
        homework: { total: hwTotal, done: hwDone, rate: hwRate },
        ent: { list: studentEnt, trends: entTrends, current: currentEnt, prev: prevEnt },
        feedback: feedbackRes || [],
        report: reportRes || {}
      });

      setOutcomes(reportRes?.summary || '');
      setTeacherSummary(reportRes?.teacher_summary || '');

    } catch (e: any) {
      toast.error('Ошибка загрузки данных: ' + e.message);
    } finally {
      setLoadingData(false);
    }
  };

  const handleSave = async (silent = false) => {
    if (!selectedStudentId || !selectedMonth) return;
    setSaving(true);
    try {
      const sId = parseInt(selectedStudentId, 10);
      await saveMonthlyReport(sId, selectedMonth, outcomes, teacherSummary, JSON.stringify(reportData));
      if (!silent) toast.success('Итоги сохранены!');
      
      setReportData((prev: any) => ({
        ...prev,
        report: { ...prev.report, summary: outcomes, teacher_summary: teacherSummary }
      }));
      // Refresh history
      loadStudentHistory();
    } catch (e: any) {
      if (!silent) toast.error('Ошибка сохранения: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndDownload = async () => {
    await handleSave(true);
    
    // Give React time to reconcile the latest data into the hidden template
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const wrapper = pdfRef.current?.parentElement?.parentElement;
    const element = pdfRef.current;
    if (!element || !wrapper) {
      toast.error('PDF элемент не найден');
      return;
    }
    
    // Temporarily make visible for html2canvas (it needs layout)
    const origStyle = wrapper.style.cssText;
    wrapper.style.cssText = 'position:fixed;left:0;top:0;z-index:-1;opacity:0.01;pointer-events:none;overflow:visible;width:auto;height:auto;';
    
    const studentName = students.find(s => String(s.id) === selectedStudentId)?.full_name || 'Ученик';
    try {
      const opt = {
        margin:       [5, 5, 5, 5],
        filename:     `Отчет_${studentName}_${selectedMonth}.pdf`,
        image:        { type: 'png', quality: 1 },
        html2canvas:  { scale: 3, useCORS: true, windowWidth: 794, logging: false, backgroundColor: '#FFFFFF' },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
      };
      await html2pdf().from(element).set(opt).save();
      toast.success('PDF скачан!');
    } catch (e: any) {
      toast.error('Ошибка генерации PDF: ' + e.message);
    } finally {
      // Restore hidden state
      wrapper.style.cssText = origStyle;
    }
  };

  const sendToWA = async () => {
    await handleSave(true);
    const student = students.find(s => String(s.id) === selectedStudentId);
    if (!student || !student.parent_phone) {
      toast.error("Нет номера телефона родителя");
      return;
    }
    const phone = student.parent_phone.replace(/\D/g, '');
    
    // Формируем текст
    const monthLabel = availableMonths.find(m => m.value === selectedMonth)?.label || selectedMonth;
    let text = `Здравствуйте! Это отчет за ${monthLabel} по ученику ${student.full_name}.\n\n`;
    if (reportData?.attendance) text += `Посещаемость: ${reportData.attendance.rate}%\n`;
    if (reportData?.ent?.current) text += `ЕНТ балл: ${reportData.ent.current}\n\n`;
    if (teacherSummary) text += `Отзыв преподавателей:\n${teacherSummary}\n\n`;
    if (outcomes) text += `Итоги и рекомендации:\n${outcomes}\n`;
    
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleAiAction = async (action: 'improve' | 'generate') => {
    setGeneratingAi(true);
    try {
      const studentName = students.find(s => String(s.id) === selectedStudentId)?.full_name || 'Ученик';
      const monthLabel = availableMonths.find(m => m.value === selectedMonth)?.label || selectedMonth;
      
      const res = await generateAiReport({
        action,
        studentName,
        month: monthLabel,
        stats: {
          attendance: `${reportData.attendance.rate}% (${reportData.attendance.present} из ${reportData.attendance.total})`,
          homework: `${reportData.homework.rate}% (${reportData.homework.done} из ${reportData.homework.total})`,
          ent: reportData.ent.current > 0 ? reportData.ent.current : 'Нет данных',
          feedback: reportData.feedback.map((fb: any) => `${fb.subject_name || 'Общее'} (${fb.teacher_name}): ${fb.comment}`).join('\n') || 'Нет отзывов'
        },
        draft: outcomes
      });
      
      setOutcomes(res.result);
      toast.success(action === 'improve' ? 'Текст улучшен ИИ ✨' : 'Текст сгенерирован ИИ ✨');
    } catch (e: any) {
      toast.error(e.message || 'Ошибка генерации');
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleTeacherAiAction = async () => {
    setGeneratingTeacherAi(true);
    try {
      const studentName = students.find(s => String(s.id) === selectedStudentId)?.full_name || 'Ученик';
      const monthLabel = availableMonths.find(m => m.value === selectedMonth)?.label || selectedMonth;
      
      const res = await generateAiReport({
        action: 'process-feedback',
        studentName,
        month: monthLabel,
        stats: {
          attendance: '',
          homework: '',
          ent: '',
          feedback: reportData.feedback.map((fb: any) => `${fb.subject_name || 'Общее'} (${fb.teacher_name}): ${fb.comment}`).join('\n') || 'Нет отзывов'
        },
        draft: ''
      });
      
      setTeacherSummary(res.result);
      toast.success('Сводка преподавателей готова ✨');
    } catch (e: any) {
      toast.error(e.message || 'Ошибка генерации');
    } finally {
      setGeneratingTeacherAi(false);
    }
  };

  const filteredStudents = students.filter(s => s.full_name.toLowerCase().includes(searchQuery.toLowerCase()));
  const selectedStudentObj = students.find(s => String(s.id) === selectedStudentId);
  
  const getStatusColor = (sId: number) => {
    // В идеале мы бы вытягивали статусы всех студентов в группе одним запросом, 
    // но пока просто покажем серый, если это не текущий выбранный студент (или если есть данные)
    if (String(sId) === selectedStudentId && reportData) {
      if (outcomes.length > 50) return "bg-green-500";
      if (outcomes.length > 0) return "bg-yellow-400";
      return "bg-red-400";
    }
    return "bg-gray-300";
  };

  return (
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-white text-sm">
      
      {/* 1. Левая колонка: Навигация */}
      <div className="w-1/4 min-w-[280px] max-w-[320px] bg-gray-50/50 border-r border-gray-200 flex flex-col h-full">
        <div className="p-4 border-b border-gray-200 flex flex-col gap-3 shrink-0">
          <div className="flex gap-2">
            <Select value={selectedGroupId} onValueChange={setSelectedGroupId} disabled={loadingGroups}>
              <SelectTrigger className="w-full bg-white shadow-sm border-gray-200 h-9">
                <SelectValue placeholder="Выберите группу" />
              </SelectTrigger>
              <SelectContent>
                {groups.map(g => (
                  <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-full bg-white shadow-sm border-gray-200 h-9">
                <SelectValue placeholder="Месяц" />
              </SelectTrigger>
              <SelectContent>
                {availableMonths.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Поиск ученика..." 
              className="pl-9 bg-white shadow-sm h-9 border-gray-200"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {loadingStudents ? (
              <div className="flex items-center justify-center p-8 text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center p-8 text-gray-400 text-xs">Нет учеников</div>
            ) : (
              filteredStudents.map(student => (
                <button
                  key={student.id}
                  onClick={() => setSelectedStudentId(String(student.id))}
                  className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 transition-colors ${
                    selectedStudentId === String(student.id) 
                      ? 'bg-primary/5 border border-primary/20 shadow-sm' 
                      : 'hover:bg-gray-100/50 border border-transparent'
                  }`}
                >
                  <div className="relative">
                    <Avatar className="h-8 w-8 border border-gray-200 shadow-sm">
                      <AvatarImage src={student.avatar_url} />
                      <AvatarFallback className="bg-white text-xs text-gray-600">{student.full_name.substring(0,2)}</AvatarFallback>
                    </Avatar>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${getStatusColor(student.id)}`} />
                  </div>
                  <div className="flex-1 truncate">
                    <div className="font-medium text-gray-900 truncate leading-tight">{student.full_name}</div>
                    <div className="text-xs text-gray-500 truncate mt-0.5">{student.parent_phone || 'Нет номера'}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* 2. Центральная колонка: Рабочая область */}
      <div className="flex-1 bg-white flex flex-col h-full overflow-hidden relative">
        {!selectedStudentId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-4 shadow-sm">
              <FileText className="h-8 w-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">Отчет не выбран</h3>
            <p className="text-sm mt-1">Выберите ученика из списка слева для работы</p>
          </div>
        ) : loadingData ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white z-10">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  {selectedStudentObj?.full_name}
                </h2>
                <div className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                  <Badge variant="secondary" className="bg-gray-100 text-gray-600 hover:bg-gray-100 font-normal shadow-none border-0">
                    {groups.find(g => String(g.id) === selectedGroupId)?.name}
                  </Badge>
                  <span>•</span>
                  <span>{availableMonths.find(m => m.value === selectedMonth)?.label}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => handleSave(false)} disabled={saving} className="h-9">
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Черновик
                </Button>
                <Button variant="outline" size="sm" onClick={handleSaveAndDownload} disabled={saving} className="h-9">
                  <Download className="h-4 w-4 mr-2" /> PDF
                </Button>
                <Button size="sm" onClick={sendToWA} className="h-9 bg-[#25D366] hover:bg-[#20bd5a] text-white border-0 shadow-sm">
                  <Send className="h-4 w-4 mr-2" />
                  Отправить в WA
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-8 max-w-4xl mx-auto space-y-8">
                
                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl border border-gray-100 bg-white shadow-sm flex flex-col justify-center">
                    <div className="text-sm text-gray-500 mb-1 flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-blue-500" /> Посещаемость
                    </div>
                    <div className="text-2xl font-semibold text-gray-900">{reportData?.attendance?.rate || 0}%</div>
                    <div className="text-xs text-gray-400 mt-1">{reportData?.attendance?.present} из {reportData?.attendance?.total} занятий</div>
                  </div>
                  <div className="p-4 rounded-xl border border-gray-100 bg-white shadow-sm flex flex-col justify-center">
                    <div className="text-sm text-gray-500 mb-1 flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-orange-500" /> ДЗ
                    </div>
                    <div className="text-2xl font-semibold text-gray-900">{reportData?.homework?.rate || 0}%</div>
                    <div className="text-xs text-gray-400 mt-1">{reportData?.homework?.done} из {reportData?.homework?.total} сдано</div>
                  </div>
                  <div className="p-4 rounded-xl border border-gray-100 bg-white shadow-sm flex flex-col justify-center">
                    <div className="text-sm text-gray-500 mb-1 flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4 text-green-500" /> Средний ЕНТ
                    </div>
                    <div className="text-2xl font-semibold text-gray-900">{reportData?.ent?.current || 0}</div>
                    <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                      {reportData?.ent?.current > reportData?.ent?.prev ? (
                        <span className="text-green-600 flex items-center">+{reportData?.ent?.current - reportData?.ent?.prev} с прош. мес.</span>
                      ) : reportData?.ent?.current < reportData?.ent?.prev ? (
                        <span className="text-red-500 flex items-center">{reportData?.ent?.current - reportData?.ent?.prev} с прош. мес.</span>
                      ) : <span>Без изменений</span>}
                    </div>
                  </div>
                </div>

                {/* Teacher Feedback (Mini-chat UI) */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900">Комментарии преподавателей</h3>
                  </div>
                  <div className="bg-gray-50/50 rounded-xl border border-gray-100 p-5 space-y-4">
                    {reportData?.feedback?.length === 0 ? (
                      <div className="text-sm text-gray-400 text-center py-4">Нет отзывов за этот месяц</div>
                    ) : (
                      reportData?.feedback?.map((fb: any) => (
                        <div key={fb.id} className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                            <span className="text-blue-700 text-xs font-bold">{fb.teacher_name?.charAt(0)}</span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-gray-900 text-sm">{fb.teacher_name}</span>
                              <span className="text-xs text-gray-400">{fb.subject_name || 'Общее'}</span>
                            </div>
                            <div className="text-sm text-gray-700 bg-white border border-gray-100 p-3 rounded-xl rounded-tl-none shadow-sm inline-block">
                              {fb.comment || <span className="text-gray-400 italic">Ожидает отзыва...</span>}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* AI Summary for Parents */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900">AI-Сводка отзывов (для родителя)</h3>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-50 px-2"
                      onClick={handleTeacherAiAction}
                      disabled={generatingTeacherAi}
                    >
                      {generatingTeacherAi ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1.5" />}
                      Сгенерировать
                    </Button>
                  </div>
                  <Textarea
                    placeholder="Здесь будет красивая сводка от преподавателей для отправки родителю..."
                    className="min-h-[100px] resize-y bg-white border-gray-200 shadow-sm text-sm p-4 rounded-xl focus-visible:ring-primary/20"
                    value={teacherSummary}
                    onChange={e => setTeacherSummary(e.target.value)}
                  />
                </div>

                {/* Meeting Outcomes */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900">Итоги собрания (куратор)</h3>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2"
                        onClick={() => handleAiAction('generate')}
                        disabled={generatingAi}
                      >
                        {generatingAi ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Wand2 className="h-3 w-3 mr-1.5" />}
                        Сгенерировать с нуля
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-50 px-2"
                        onClick={() => handleAiAction('improve')}
                        disabled={generatingAi || !outcomes}
                      >
                        {generatingAi ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1.5" />}
                        Улучшить текст
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    placeholder="Напишите итоги месяца, договоренности с учеником и рекомендации..."
                    className="min-h-[180px] resize-y bg-white border-gray-200 shadow-sm text-sm p-4 rounded-xl focus-visible:ring-primary/20"
                    value={outcomes}
                    onChange={e => setOutcomes(e.target.value)}
                  />
                </div>
                
                <div className="h-8" /> {/* Spacer */}
              </div>
            </ScrollArea>
          </>
        )}
      </div>

      {/* 3. Правая колонка: Контекст и История */}
      <div className="w-1/4 min-w-[280px] max-w-[320px] bg-gray-50 border-l border-gray-200 flex flex-col h-full">
        <Tabs defaultValue="history" className="flex flex-col h-full w-full">
          <div className="px-4 py-3 border-b border-gray-200 bg-white shrink-0">
            <TabsList className="w-full grid grid-cols-2 h-8">
              <TabsTrigger value="history" className="text-xs">История</TabsTrigger>
              <TabsTrigger value="info" className="text-xs">Контекст</TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="history" className="flex-1 m-0 overflow-hidden flex flex-col">
            <ScrollArea className="flex-1">
              <div className="p-4">
                {!selectedStudentId ? (
                  <div className="text-xs text-gray-400 text-center mt-10">Ученик не выбран</div>
                ) : loadingHistory ? (
                  <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 text-gray-400 animate-spin" /></div>
                ) : historyData.length === 0 ? (
                  <div className="text-xs text-gray-400 text-center mt-10 flex flex-col items-center">
                    <AlertCircle className="h-6 w-6 mb-2 text-gray-300" />
                    Ранее отчетов не было
                  </div>
                ) : (
                  <Accordion type="multiple" className="space-y-2">
                    {historyData.map((hist) => (
                      <AccordionItem key={hist.month} value={hist.month} className="border border-gray-200 bg-white rounded-lg shadow-sm overflow-hidden px-3">
                        <AccordionTrigger className="py-3 hover:no-underline flex justify-between">
                          <span className="text-sm font-medium text-gray-900">{hist.month}</span>
                        </AccordionTrigger>
                        <AccordionContent className="text-xs text-gray-600 pb-3 space-y-3">
                          
                          {/* Если есть сохраненные детальные метрики */}
                          {hist.stats_json && (() => {
                            try {
                              const stats = JSON.parse(hist.stats_json);
                              return (
                                <div className="grid grid-cols-2 gap-2 mb-3 bg-gray-50/50 p-2 rounded border border-gray-100">
                                  <div><span className="text-gray-400">Посещаемость:</span> <span className="font-semibold text-gray-800">{stats.attendance?.rate || 0}%</span></div>
                                  <div><span className="text-gray-400">ДЗ:</span> <span className="font-semibold text-gray-800">{stats.homework?.rate || 0}%</span></div>
                                  <div className="col-span-2"><span className="text-gray-400">ЕНТ:</span> <span className="font-semibold text-gray-800">{stats.ent?.current || 0}</span></div>
                                </div>
                              );
                            } catch { return null; }
                          })()}

                          {hist.teacher_summary && (
                            <div>
                              <div className="font-semibold text-gray-800 mb-1">Сводка учителей:</div>
                              <div className="bg-gray-50 p-2 rounded whitespace-pre-wrap">{hist.teacher_summary}</div>
                            </div>
                          )}
                          {hist.summary && (
                            <div>
                              <div className="font-semibold text-gray-800 mb-1">Итоги:</div>
                              <div className="bg-gray-50 p-2 rounded whitespace-pre-wrap">{hist.summary}</div>
                            </div>
                          )}
                          {!hist.summary && !hist.teacher_summary && (
                            <div className="text-gray-400 italic">Пустой отчет</div>
                          )}
                          <div className="pt-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="w-full text-xs" 
                              onClick={() => setSelectedMonth(hist.month)}
                            >
                              Перейти к отчету за {hist.month}
                            </Button>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="info" className="flex-1 m-0 overflow-hidden">
             <ScrollArea className="h-full p-4">
                {selectedStudentObj ? (
                  <div className="space-y-4 text-sm">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Родитель</div>
                      <div className="font-medium">{selectedStudentObj.parent_name || 'Не указан'}</div>
                      <div className="text-gray-600">{selectedStudentObj.parent_phone || 'Нет телефона'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Ученик</div>
                      <div className="font-medium">{selectedStudentObj.phone || 'Нет телефона'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Заметки (CRM)</div>
                      <div className="text-gray-600 bg-white p-2 border border-gray-100 rounded-lg text-xs min-h-[60px]">
                        {selectedStudentObj.notes || 'Нет заметок...'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 text-center mt-10">Ученик не выбран</div>
                )}
             </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

      {/* Скрытый компонент для рендера PDF — overflow:hidden clip */}
      <div style={{ overflow: 'hidden', height: 0, width: 0 }}>
        <div ref={pdfRef} style={{ width: '794px' }}>
          <ReportPDFTemplate 
            studentName={selectedStudentObj?.full_name || ''}
            groupName={groups.find(g => String(g.id) === selectedGroupId)?.name || ''}
            monthLabel={availableMonths.find(m => m.value === selectedMonth)?.label || selectedMonth}
            attendance={reportData?.attendance || { rate: 0, present: 0, total: 0, list: [] }}
            homework={reportData?.homework || { rate: 0, done: 0, total: 0 }}
            ent={reportData?.ent || { current: 0, prev: 0, list: [] }}
            outcomes={outcomes}
            teacherSummary={teacherSummary}
          />
        </div>
      </div>

    </div>
  );
}