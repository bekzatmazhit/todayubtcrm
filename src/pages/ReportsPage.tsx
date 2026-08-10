import React, { useState, useEffect, useRef } from 'react';
import { 
  fetchGroups, 
  fetchStudents, 
  fetchAttendanceReport,
  fetchEntReport,
  fetchTeacherFeedbackByStudent,
  fetchMonthlyReport,
  saveMonthlyReport
} from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Download, CheckCircle2, XCircle, FileText, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { toast } from "sonner";
import html2pdf from "html2pdf.js";

// Генерируем последние 12 месяцев
const generateMonths = () => {
  const months = [];
  const date = new Date();
  const formatter = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' });
  
  for (let i = 0; i < 12; i++) {
    const m = new Date(date.getFullYear(), date.getMonth() - i, 1);
    const value = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
    const label = formatter.format(m);
    // Делаем с большой буквы
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
  
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(availableMonths[0].value);
  
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  
  // Data for report
  const [reportData, setReportData] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(false);

  // Editor for meeting outcomes
  const [outcomes, setOutcomes] = useState('');
  const [saving, setSaving] = useState(false);

  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoadingGroups(true);
    fetchGroups().then(setGroups).catch(console.error).finally(() => setLoadingGroups(false));
  }, []);

  useEffect(() => {
    if (selectedGroupId) {
      setLoadingStudents(true);
      fetchStudents(parseInt(selectedGroupId, 10)).then((res: any) => {
        const list = Array.isArray(res) ? res : (res.students || []);
        setStudents(list);
        setSelectedStudentId(''); // reset student when group changes
        setReportData(null);
      }).catch(console.error).finally(() => setLoadingStudents(false));
    } else {
      setStudents([]);
      setSelectedStudentId('');
      setReportData(null);
    }
  }, [selectedGroupId]);

  useEffect(() => {
    if (selectedStudentId && selectedMonth) {
      loadStudentData();
    } else {
      setReportData(null);
    }
  }, [selectedStudentId, selectedMonth]);

  const loadStudentData = async () => {
    setLoadingData(true);
    try {
      const sId = parseInt(selectedStudentId, 10);
      const gId = parseInt(selectedGroupId, 10);
      
      // Calculate 3 months ago for ENT trend
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

      // Filter attendance for this student
      const studentAtt = (attRes.rows || []).filter((r: any) => r.student_id === sId);
      const present = studentAtt.filter((r: any) => r.status === 'present').length;
      const total = studentAtt.length;
      const attRate = total > 0 ? Math.round((present / total) * 100) : 0;
      
      const hwTotal = studentAtt.filter((r: any) => r.homework).length;
      const hwDone = studentAtt.filter((r: any) => r.homework === 'done').length;
      const hwRate = hwTotal > 0 ? Math.round((hwDone / hwTotal) * 100) : 0;

      // Filter ENT for this student and sort by month
      const studentEnt = (entRes.rows || [])
        .filter((r: any) => r.student_id === sId)
        .sort((a: any, b: any) => a.month.localeCompare(b.month));

      // Group ENT by month to find total score per month
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
        if (past.length > 0) {
          prevEnt = past[past.length - 1].score;
        }
      }

      setReportData({
        attendance: { list: studentAtt, total, present, rate: attRate },
        homework: { total: hwTotal, done: hwDone, rate: hwRate },
        ent: { list: studentEnt, trends: entTrends, current: currentEnt, prev: prevEnt },
        feedback: feedbackRes || [],
        report: reportRes || {}
      });

      setOutcomes(reportRes?.summary || '');

    } catch (e: any) {
      toast.error('Ошибка загрузки данных: ' + e.message);
    } finally {
      setLoadingData(false);
    }
  };

  const handleSaveAndDownload = async () => {
    if (!selectedStudentId || !selectedMonth) return;
    setSaving(true);
    try {
      const sId = parseInt(selectedStudentId, 10);
      await saveMonthlyReport(sId, selectedMonth, outcomes);
      toast.success('Итоги сохранены!');
      
      // Update local state so PDF sees the latest outcomes
      setReportData((prev: any) => ({
        ...prev,
        report: { ...prev.report, summary: outcomes }
      }));

      // Generate PDF
      setTimeout(() => {
        const element = pdfRef.current;
        if (!element) return;
        
        const studentName = students.find(s => String(s.id) === selectedStudentId)?.full_name || 'Ученик';
        const monthLabel = availableMonths.find(m => m.value === selectedMonth)?.label || selectedMonth;
        
        const opt = {
          margin:       [10, 10, 10, 10], // top, left, bottom, right
          filename:     `Отчет_${studentName}_${selectedMonth}.pdf`,
          image:        { type: 'jpeg', quality: 0.98 },
          html2canvas:  { scale: 2, useCORS: true, windowWidth: 800 },
          jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        
        html2pdf().from(element).set(opt).save();
      }, 300);

    } catch (e: any) {
      toast.error('Ошибка сохранения: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const studentName = students.find(s => String(s.id) === selectedStudentId)?.full_name || '...';
  const groupName = groups.find(g => String(g.id) === selectedGroupId)?.name || '...';
  const monthLabel = availableMonths.find(m => m.value === selectedMonth)?.label || selectedMonth;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Персональные отчеты</h1>
          <p className="text-gray-500 mt-1">Формирование детального отчета для родительского собрания.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Группа</label>
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите группу" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map(g => (
                    <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ученик</label>
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId} disabled={!selectedGroupId || loadingStudents}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingStudents ? "Загрузка..." : "Выберите ученика"} />
                </SelectTrigger>
                <SelectContent>
                  {students.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.full_name || s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Месяц</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {!selectedStudentId ? (
        <div className="text-center py-12 text-gray-500">
          Выберите группу и ученика для просмотра отчета
        </div>
      ) : loadingData ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : reportData ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-blue-50 border-blue-100">
              <CardContent className="p-6 text-center">
                <p className="text-sm font-medium text-blue-600 mb-2">Посещаемость</p>
                <div className="text-4xl font-bold text-blue-900 mb-1">{reportData.attendance.rate}%</div>
                <p className="text-xs text-blue-600">Присутствовал на {reportData.attendance.present} из {reportData.attendance.total} уроков</p>
              </CardContent>
            </Card>
            <Card className="bg-green-50 border-green-100">
              <CardContent className="p-6 text-center">
                <p className="text-sm font-medium text-green-600 mb-2">Домашние задания</p>
                <div className="text-4xl font-bold text-green-900 mb-1">{reportData.homework.rate}%</div>
                <p className="text-xs text-green-600">Выполнено {reportData.homework.done} из {reportData.homework.total} заданий</p>
              </CardContent>
            </Card>
            <Card className="bg-purple-50 border-purple-100">
              <CardContent className="p-6 text-center">
                <p className="text-sm font-medium text-purple-600 mb-2">Пробное ЕНТ ({monthLabel})</p>
                <div className="flex justify-center items-center gap-2 mb-1">
                  <div className="text-4xl font-bold text-purple-900">{reportData.ent.current > 0 ? reportData.ent.current : '—'}</div>
                  {reportData.ent.prev > 0 && reportData.ent.current > 0 && (
                    <div className={`flex items-center text-sm font-medium ${reportData.ent.current > reportData.ent.prev ? 'text-green-600' : reportData.ent.current < reportData.ent.prev ? 'text-red-600' : 'text-gray-500'}`}>
                      {reportData.ent.current > reportData.ent.prev ? <TrendingUp className="w-4 h-4 mr-1" /> : reportData.ent.current < reportData.ent.prev ? <TrendingDown className="w-4 h-4 mr-1" /> : <Minus className="w-4 h-4 mr-1" />}
                      {Math.abs(reportData.ent.current - reportData.ent.prev)}
                    </div>
                  )}
                </div>
                <p className="text-xs text-purple-600">
                  В прошлом месяце: {reportData.ent.prev > 0 ? reportData.ent.prev : 'Нет данных'}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Детализация уроков</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-60 overflow-y-auto pr-2 space-y-2">
                  {reportData.attendance.list.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">Нет записей об уроках в этом месяце</p>
                  ) : (
                    reportData.attendance.list.map((att: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded bg-gray-50 text-sm">
                        <div className="font-medium w-24">{new Date(att.date).toLocaleDateString('ru-RU')}</div>
                        <div className="flex-1 truncate px-2 text-gray-600" title={att.subject_name}>{att.subject_name}</div>
                        <div className="flex gap-2">
                          {att.status === 'present' ? <CheckCircle2 className="w-4 h-4 text-green-500" title="Присутствовал" /> : <XCircle className="w-4 h-4 text-red-500" title="Отсутствовал" />}
                          {att.homework === 'done' ? <FileText className="w-4 h-4 text-green-500" title="ДЗ Выполнено" /> : att.homework === 'not_done' ? <FileText className="w-4 h-4 text-red-500" title="ДЗ Не выполнено" /> : <FileText className="w-4 h-4 text-gray-300" title="Нет ДЗ" />}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Отзывы преподавателей</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-60 overflow-y-auto pr-2 space-y-3">
                  {reportData.feedback.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">Нет отзывов в этом месяце</p>
                  ) : (
                    reportData.feedback.map((fb: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-lg border bg-amber-50/50">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium text-sm text-gray-900">{fb.subject_name || 'Общее'}</span>
                          <span className="text-xs text-gray-500">{fb.teacher_name}</span>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{fb.comment}</p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-blue-200 shadow-md">
            <CardHeader className="bg-blue-50/50 border-b border-blue-100 rounded-t-xl pb-4">
              <CardTitle className="text-xl flex items-center">
                <FileText className="w-5 h-5 mr-2 text-blue-600" />
                Итоги собрания (для родителя и учителя)
              </CardTitle>
              <CardDescription>Опишите решения, договоренности и рекомендации по итогам месяца.</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <textarea
                value={outcomes}
                onChange={e => setOutcomes(e.target.value)}
                placeholder="Введите итоги собрания..."
                className="w-full min-h-[200px] p-4 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
              />
            </CardContent>
            <div className="p-4 border-t bg-gray-50 rounded-b-xl flex justify-end">
              <Button onClick={handleSaveAndDownload} disabled={saving} className="gap-2" size="lg">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Сохранить и скачать PDF
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {/* Hidden PDF Layout */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
        {reportData && (
          <div ref={pdfRef} className="bg-white text-slate-900 font-sans shadow-2xl relative overflow-hidden" style={{ width: '800px', minHeight: '1131px' }}>
            
            {/* Header Background */}
            <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 z-0"></div>

            <div className="relative z-10 px-10 pt-10 pb-8">
              {/* BRANDING */}
              <div className="flex justify-between items-start mb-6 text-white">
                <div>
                  <h1 className="text-4xl font-black uppercase tracking-widest drop-shadow-md">TODAY UBT</h1>
                  <p className="text-blue-200 text-sm tracking-[0.2em] font-semibold mt-1">АКАДЕМИЧЕСКИЙ ОТЧЕТ</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-blue-100 font-medium">Отчетный период</p>
                  <p className="text-xl font-bold">{monthLabel}</p>
                </div>
              </div>

              {/* STUDENT PROFILE CARD */}
              <div className="bg-white rounded-2xl shadow-lg p-6 flex justify-between items-center border border-slate-100">
                <div>
                  <p className="text-sm text-slate-400 font-bold uppercase tracking-wider mb-1">Ученик</p>
                  <h2 className="text-2xl font-bold text-slate-800">{studentName}</h2>
                </div>
                <div className="text-right border-l-2 border-slate-100 pl-6">
                  <p className="text-sm text-slate-400 font-bold uppercase tracking-wider mb-1">Группа</p>
                  <h2 className="text-2xl font-bold text-indigo-600">{groupName}</h2>
                </div>
              </div>
            </div>

            <div className="px-10 pb-10">
              {/* KEY METRICS */}
              <div className="grid grid-cols-3 gap-6 mb-8 mt-2">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 p-5 rounded-2xl border border-blue-100/50 shadow-sm relative overflow-hidden">
                  <div className="absolute -right-4 -bottom-4 opacity-5">
                     <span className="text-9xl font-black">%</span>
                  </div>
                  <p className="text-xs text-blue-800 font-bold mb-2 uppercase tracking-widest">Посещаемость</p>
                  <p className="text-4xl font-black text-blue-900">{reportData.attendance.rate}%</p>
                  <p className="text-sm text-blue-700/80 mt-2 font-medium">{reportData.attendance.present} из {reportData.attendance.total} уроков</p>
                </div>

                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-5 rounded-2xl border border-emerald-100/50 shadow-sm relative overflow-hidden">
                  <div className="absolute -right-4 -bottom-4 opacity-5">
                     <span className="text-9xl font-black">✓</span>
                  </div>
                  <p className="text-xs text-emerald-800 font-bold mb-2 uppercase tracking-widest">Выполнение ДЗ</p>
                  <p className="text-4xl font-black text-emerald-900">{reportData.homework.rate}%</p>
                  <p className="text-sm text-emerald-700/80 mt-2 font-medium">{reportData.homework.done} из {reportData.homework.total} заданий</p>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 p-5 rounded-2xl border border-purple-100/50 shadow-sm relative overflow-hidden">
                   <div className="absolute -right-4 -bottom-4 opacity-5">
                     <span className="text-9xl font-black">★</span>
                  </div>
                  <p className="text-xs text-purple-800 font-bold mb-2 uppercase tracking-widest">ЕНТ Балл</p>
                  <div className="flex items-end gap-3">
                    <p className="text-4xl font-black text-purple-900">{reportData.ent.current > 0 ? reportData.ent.current : '—'}</p>
                    {reportData.ent.current > 0 && reportData.ent.prev > 0 && (
                       <span className={`text-sm font-bold mb-1 ${reportData.ent.current > reportData.ent.prev ? 'text-emerald-600' : reportData.ent.current < reportData.ent.prev ? 'text-red-500' : 'text-slate-500'}`}>
                         {reportData.ent.current > reportData.ent.prev ? '+' : ''}{reportData.ent.current - reportData.ent.prev}
                       </span>
                    )}
                  </div>
                  <p className="text-sm text-purple-700/80 mt-2 font-medium">
                    Прошлый месяц: <span className="font-bold">{reportData.ent.prev > 0 ? reportData.ent.prev : '—'}</span>
                  </p>
                </div>
              </div>

              {/* TWO COLUMNS: Attendance Details & Feedback */}
              <div className="grid grid-cols-[1.2fr_1fr] gap-8 mb-8" style={{ pageBreakInside: 'avoid' }}>
                {/* ATTENDANCE TABLE */}
                <div>
                  <h3 className="font-bold text-slate-800 pb-2 mb-4 uppercase tracking-widest text-xs flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                    Детализация посещаемости
                  </h3>
                  <div className="rounded-xl overflow-hidden border border-slate-200">
                    <table className="w-full text-[11px] text-left">
                      <thead className="bg-slate-100 text-slate-600 uppercase tracking-wider font-semibold">
                        <tr>
                          <th className="py-2.5 px-3">Дата</th>
                          <th className="py-2.5 px-3">Предмет</th>
                          <th className="py-2.5 px-3 text-center">Урок</th>
                          <th className="py-2.5 px-3 text-center">ДЗ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {reportData.attendance.list.slice(0, 15).map((att: any, idx: number) => (
                          <tr key={idx} className="bg-white even:bg-slate-50/50">
                            <td className="py-2.5 px-3 font-medium">{new Date(att.date).toLocaleDateString('ru-RU')}</td>
                            <td className="py-2.5 px-3 truncate max-w-[110px] text-slate-700">{att.subject_name}</td>
                            <td className="py-2.5 px-3 text-center">
                              {att.status === 'present' 
                                ? <span className="inline-block w-4 h-4 rounded bg-emerald-100 text-emerald-700 font-bold leading-4">+</span>
                                : <span className="inline-block w-4 h-4 rounded bg-red-100 text-red-700 font-bold leading-4">-</span>}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {att.homework === 'done' 
                                ? <span className="inline-block w-4 h-4 rounded bg-emerald-100 text-emerald-700 font-bold leading-4">+</span>
                                : att.homework === 'not_done' 
                                  ? <span className="inline-block w-4 h-4 rounded bg-red-100 text-red-700 font-bold leading-4">-</span>
                                  : <span className="text-slate-300">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {reportData.attendance.list.length > 15 && (
                    <p className="text-[10px] text-slate-400 mt-2 italic">* Показаны только первые 15 занятий в месяце</p>
                  )}
                </div>
                
                {/* TEACHER FEEDBACK */}
                <div>
                  <h3 className="font-bold text-slate-800 pb-2 mb-4 uppercase tracking-widest text-xs flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500 inline-block"></span>
                    Отзывы преподавателей
                  </h3>
                  <div className="space-y-3">
                    {reportData.feedback.length === 0 ? (
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                        <p className="text-xs text-slate-500 italic">Преподаватели пока не оставили отзывов за этот месяц.</p>
                      </div>
                    ) : (
                      reportData.feedback.slice(0, 4).map((fb: any, idx: number) => (
                        <div key={idx} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm relative">
                          <div className="absolute top-3 left-0 w-1 h-8 bg-indigo-500 rounded-r"></div>
                          <p className="font-bold text-slate-800 text-[11px] uppercase tracking-wider mb-1 pl-2">
                            {fb.subject_name} 
                            <span className="font-normal text-slate-500 normal-case ml-1">({fb.teacher_name})</span>
                          </p>
                          <p className="text-slate-700 text-xs leading-relaxed pl-2">{fb.comment}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* OUTCOMES / RECOMMENDATIONS */}
              <div style={{ pageBreakInside: 'avoid' }} className="mt-8 relative">
                <h3 className="font-bold text-slate-800 pb-2 mb-4 uppercase tracking-widest text-xs flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                   Итоги собрания и рекомендации
                </h3>
                <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-md min-h-[120px] relative overflow-hidden">
                  <div className="absolute right-0 top-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-10 -mt-10"></div>
                  <p className="text-slate-100 whitespace-pre-wrap leading-relaxed text-sm relative z-10">
                    {outcomes || "Комментарии по итогам собрания отсутствуют."}
                  </p>
                </div>
              </div>

              {/* FOOTER */}
              <div className="mt-12 pt-4 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400 font-medium tracking-wider uppercase">
                <p>Сгенерировано автоматически системой TODAY UBT</p>
                <p>Дата формирования: {new Date().toLocaleDateString('ru-RU')}</p>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}