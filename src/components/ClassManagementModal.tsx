import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, BookOpen, BookX, BookMarked, Save } from "lucide-react";
import { Lesson, Student } from "@/data/mockSchedule";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { updateAttendance } from "@/lib/api";

interface Props {
  lesson: Lesson | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date?: string; // YYYY-MM-DD
  onSaved?: (info: { schedule_id: number | null; date: string }) => void;
}

export function ClassManagementModal({ lesson, open, onOpenChange, date, onSaved }: Props) {
  const [students, setStudents] = useState<Student[]>([]);
  const [saving, setSaving] = useState(false);
  const { t } = useTranslation();

  // Sync students when lesson changes
  useEffect(() => {
    if (lesson && open) {
      setStudents(lesson.students.map((s) => ({ ...s })));
    }
  }, [lesson?.id, open]);

  const updateStudentLocal = (id: string, updates: Partial<Student>) => {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  // Extract schedule_id from lesson.id (format: "lesson-{scheduleId}")
  const getScheduleId = () => {
    if (!lesson) return null;
    const match = lesson.id.match(/lesson-(\d+)/);
    return match ? parseInt(match[1]) : null;
  };

  // Extract numeric student_id from student.id (format: "s-{studentId}")
  const getStudentId = (sid: string) => {
    const match = sid.match(/s-(\d+)/);
    return match ? parseInt(match[1]) : null;
  };

  const handleSave = async () => {
    if (!lesson) return;
    setSaving(true);
    const scheduleId = getScheduleId();
    const dateStr = date || new Date().toISOString().slice(0, 10);
    try {
      const promises = students.map((student) => {
        const studentId = getStudentId(student.id);
        if (!studentId) return Promise.resolve(null);
        return updateAttendance(studentId, 0, {
          schedule_id: scheduleId,
          date: dateStr,
          status: student.attendance,
          lateness: student.lateness,
          homework: student.homework,
          comment: student.comment || null,
        });
      });
      await Promise.all(promises);
      toast.success(t("Attendance saved successfully!"));
      onSaved?.({ schedule_id: scheduleId, date: dateStr });
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving attendance:", error);
      toast.error("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  if (!lesson) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] md:max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">{t("Class Management")}</DialogTitle>
        </DialogHeader>

        {/* Header info */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Badge variant="default">{lesson.group_name}</Badge>
          <Badge variant="secondary">{lesson.subject}</Badge>
          <Badge variant="outline">{lesson.room}</Badge>
          <Badge variant="outline">{lesson.time_slot}</Badge>
        </div>

        {/* Student table */}
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted">
                <th className="text-left p-2 md:p-3 font-semibold text-foreground">{t("#")}</th>
                <th className="text-left p-2 md:p-3 font-semibold text-foreground">{t("Student")}</th>
                <th className="text-center p-2 md:p-3 font-semibold text-foreground">{t("Attendance")}</th>
                <th className="text-center p-2 md:p-3 font-semibold text-foreground hidden md:table-cell">{t("Lateness")}</th>
                <th className="text-center p-2 md:p-3 font-semibold text-foreground hidden sm:table-cell">{t("Homework")}</th>
                <th className="text-left p-2 md:p-3 font-semibold text-foreground hidden md:table-cell">{t("Comment")}</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student, idx) => (
                <tr key={student.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="p-2 md:p-3 text-muted-foreground">{idx + 1}</td>
                  <td className="p-2 md:p-3 font-medium text-foreground">{student.full_name}</td>
                  <td className="p-2 md:p-3 text-center">
                    <button
                      onClick={() => updateStudentLocal(student.id, { attendance: student.attendance === "present" ? "absent" : "present" })}
                      className="transition-transform hover:scale-110"
                    >
                      {student.attendance === "present" ? (
                        <CheckCircle2 className="h-6 w-6 text-success mx-auto" />
                      ) : (
                        <XCircle className="h-6 w-6 text-destructive mx-auto" />
                      )}
                    </button>
                  </td>
                  <td className="p-2 md:p-3 text-center hidden md:table-cell">
                    <Select
                      value={student.lateness}
                      onValueChange={(v) => updateStudentLocal(student.id, { lateness: v as Student["lateness"] })}
                    >
                      <SelectTrigger className="w-28 mx-auto h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="on_time">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {t("On time")}</span>
                        </SelectItem>
                        <SelectItem value="5m">{t("5 min late")}</SelectItem>
                        <SelectItem value="15m_plus">{t("15+ min late")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2 md:p-3 text-center hidden sm:table-cell">
                    <div className="flex items-center justify-center gap-1">
                      {(["done", "partial", "not_done"] as const).map((status) => {
                        const Icon = status === "done" ? BookOpen : status === "partial" ? BookMarked : BookX;
                        const isActive = student.homework === status;
                        const title = status === "done" ? t("Done") : status === "partial" ? t("Partial") : t("Not done");
                        return (
                          <button
                            key={status}
                            onClick={() => updateStudentLocal(student.id, { homework: status })}
                            className={`p-1.5 rounded-md transition-all ${isActive
                              ? status === "done" ? "bg-success/15 text-success" : status === "partial" ? "bg-warning/15 text-warning" : "bg-destructive/15 text-destructive"
                              : "text-muted-foreground hover:bg-muted"}`}
                            title={title}
                          >
                            <Icon className="h-4 w-4" />
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td className="p-2 md:p-3 hidden md:table-cell">
                    <Input
                      value={student.comment}
                      onChange={(e) => updateStudentLocal(student.id, { comment: e.target.value })}
                      placeholder={t("Note...")}
                      className="h-8 text-xs"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end mt-4">
          <Button onClick={handleSave} disabled={saving} size="lg">
            <Save className="mr-2 h-4 w-4" />
            {saving ? t("Saving...") : t("Save Attendance")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
