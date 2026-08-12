import React from 'react';

interface ReportPDFTemplateProps {
  studentName: string;
  groupName: string;
  monthLabel: string;
  attendance: {
    rate: number;
    present: number;
    total: number;
    list: any[];
  };
  homework: {
    rate: number;
    done: number;
    total: number;
  };
  ent: {
    current: number;
    prev: number;
    list?: any[];
  };
  teacherSummary: string;
  outcomes: string;
}

// ── Color palette ──
const C = {
  bg: '#FFFFFF',
  surface: '#F8FAFC',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  accent: '#4F46E5',
  accentLight: '#EEF2FF',
  green: '#059669',
  greenLight: '#ECFDF5',
  red: '#DC2626',
  amber: '#D97706',
  amberLight: '#FFFBEB',
};

const font = "'Inter', 'Segoe UI', -apple-system, sans-serif";

// ── Reusable style fragments ──
const cardStyle: React.CSSProperties = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: '12px',
  padding: '20px',
  textAlign: 'center' as const,
};

const metricCardStyle: React.CSSProperties = {
  flex: 1,
  background: C.bg,
  border: `1px solid ${C.border}`,
  borderRadius: '12px',
  padding: '20px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
};

function getAttendanceColor(rate: number) {
  if (rate >= 85) return C.green;
  if (rate >= 60) return C.amber;
  return C.red;
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ width: '100%', height: '6px', background: C.borderLight, borderRadius: '3px', marginTop: '8px' }}>
      <div style={{ width: `${Math.min(value, 100)}%`, height: '6px', background: color, borderRadius: '3px', transition: 'width 0.3s' }} />
    </div>
  );
}

