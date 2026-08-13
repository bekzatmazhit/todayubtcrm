import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { 
  PhoneCall, 
  CircleCheck, 
  Circle, 
  RotateCcw, 
  ExternalLink,
  CheckCircle2
} from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { GroupPersonAvatar } from "@/components/GroupPersonAvatar";
import { formatPhone } from "@/lib/utils";
import { getWhatsAppLink } from "../index";
import { updateCallTask } from "@/lib/api";

export function CallTasksTab({
  callTasksData,
  callTasksLoading,
  locale,
  onUpdate
}: {
  callTasksData: any;
  callTasksLoading: boolean;
  locale: string;
  onUpdate: () => void;
}) {
  const [callDialogTask, setCallDialogTask] = useState<any>(null);
  const [callDialogResult, setCallDialogResult] = useState("");
  const [callDialogNotes, setCallDialogNotes] = useState("");

  const handleCompleteCall = async (taskId: number, call_result: string, notes: string) => {
    await updateCallTask(taskId, { status: "completed", call_result, notes });
    onUpdate();
  };

  const handleUncompleteCall = async (taskId: number) => {
    await updateCallTask(taskId, { status: "pending" });
    onUpdate();
  };

  const openCallDialog = (task: any) => {
    setCallDialogTask(task);
    setCallDialogResult("");
    setCallDialogNotes(task.notes || "");
  };

  const closeCallDialog = () => {
    setCallDialogTask(null);
    setCallDialogResult("");
    setCallDialogNotes("");
  };

  return (
    <>
      {callTasksLoading ? (
        <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
      ) : !callTasksData || callTasksData.total === 0 ? (
        <div className="flex flex-col items-center py-16 text-muted-foreground">
          <PhoneCall className="h-10 w-10 mb-2 opacity-30" />
          <p className="text-sm">Нет учеников для обзвона</p>
        </div>
      ) : (
        <>
          {/* Progress header */}
          <Card className="mb-5">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold">Обзвон родителей за {new Date(callTasksData.month + "-01").toLocaleDateString(locale, { month: "long", year: "numeric" })}</p>
                  <p className="text-xs text-muted-foreground">Необходимо обзвонить всех родителей каждый месяц</p>
                </div>
                <Badge
                  variant={callTasksData.completed === callTasksData.total ? "default" : "outline"}
                  className={`text-sm px-3 py-1 ${callTasksData.completed === callTasksData.total ? "bg-green-600" : ""}`}
                >
                  {callTasksData.completed}/{callTasksData.total}
                </Badge>
              </div>
              <Progress value={callTasksData.total > 0 ? Math.round(callTasksData.completed / callTasksData.total * 100) : 0} className="h-2.5" />
              <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
                <span>{Math.round(callTasksData.completed / callTasksData.total * 100)}%</span>
                {callTasksData.completed === callTasksData.total
                  ? <span className="text-green-600 font-medium flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Все обзвонены!</span>
                  : <span className="text-orange-600">Осталось: {callTasksData.total - callTasksData.completed}</span>
                }
              </div>
            </CardContent>
          </Card>

          {/* Call tasks list */}
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Ученик</TableHead>
                  <TableHead>Группа</TableHead>
                  <TableHead>Имя родителя</TableHead>
                  <TableHead>Тел. родителя</TableHead>
                  <TableHead>Итог</TableHead>
                  <TableHead>Комментарий</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {callTasksData.tasks.map((t: any) => {
                  const waLink = getWhatsAppLink(t.parent_phone, t.full_name, t.group_name || "");
                  const isDone = t.status === "completed";
                  return (
                    <TableRow key={t.id} className={isDone ? "bg-green-50/50 dark:bg-green-900/10" : ""}>
                      <TableCell>
                        {isDone
                          ? <CircleCheck className="h-5 w-5 text-green-600" />
                          : <Circle className="h-5 w-5 text-muted-foreground/40" />
                        }
                      </TableCell>
                      <TableCell className={`font-medium text-sm ${isDone ? "line-through text-muted-foreground" : ""}`}>
                        <span className="flex items-center gap-2">
                          <UserAvatar user={t} size="xs" />
                          {t.full_name}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs flex w-max items-center gap-1.5 px-2 py-0.5">
                          <GroupPersonAvatar groupName={t.group_name} avatarUrl={t.group_avatar} size={14} showTooltip={false} />
                          {t.group_name}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{t.parent_name || <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                      <TableCell className="text-sm">{t.parent_phone ? formatPhone(t.parent_phone) : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                      <TableCell>
                        {t.call_result ? (
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              t.call_result === "Все хорошо" ? "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400" :
                              t.call_result === "Перезвонить" ? "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400" :
                              t.call_result === "Не ответил" ? "bg-muted text-muted-foreground" :
                              t.call_result === "Есть проблемы" ? "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400" : ""
                            }`}
                          >
                            {t.call_result}
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {t.notes ? (
                          <span className="text-xs text-muted-foreground">{t.notes}</span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {waLink ? (
                          <a href={waLink} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm" className="h-7 text-xs text-green-700 border-green-300 hover:bg-green-50 gap-1">
                              <ExternalLink className="h-3 w-3" />WA
                            </Button>
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isDone ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1 text-muted-foreground"
                            onClick={() => handleUncompleteCall(t.id)}
                          >
                            <RotateCcw className="h-3 w-3" />Отменить
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => openCallDialog(t)}
                          >
                            <PhoneCall className="h-3 w-3" />Обзвонил
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Call Confirmation Dialog */}
      {callDialogTask && (
        <Dialog open onOpenChange={(open) => !open && closeCallDialog()}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PhoneCall className="h-5 w-5 text-primary" />
                Подтверждение обзвона
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <p className="text-sm font-medium">{callDialogTask.full_name}</p>
                <p className="text-xs text-muted-foreground">{callDialogTask.group_name}</p>
                {callDialogTask.parent_name && (
                  <p className="text-xs text-muted-foreground">Родитель: {callDialogTask.parent_name}</p>
                )}
                {callDialogTask.parent_phone && (
                  <p className="text-xs text-muted-foreground">Тел: {formatPhone(callDialogTask.parent_phone)}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Итог обзвона <span className="text-red-500">*</span></Label>
                <Select value={callDialogResult} onValueChange={setCallDialogResult}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите итог..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Все хорошо">Все хорошо</SelectItem>
                    <SelectItem value="Перезвонить">Перезвонить</SelectItem>
                    <SelectItem value="Не ответил">Не ответил</SelectItem>
                    <SelectItem value="Есть проблемы">Есть проблемы</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Комментарий <span className="text-red-500">*</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    ({callDialogNotes.trim().length}/20 мин.)
                  </span>
                </Label>
                <Textarea
                  value={callDialogNotes}
                  onChange={(e) => setCallDialogNotes(e.target.value)}
                  placeholder="Опишите результат разговора с родителем (минимум 20 символов)..."
                  rows={3}
                  className="text-sm"
                />
                {callDialogNotes.trim().length > 0 && callDialogNotes.trim().length < 20 && (
                  <p className="text-xs text-red-500">Минимум 20 символов</p>
                )}
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button variant="ghost" onClick={closeCallDialog}>Отмена</Button>
                <Button
                  disabled={!callDialogResult || callDialogNotes.trim().length < 20}
                  onClick={async () => {
                    await handleCompleteCall(callDialogTask.id, callDialogResult, callDialogNotes.trim());
                    closeCallDialog();
                  }}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Подтвердить
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
