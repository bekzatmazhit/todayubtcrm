import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { GraduationCap, CheckCircle2, CircleCheck, Circle, Edit } from "lucide-react";
import { updateTeacherFeedback } from "@/lib/api";

interface TeacherFeedbackTabProps {
  teacherFbData: any;
  teacherFbLoading: boolean;
  locale: string;
  onUpdate: () => void;
}

export function TeacherFeedbackTab({ teacherFbData, teacherFbLoading, locale, onUpdate }: TeacherFeedbackTabProps) {
  const [editingFbId, setEditingFbId] = useState<number | null>(null);
  const [editingFbText, setEditingFbText] = useState("");

  const handleSaveTeacherFb = async (taskId: number, comment: string) => {
    await updateTeacherFeedback(taskId, comment);
    setEditingFbId(null);
    setEditingFbText("");
    onUpdate();
  };

  if (teacherFbLoading) {
    return <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>;
  }

  if (!teacherFbData || teacherFbData.total === 0) {
    return (
      <Card className="text-center py-16">
        <CardContent>
          <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground/20 mb-3" />
          <p className="text-muted-foreground">У вас нет учеников по расписанию за текущий месяц</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="mb-5">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-semibold">
                Отзывы по ученикам за {new Date(teacherFbData.month + "-01").toLocaleDateString(locale, { month: "long", year: "numeric" })}
              </p>
              <p className="text-xs text-muted-foreground">
                Напишите отзыв по каждому ученику — кураторы передадут родителям
              </p>
            </div>
            <Badge
              variant={teacherFbData.completed === teacherFbData.total ? "default" : "outline"}
              className={`text-sm px-3 py-1 ${teacherFbData.completed === teacherFbData.total ? "bg-green-600" : ""}`}
            >
              {teacherFbData.completed}/{teacherFbData.total}
            </Badge>
          </div>
          <Progress value={teacherFbData.total > 0 ? Math.round(teacherFbData.completed / teacherFbData.total * 100) : 0} className="h-2.5" />
          <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
            <span>{Math.round(teacherFbData.completed / teacherFbData.total * 100)}%</span>
            {teacherFbData.completed === teacherFbData.total
              ? <span className="text-green-600 font-medium flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Все заполнено!</span>
              : <span className="text-orange-600">Осталось: {teacherFbData.total - teacherFbData.completed}</span>
            }
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {teacherFbData.tasks.map((t: any) => {
          const hasComment = t.comment && t.comment.trim().length > 0;
          const isEditing = editingFbId === t.id;
          return (
            <Card key={t.id} className={hasComment ? "border-green-300/50 bg-green-50/20 dark:border-green-800/30 dark:bg-green-900/5" : ""}>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {hasComment
                      ? <CircleCheck className="h-4 w-4 text-green-600 shrink-0" />
                      : <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    }
                    <span className="text-sm font-medium">{t.full_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{t.group_name}</Badge>
                    {t.subject_name && <Badge variant="secondary" className="text-xs">{t.subject_name}</Badge>}
                  </div>
                </div>

                {isEditing ? (
                  <div className="space-y-2 mt-2">
                    <Textarea
                      value={editingFbText}
                      onChange={(e) => setEditingFbText(e.target.value)}
                      placeholder="Напишите отзыв об ученике: успеваемость, поведение, рекомендации..."
                      rows={3}
                      className="text-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleSaveTeacherFb(t.id, editingFbText)}
                        disabled={!editingFbText.trim()}
                      >
                        Сохранить
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setEditingFbId(null); setEditingFbText(""); }}
                      >
                        Отмена
                      </Button>
                    </div>
                  </div>
                ) : hasComment ? (
                  <div className="mt-1">
                    <p className="text-sm text-muted-foreground">{t.comment}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1 h-6 text-xs gap-1 px-2"
                      onClick={() => { setEditingFbId(t.id); setEditingFbText(t.comment); }}
                    >
                      <Edit className="h-3 w-3" />Редактировать
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-1 text-xs gap-1"
                    onClick={() => { setEditingFbId(t.id); setEditingFbText(""); }}
                  >
                    <Edit className="h-3 w-3" />Написать отзыв
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