export default function ReportPDFTemplate({
  studentName,
  groupName,
  monthLabel,
  attendance,
  homework,
  ent,
  teacherSummary,
  outcomes,
}: ReportPDFTemplateProps) {

  // Group attendance by subject
  const subjectAttendance = attendance?.list && attendance.list.length > 0
    ? Object.entries(
        attendance.list.reduce((acc, item) => {
          const subj = item.subject_name || 'Общее';
          if (!acc[subj]) acc[subj] = { present: 0, total: 0 };
          acc[subj].total++;
          if (item.status === 'present') acc[subj].present++;
          return acc;
        }, {} as Record<string, { present: number; total: number }>)
      )
    : [];

  return (
    <div
      style={{
        width: '794px',           // A4 @ 96 DPI
        minHeight: '1123px',
        background: C.bg,
        fontFamily: font,
        color: C.text,
        padding: '48px 52px',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >

      {/* ═══════ HEADER ═══════ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', paddingBottom: '24px', borderBottom: `2px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '56px', height: '56px', background: 'linear-gradient(135deg, #1E293B, #334155)',
            borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 900, fontSize: '22px', letterSpacing: '-1px',
          }}>
            TD
          </div>
          <div>
            <div style={{ fontSize: '26px', fontWeight: 900, color: C.text, letterSpacing: '-0.5px', textTransform: 'uppercase' as const }}>
              TODAY
            </div>
            <div style={{ fontSize: '10px', fontWeight: 600, color: C.textMuted, letterSpacing: '3px', textTransform: 'uppercase' as const, marginTop: '2px' }}>
              Образовательный Центр
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' as const, fontSize: '12px', color: C.textSecondary, lineHeight: '1.6' }}>
          <div style={{ fontWeight: 600, color: C.text }}>today-edu.kz</div>
          <div>+7 (777) 123-45-67</div>
          <div>info@today-edu.kz</div>
        </div>
      </div>

      {/* ═══════ TITLE BANNER ═══════ */}
      <div style={{
        background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
        borderRadius: '16px', padding: '28px 32px', marginBottom: '28px',
        color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase' as const, opacity: 0.7, marginBottom: '6px' }}>
            Персональный отчет
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.3px' }}>
            {studentName}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '24px' }}>
          <div style={{ textAlign: 'center' as const }}>
            <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase' as const, opacity: 0.6, marginBottom: '4px' }}>Месяц</div>
            <div style={{ fontSize: '16px', fontWeight: 700 }}>{monthLabel}</div>
          </div>
          <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)' }} />
          <div style={{ textAlign: 'center' as const }}>
            <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase' as const, opacity: 0.6, marginBottom: '4px' }}>Группа</div>
            <div style={{ fontSize: '16px', fontWeight: 700 }}>{groupName}</div>
          </div>
        </div>
      </div>

      {/* ═══════ KEY METRICS ═══════ */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
        
        {/* Attendance Metric */}
        <div style={metricCardStyle}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: C.textSecondary, textTransform: 'uppercase' as const, letterSpacing: '1px', marginBottom: '8px' }}>
            Посещаемость
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: attendance ? getAttendanceColor(attendance.rate) : C.text, letterSpacing: '-1px' }}>
            {attendance?.rate ?? 0}%
          </div>
          <ProgressBar value={attendance?.rate ?? 0} color={attendance ? getAttendanceColor(attendance.rate) : C.text} />
          <div style={{ fontSize: '11px', color: C.textMuted, marginTop: '10px', fontWeight: 500 }}>
            Посещено занятий: {attendance?.present ?? 0} из {attendance?.total ?? 0}
          </div>
        </div>

        {/* Homework */}
        <div style={{ ...cardStyle, flex: 1 }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, letterSpacing: '1.5px', textTransform: 'uppercase' as const, marginBottom: '10px' }}>
            Домашние задания
          </div>
          <div style={{ fontSize: '36px', fontWeight: 900, color: C.accent, lineHeight: 1, marginBottom: '4px' }}>
            {homework.rate}%
          </div>
          <div style={{ fontSize: '11px', color: C.textSecondary, marginBottom: '4px' }}>
            {homework.done} из {homework.total} ДЗ
          </div>
          <ProgressBar value={homework.rate} color={C.accent} />
        </div>
        {/* ENT Metric */}
        <div style={{ ...cardStyle, flex: 1 }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, letterSpacing: '1.5px', textTransform: 'uppercase' as const, marginBottom: '10px' }}>
            Средний балл ЕНТ
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '36px', fontWeight: 900, color: C.text, lineHeight: 1 }}>
              {ent.current > 0 ? ent.current : '—'}
            </span>
            {ent.current > 0 && ent.prev > 0 && (
              <span style={{
                fontSize: '13px', fontWeight: 700,
                color: ent.current > ent.prev ? C.green : ent.current < ent.prev ? C.red : C.textMuted,
                background: ent.current > ent.prev ? C.greenLight : ent.current < ent.prev ? '#FEF2F2' : C.surface,
                padding: '2px 8px', borderRadius: '6px',
              }}>
                {ent.current > ent.prev ? '↑' : ent.current < ent.prev ? '↓' : '='} {Math.abs(ent.current - ent.prev)}
              </span>
            )}
          </div>
          <div style={{ fontSize: '11px', color: C.textSecondary }}>
            Прошлый: {ent.prev > 0 ? ent.prev : '—'}
          </div>
        </div>
      </div>

      {/* ═══════ ENT RESULTS TABLE ═══════ */}
      {ent.list && ent.list.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: C.textMuted, letterSpacing: '1.5px', textTransform: 'uppercase' as const, marginBottom: '12px', paddingBottom: '8px', borderBottom: `1px solid ${C.borderLight}` }}>
            Результаты ЕНТ по предметам
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {ent.list.map((item, idx) => (
              <div key={idx} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: C.surface, padding: '10px 14px', borderRadius: '8px', border: `1px solid ${C.borderLight}`,
              }}>
                <span style={{ fontSize: '12px', fontWeight: 500, color: C.textSecondary }}>{item.subject_name || 'Предмет'}</span>
                <span style={{ fontSize: '14px', fontWeight: 800, color: C.text }}>{item.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════ ATTENDANCE BY SUBJECT ═══════ */}
      {subjectAttendance.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: C.textMuted, letterSpacing: '1.5px', textTransform: 'uppercase' as const, marginBottom: '12px', paddingBottom: '8px', borderBottom: `1px solid ${C.borderLight}` }}>
            Посещаемость по предметам
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {subjectAttendance.map(([subj, stats], idx) => {
              const pct = Math.round((stats.present / stats.total) * 100);
              return (
                <div key={idx} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: C.surface, padding: '10px 14px', borderRadius: '8px', border: `1px solid ${C.borderLight}`,
                }}>
                  <span style={{ fontSize: '12px', fontWeight: 500, color: C.textSecondary }}>{subj}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: C.text }}>{stats.present}/{stats.total}</span>
                    <span style={{
                      fontSize: '11px', fontWeight: 700,
                      color: getAttendanceColor(pct),
                      background: pct >= 85 ? C.greenLight : pct >= 60 ? C.amberLight : '#FEF2F2',
                      padding: '2px 6px', borderRadius: '4px',
                    }}>{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════ TEACHER SUMMARY ═══════ */}
      {teacherSummary && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: C.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px',
            }}>👨‍🏫</div>
            <span style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>Отзывы преподавателей</span>
          </div>
          <div style={{
            background: C.surface, border: `1px solid ${C.borderLight}`,
            borderRadius: '12px', padding: '18px 20px',
            fontSize: '12px', color: C.textSecondary, lineHeight: '1.7', whiteSpace: 'pre-wrap' as const,
          }}>
            {teacherSummary}
          </div>
        </div>
      )}

      {/* ═══════ OUTCOMES ═══════ */}
      {outcomes && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: C.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px',
            }}>📝</div>
            <span style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>Рекомендации куратора</span>
          </div>
          <div style={{
            background: C.surface, border: `1px solid ${C.borderLight}`,
            borderRadius: '12px', padding: '18px 20px',
            fontSize: '12px', color: C.textSecondary, lineHeight: '1.7', whiteSpace: 'pre-wrap' as const,
          }}>
            {outcomes}
          </div>
        </div>
      )}

      {/* ═══════ FOOTER ═══════ */}
      <div style={{
        marginTop: '40px', paddingTop: '20px', borderTop: `1px solid ${C.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
      }}>
        <div>
          <div style={{ fontSize: '9px', fontWeight: 600, color: C.textMuted, letterSpacing: '1.5px', textTransform: 'uppercase' as const, marginBottom: '4px' }}>
            Сгенерировано системой TODAY CRM
          </div>
          <div style={{ fontSize: '11px', color: C.textSecondary }}>
            Дата: {new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
        </div>
        <div style={{ textAlign: 'right' as const }}>
          <div style={{ width: '180px', borderBottom: `1px solid ${C.textMuted}`, marginBottom: '6px' }} />
          <div style={{ fontSize: '9px', fontWeight: 600, color: C.textMuted, letterSpacing: '1.5px', textTransform: 'uppercase' as const }}>
            Подпись куратора
          </div>
        </div>
      </div>
    </div>
  );
}
