import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ListTodo, Plus, Trash2, Calendar, User, Paperclip, Clock, AlertCircle,
  MoreVertical, X, Download, MessageSquare, Send, Users, Repeat, CheckSquare,
  Shield, ShieldCheck, ShieldX, RotateCcw, Eye, ChevronDown, UserCheck,
  CheckCircle2, XCircle, ArrowRightCircle, CircleDot, Hourglass,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams } from "react-router-dom";
import { UserAvatar } from "@/components/UserAvatar";
import { MentionInput, RenderMentionText } from "@/components/MentionInput";
import { clearDraft } from "@/lib/drafts";
import i18n from "@/lib/i18n";
import {
  fetchTasks, createTask, updateTask, deleteTask, fetchUsers,
  fetchTaskAttachments, uploadTaskAttachment, deleteTaskAttachment,
  fetchTaskComments, createTaskComment, deleteTaskComment,
  fetchTaskChecklist, addChecklistItem, toggleChecklistItem, deleteChecklistItem,
  processRecurringTasks,
} from "@/lib/api";
import { toast } from "sonner";
import { playSuccess, playDelete } from "@/lib/sounds";

const COLUMNS = [
  { key: "todo",        label: "К выполнению", color: "border-t-blue-400" },
  { key: "in_progress", label: "В процессе",   color: "border-t-yellow-400" },
  { key: "done",        label: "Готово",        color: "border-t-green-500" },
  { key: "archive",     label: "Архив",         color: "border-t-gray-400" },
];

const PRIORITY_OPTIONS = [
  { value: "high",   label: "Высокий",  variant: "destructive" as const },
  { value: "medium", label: "Средний",  variant: "default" as const },
  { value: "low",    label: "Низкий",   variant: "secondary" as const },
];

const CONFIRMATION_LABELS: Record<string, { label: string; variant: string; icon: any; color: string }> = {
  none:       { label: "Не отправлено",  variant: "outline",      icon: CircleDot,  color: "text-muted-foreground" },
  pending:    { label: "На проверке",    variant: "default",      icon: Hourglass,  color: "text-amber-500" },
  confirmed:  { label: "Подтверждено",   variant: "default",      icon: CheckCircle2, color: "text-green-600" },
  rejected:   { label: "Отклонено",      variant: "destructive",  icon: XCircle,    color: "text-destructive" },
};

function priorityLabel(p: string) {
  return PRIORITY_OPTIONS.find((o) => o.value === p)?.label ?? p;
}
function priorityVariant(p: string) {
  return PRIORITY_OPTIONS.find((o) => o.value === p)?.variant ?? ("secondary" as const);
}
function isOverdue(due: string | null, status: string) {
  if (!due || status === "done" || status === "archive") return false;
  return new Date(due) < new Date();
}
function fmtDate(d: string | null) {
  if (!d) return null;
  const locale = { ru: "ru-RU", kk: "kk-KZ", en: "en-US" }[i18n.language] ?? "ru-RU";
  return new Date(d).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}
function fmtDateTime(d: string) {
  const locale = { ru: "ru-RU", kk: "kk-KZ", en: "en-US" }[i18n.language] ?? "ru-RU";
  return new Date(d).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
function relTime(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "только что";
  if (min < 60) return `${min} мин. назад`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ч. назад`;
  const days = Math.floor(hr / 24);
  if (days === 1) return "Вчера";
  if (days < 7) return `${days} дн. назад`;
  return fmtDateTime(d);
}

const DAY_LABELS: Record<number, string> = {
  0: "Воскресенье", 1: "Понедельник", 2: "Вторник", 3: "Среда",
  4: "Четверг", 5: "Пятница", 6: "Суббота",
};

/*  Task Detail Dialog  */

function TaskDetailDialog({
  task, canDelete, currentUserId, users, onClose, onDeleted, onUpdated,
}: { task: any; canDelete: boolean; currentUserId: number; users: any[]; onClose: () => void; onDeleted: () => void; onUpdated: () => void }) {
  const [attachments, setAttachments] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [checklist, setChecklist] = useState<any[]>([]);
  const [newCheckItem, setNewCheckItem] = useState("");
  const [commentText, setCommentText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editingDesc, setEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState(task.description || "");
  const fileRef = useRef<HTMLInputElement>(null);
  const overdue = isOverdue(task.due_date, task.status);
  const assignees: any[] = task.assignees ?? [];
  const isCreator = task.created_by === currentUserId;
  const confirmStatus = task.confirmation_status || "none";
  const confInfo = CONFIRMATION_LABELS[confirmStatus] || CONFIRMATION_LABELS.none;

  useEffect(() => {
    fetchTaskAttachments(task.id).then(setAttachments);
    fetchTaskComments(task.id).then(setComments);
    fetchTaskChecklist(task.id).then(setChecklist);
  }, [task.id]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    await uploadTaskAttachment(task.id, file);
    setAttachments(await fetchTaskAttachments(task.id));
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDeleteAtt = async (id: number) => {
    await deleteTaskAttachment(id);
    setAttachments((a) => a.filter((x) => x.id !== id));
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    await createTaskComment(task.id, { user_id: currentUserId, text: commentText.trim() });
    setComments(await fetchTaskComments(task.id));
    setCommentText("");
    clearDraft(`task-comment-${task.id}`);
    setSubmittingComment(false);
  };

  const handleDeleteComment = async (id: number) => {
    await deleteTaskComment(id);
    setComments((c) => c.filter((x) => x.id !== id));
  };

  const handleAddCheckItem = async () => {
    if (!newCheckItem.trim()) return;
    const item = await addChecklistItem(task.id, newCheckItem.trim());
    if (item) setChecklist((prev) => [...prev, item]);
    setNewCheckItem("");
  };

  const handleToggleCheckItem = async (item: any) => {
    const newVal = item.is_completed ? 0 : 1;
    await toggleChecklistItem(item.id, newVal);
    setChecklist((prev) => prev.map((c) => c.id === item.id ? { ...c, is_completed: newVal } : c));
  };

  const handleDeleteCheckItem = async (id: number) => {
    await deleteChecklistItem(id);
    setChecklist((prev) => prev.filter((c) => c.id !== id));
  };

  const checklistDone = checklist.filter(c => c.is_completed).length;
  const checklistTotal = checklist.length;
  const checklistPercent = checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0;

  const handleConfirm = async () => {
    await updateTask(task.id, { confirmation_status: "confirmed", acting_user_id: currentUserId });
    onUpdated();
    onClose();
  };
  const handleReject = async () => {
    await updateTask(task.id, { confirmation_status: "rejected", rejection_reason: rejectionReason || "Без причины", status: "todo", acting_user_id: currentUserId });
    onUpdated();
    onClose();
  };
  const handleSendForReview = async () => {
    await updateTask(task.id, { confirmation_status: "pending", status: "done" });
    onUpdated();
    onClose();
  };
  const handleReturnToWork = async () => {
    await updateTask(task.id, { confirmation_status: "none", status: "in_progress" });
    onUpdated();
    onClose();
  };
  const isAssignee = assignees.some((a: any) => a.id === currentUserId);
  const handleSaveTitle = async () => {
    if (editTitle.trim() && editTitle !== task.title) await updateTask(task.id, { title: editTitle.trim() });
    setEditingTitle(false);
    onUpdated();
  };
  const handleSaveDesc = async () => {
    if (editDesc !== (task.description || "")) await updateTask(task.id, { description: editDesc });
    setEditingDesc(false);
    onUpdated();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-2 flex-wrap pr-6">
            {editingTitle ? (
              <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} onBlur={handleSaveTitle}
                onKeyDown={e => { if (e.key === "Enter") handleSaveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                autoFocus className="text-lg font-semibold h-8" />
            ) : (
              <span className="flex-1 cursor-pointer hover:text-primary/80 transition-colors"
                onClick={() => canDelete && setEditingTitle(true)}>{task.title}</span>
            )}
            {overdue && <Badge variant="destructive" className="text-xs shrink-0">Просрочено</Badge>}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 pr-1">
          <div className="space-y-5 mt-1 pb-2">
            {editingDesc ? (
              <div className="space-y-1">
                <Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} autoFocus />
                <div className="flex gap-1 justify-end">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingDesc(false)}>Отмена</Button>
                  <Button size="sm" className="h-7 text-xs" onClick={handleSaveDesc}>Сохранить</Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap cursor-pointer hover:bg-muted/30 rounded p-1 -m-1 transition-colors"
                onClick={() => canDelete && setEditingDesc(true)}>
                {task.description || "Нет описания — нажмите чтобы добавить"}
              </p>
            )}

            {/* Creator + Assignees */}
            <div className="space-y-2 text-sm">
              {task.creator_name && (
                <div className="flex items-center gap-2">
                  <UserCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground">Автор:</span>
                  <span className="text-xs font-medium">{task.creator_name}</span>
                </div>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground">Исполнители:</span>
                {assignees.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic">Не назначены</span>
                ) : (
                  assignees.map((a) => (
                    <div key={a.id} className="flex items-center gap-1.5 shrink-0">
                      <UserAvatar user={{ id: a.id, full_name: a.full_name, avatar_url: a.avatar_url }} size="xs" />
                      <span className="text-xs">{a.full_name}</span>
                    </div>
                  ))
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={priorityVariant(task.priority)} className="text-xs">
                  {priorityLabel(task.priority)}
                </Badge>
                {task.is_recurring === 1 && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Repeat className="h-3 w-3" />
                    {DAY_LABELS[task.recurrence_day] || "Повтор"}
                  </Badge>
                )}
                {task.due_date && (
                  <div className={`flex items-center gap-1 ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                    <Clock className="h-3.5 w-3.5" />
                    <span className="text-sm">{fmtDate(task.due_date)}</span>
                    {overdue && <AlertCircle className="h-3.5 w-3.5" />}
                  </div>
                )}
              </div>
            </div>

            {/* Confirmation Status */}
            <div className={`rounded-lg border p-3 space-y-3 ${
              confirmStatus === "confirmed" ? "border-green-500/30 bg-green-500/5" :
              confirmStatus === "rejected" ? "border-destructive/30 bg-destructive/5" :
              confirmStatus === "pending" ? "border-amber-500/30 bg-amber-500/5" : ""
            }`}>
              {/* Status header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <confInfo.icon className={`h-4.5 w-4.5 ${confInfo.color}`} />
                  <span className="text-sm font-semibold">Подтверждение</span>
                </div>
                <Badge variant={confInfo.variant as any} className="text-xs gap-1">
                  <confInfo.icon className="h-3 w-3" />
                  {confInfo.label}
                </Badge>
              </div>

              {/* Visual progress steps */}
              <div className="flex items-center gap-1 px-1">
                {["none", "pending", "confirmed"].map((step, i) => {
                  const stepOrder = { none: 0, pending: 1, confirmed: 2, rejected: 1 };
                  const currentOrder = stepOrder[confirmStatus as keyof typeof stepOrder] ?? 0;
                  const isActive = i <= currentOrder && confirmStatus !== "rejected";
                  const isRejected = confirmStatus === "rejected" && i <= 1;
                  return (
                    <div key={step} className="flex items-center flex-1">
                      <div className={`w-full h-1.5 rounded-full transition-colors ${
                        isRejected ? "bg-destructive/50" : isActive ? "bg-green-500/60" : "bg-muted"
                      }`} />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground px-1">
                <span>Создано</span>
                <span>На проверке</span>
                <span>Подтверждено</span>
              </div>

              {/* Confirmed at info */}
              {task.confirmed_at && (confirmStatus === "confirmed" || confirmStatus === "rejected") && (
                <p className="text-[10px] text-muted-foreground">
                  {confirmStatus === "confirmed" ? "Подтверждено" : "Отклонено"}: <span title={fmtDateTime(task.confirmed_at)}>{relTime(task.confirmed_at)}</span>
                </p>
              )}

              {/* Rejection reason */}
              {task.rejection_reason && confirmStatus === "rejected" && (
                <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                  <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-medium">Причина отклонения:</span>
                    <p className="mt-0.5">{task.rejection_reason}</p>
                  </div>
                </div>
              )}

              {/* Creator actions: confirm/reject when pending */}
              {isCreator && confirmStatus === "pending" && (
                <div className="flex flex-col gap-2 pt-1">
                  <p className="text-xs text-muted-foreground">Исполнитель отправил задачу на проверку</p>
                  <div className="flex gap-2">
                    <Button size="sm" className="gap-1.5 flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={handleConfirm}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Подтвердить
                    </Button>
                    <Button size="sm" variant="destructive" className="gap-1.5 flex-1" onClick={() => setShowRejectInput(!showRejectInput)}>
                      <XCircle className="h-3.5 w-3.5" /> Отклонить
                    </Button>
                  </div>
                  {showRejectInput && (
                    <div className="flex gap-2">
                      <Input placeholder="Укажите причину отклонения..." value={rejectionReason} onChange={e => setRejectionReason(e.target.value)}
                        className="h-8 text-sm flex-1" onKeyDown={e => { if (e.key === "Enter") handleReject(); }} autoFocus />
                      <Button size="sm" variant="destructive" className="h-8 gap-1" onClick={handleReject}>
                        <Send className="h-3 w-3" /> Отправить
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Creator can directly confirm task in done status even without pending */}
              {isCreator && confirmStatus === "none" && task.status === "done" && (
                <div className="flex flex-col gap-2 pt-1">
                  <p className="text-xs text-muted-foreground">Задача выполнена — вы можете подтвердить</p>
                  <div className="flex gap-2">
                    <Button size="sm" className="gap-1.5 flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={handleConfirm}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Подтвердить
                    </Button>
                    <Button size="sm" variant="destructive" className="gap-1.5 flex-1" onClick={() => setShowRejectInput(!showRejectInput)}>
                      <XCircle className="h-3.5 w-3.5" /> Отклонить
                    </Button>
                  </div>
                  {showRejectInput && (
                    <div className="flex gap-2">
                      <Input placeholder="Укажите причину отклонения..." value={rejectionReason} onChange={e => setRejectionReason(e.target.value)}
                        className="h-8 text-sm flex-1" onKeyDown={e => { if (e.key === "Enter") handleReject(); }} autoFocus />
                      <Button size="sm" variant="destructive" className="h-8 gap-1" onClick={handleReject}>
                        <Send className="h-3 w-3" /> Отправить
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Assignee can send for review when task is done */}
              {isAssignee && !isCreator && (confirmStatus === "none" || confirmStatus === "rejected") && task.status === "done" && (
                <Button size="sm" variant="outline" className="gap-1.5 w-full" onClick={handleSendForReview}>
                  <ArrowRightCircle className="h-3.5 w-3.5" /> Отправить на проверку автору
                </Button>
              )}

              {/* Assignee can return to work if rejected */}
              {isAssignee && !isCreator && confirmStatus === "rejected" && (
                <Button size="sm" variant="outline" className="gap-1.5 w-full" onClick={handleReturnToWork}>
                  <RotateCcw className="h-3.5 w-3.5" /> Вернуть в работу
                </Button>
              )}

              {/* Confirmed message */}
              {confirmStatus === "confirmed" && (
                <div className="flex items-center gap-2 text-xs text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="font-medium">Задача подтверждена автором</span>
                </div>
              )}
            </div>

            {/* Checklist */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <CheckSquare className="h-3.5 w-3.5" />
                  Чек-лист {checklistTotal > 0 && `(${checklistDone}/${checklistTotal})`}
                </p>
              </div>
              {checklistTotal > 0 && (
                <div className="flex items-center gap-2 mb-2">
                  <Progress value={checklistPercent} className="h-1.5 flex-1" />
                  <span className="text-[10px] font-medium text-muted-foreground">{checklistPercent}%</span>
                </div>
              )}
              <div className="space-y-1 mb-2">
                {checklist.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 group">
                    <Checkbox
                      checked={!!item.is_completed}
                      onCheckedChange={() => handleToggleCheckItem(item)}
                      className="h-4 w-4"
                    />
                    <span className={`text-sm flex-1 ${item.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                      {item.title}
                    </span>
                    <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteCheckItem(item.id)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Добавить пункт..."
                  value={newCheckItem}
                  onChange={(e) => setNewCheckItem(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddCheckItem(); } }}
                  className="text-sm h-8"
                />
                <Button size="sm" className="h-8 px-3" onClick={handleAddCheckItem} disabled={!newCheckItem.trim()}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Attachments */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Вложения {attachments.length > 0 && `(${attachments.length})`}
                </p>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
                  onClick={() => fileRef.current?.click()} disabled={uploading}>
                  <Paperclip className="h-3.5 w-3.5" />
                  {uploading ? "Загрузка" : "Прикрепить"}
                </Button>
                <input ref={fileRef} type="file" className="hidden" onChange={handleFile} />
              </div>
              {attachments.length === 0 ? (
                <p className="text-xs text-muted-foreground">Вложений нет</p>
              ) : (
                <div className="space-y-1">
                  {attachments.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5">
                      <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs flex-1 truncate">{a.original_name}</span>
                      <a href={`http://localhost:3001${a.path}`} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="h-6 w-6"><Download className="h-3 w-3" /></Button>
                      </a>
                      {canDelete && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteAtt(a.id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Comments */}
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Комментарии {comments.length > 0 && `(${comments.length})`}
                </p>
              </div>

              {comments.length > 0 && (
                <div className="space-y-2 mb-3">
                  {comments.map((c) => (
                    <div key={c.id} className="rounded-lg bg-muted/50 px-3 py-2">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <div className="flex items-center gap-1.5">
                          <UserAvatar user={{ full_name: c.author_name, avatar_url: c.author_avatar_url }} size="xs" />
                          <span className="font-medium text-xs">{c.author_name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground" title={fmtDateTime(c.created_at)}>{relTime(c.created_at)}</span>
                          {(canDelete || c.user_id === currentUserId) && (
                            <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteComment(c.id)}>
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <RenderMentionText text={c.text} />
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <MentionInput
                  placeholder="Написать комментарий (@имя для упоминания)"
                  value={commentText}
                  onChange={setCommentText}
                  users={users}
                  draftKey={`task-comment-${task.id}`}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                  className="text-sm h-8"
                />
                <Button size="sm" className="h-8 px-3" onClick={handleAddComment}
                  disabled={!commentText.trim() || submittingComment}>
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

/*  Create Task Modal  */

function CreateTaskModal({
  users, currentUserId, onClose, onCreated,
}: { users: any[]; currentUserId: number; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [selectedAssignees, setSelectedAssignees] = useState<number[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [tzFile, setTzFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceDay, setRecurrenceDay] = useState("5"); // Friday default
  const [checklistItems, setChecklistItems] = useState<string[]>([]);
  const [newCheckInput, setNewCheckInput] = useState("");
  const [separateTasks, setSeparateTasks] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const toggleAssignee = (id: number) => {
    setSelectedAssignees((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const submit = async () => {
    if (!title.trim()) return;
    setSaving(true);

    const createSingleTask = async (assigneeIds?: number[]) => {
      const result = await createTask({
        title: title.trim(),
        description: description || undefined,
        priority,
        assignee_ids: assigneeIds,
        created_by: currentUserId,
        due_date: dueDate || undefined,
        status: "todo",
        is_recurring: isRecurring,
        recurrence_day: isRecurring ? parseInt(recurrenceDay) : undefined,
      });
      if (result?.id) {
        if (tzFile) await uploadTaskAttachment(result.id, tzFile);
        for (const item of checklistItems) {
          if (item.trim()) await addChecklistItem(result.id, item.trim());
        }
      }
    };

    if (separateTasks && selectedAssignees.length > 1) {
      for (const uid of selectedAssignees) {
        await createSingleTask([uid]);
      }
    } else {
      await createSingleTask(selectedAssignees.length > 0 ? selectedAssignees : undefined);
    }

    setSaving(false);
    onCreated();
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader><DialogTitle>Новая задача</DialogTitle></DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          <div className="space-y-4 mt-2 pb-2">
            <div className="space-y-1">
              <Label className="text-xs">Название *</Label>
              <Input placeholder="Название задачи" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Описание</Label>
              <Textarea placeholder="Подробное описание" value={description}
                onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Приоритет</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Дедлайн</Label>
                <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>

            {/* Multi-select assignees */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Исполнители {selectedAssignees.length > 0 && `(${selectedAssignees.length})`}
              </Label>
              <div className="border rounded-lg p-2 max-h-44 overflow-y-auto space-y-0.5">
                {users.map((u) => (
                  <label key={u.id}
                    className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted/60 cursor-pointer select-none">
                    <Checkbox
                      checked={selectedAssignees.includes(u.id)}
                      onCheckedChange={() => toggleAssignee(u.id)}
                    />
                    <span className="text-sm flex-1">{u.name} {u.surname}</span>
                    <span className="text-xs text-muted-foreground">{u.role}</span>
                  </label>
                ))}
              </div>
              {selectedAssignees.length > 1 && (
                <label className="flex items-center gap-2 mt-2 px-2 py-1.5 rounded-lg border border-dashed border-primary/30 bg-primary/5 cursor-pointer select-none">
                  <Checkbox
                    checked={separateTasks}
                    onCheckedChange={(v) => setSeparateTasks(!!v)}
                  />
                  <span className="text-xs text-foreground/80">Каждому исполнителю отдельно</span>
                  <Badge variant="outline" className="text-[10px] ml-auto">{selectedAssignees.length} задач</Badge>
                </label>
              )}
            </div>

            {/* Recurring */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-1.5">
                  <Repeat className="h-3.5 w-3.5" />
                  Повторяющаяся задача
                </Label>
                <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
              </div>
              {isRecurring && (
                <Select value={recurrenceDay} onValueChange={setRecurrenceDay}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DAY_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Checklist items */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <CheckSquare className="h-3.5 w-3.5" />
                Чек-лист {checklistItems.length > 0 && `(${checklistItems.length})`}
              </Label>
              {checklistItems.length > 0 && (
                <div className="space-y-1 border rounded-lg p-2">
                  {checklistItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="flex-1">{item}</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive"
                        onClick={() => setChecklistItems(prev => prev.filter((_, i) => i !== idx))}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="Добавить пункт чек-листа..."
                  value={newCheckInput}
                  onChange={(e) => setNewCheckInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newCheckInput.trim()) {
                      e.preventDefault();
                      setChecklistItems(prev => [...prev, newCheckInput.trim()]);
                      setNewCheckInput("");
                    }
                  }}
                  className="text-sm h-8"
                />
                <Button size="sm" className="h-8 px-2" variant="outline"
                  onClick={() => { if (newCheckInput.trim()) { setChecklistItems(prev => [...prev, newCheckInput.trim()]); setNewCheckInput(""); } }}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* TZ file attachment */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5" />
                ТЗ / Техническое задание
              </Label>
              <div
                className="border-2 border-dashed rounded-lg px-4 py-3 flex flex-col items-center gap-1 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                onClick={() => fileRef.current?.click()}>
                {tzFile ? (
                  <>
                    <Paperclip className="h-4 w-4 text-primary" />
                    <span className="text-xs font-medium text-primary">{tzFile.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {(tzFile.size / 1024).toFixed(1)} KB  нажмите чтобы изменить
                    </span>
                  </>
                ) : (
                  <>
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Прикрепить файл (PDF, DOC, PNG)</span>
                  </>
                )}
                <input ref={fileRef} type="file" className="hidden"
                  onChange={(e) => setTzFile(e.target.files?.[0] ?? null)} />
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-3 border-t mt-2">
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={submit} disabled={!title.trim() || saving}>
            {saving ? "Сохранение" : "Создать"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/*  Task Card  */

function TaskCard({ task, canDelete, onDelete, onClick, currentUserId, onConfirm, onReject }: {
  task: any; canDelete: boolean; onDelete: () => void; onClick: () => void;
  currentUserId: number; onConfirm?: (taskId: number) => void; onReject?: (taskId: number) => void;
}) {
  const overdue = isOverdue(task.due_date, task.status);
  const assignees: any[] = task.assignees ?? [];
  const hasChecklist = task.checklist_total > 0;
  const checkPercent = hasChecklist ? Math.round((task.checklist_done / task.checklist_total) * 100) : 0;
  const confirmStatus = task.confirmation_status || "none";
  const confInfo = CONFIRMATION_LABELS[confirmStatus] || CONFIRMATION_LABELS.none;
  const isCreator = task.created_by === currentUserId;
  const needsReview = isCreator && confirmStatus === "pending";

  return (
    <Card
      className={`border-t-2 transition-shadow hover:shadow-md cursor-pointer ${needsReview ? "ring-2 ring-amber-500/40" : ""} ${
        COLUMNS.find((c) => c.key === task.status)?.color ?? ""
      }`}
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start gap-1">
          <p className="font-medium text-sm text-foreground flex-1 leading-snug">{task.title}</p>
          {canDelete && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 -mt-0.5 -mr-1"
                  onClick={(e) => e.stopPropagation()}>
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-destructive focus:text-destructive"
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                  <Trash2 className="h-3.5 w-3.5 mr-2" />Удалить
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Creator */}
        {task.creator_name && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <UserCheck className="h-2.5 w-2.5" />
            <span>от {task.creator_name}</span>
          </div>
        )}

        {/* Assignees */}
        {assignees.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            <User className="h-3 w-3 text-muted-foreground shrink-0" />
            <div className="flex -space-x-1.5">
              {assignees.slice(0, 3).map((a) => (
                <UserAvatar key={a.id} user={{ id: a.id, full_name: a.full_name, avatar_url: a.avatar_url }} size="xs" className="ring-2 ring-background" />
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground ml-0.5 truncate max-w-[100px]">
              {assignees.map(a => a.full_name.split(" ")[0]).join(", ")}
            </span>
            {assignees.length > 3 && (
              <span className="text-[10px] text-muted-foreground">+{assignees.length - 3}</span>
            )}
          </div>
        )}

        <div className="flex items-center gap-1 flex-wrap">
          <Badge variant={priorityVariant(task.priority)} className="text-[10px]">
            {priorityLabel(task.priority)}
          </Badge>
          {task.is_recurring === 1 && (
            <Badge variant="outline" className="text-[10px] gap-0.5">
              <Repeat className="h-2.5 w-2.5" />
            </Badge>
          )}
          {confirmStatus !== "none" && (
            <Badge variant={confInfo.variant as any} className={`text-[10px] gap-0.5 ${confirmStatus === "confirmed" ? "bg-green-600 hover:bg-green-700" : confirmStatus === "pending" ? "bg-amber-500 hover:bg-amber-600 animate-pulse" : ""}`}>
              <confInfo.icon className="h-2.5 w-2.5" />
              {confInfo.label}
            </Badge>
          )}
        </div>

        {/* Inline confirm/reject for creator when pending */}
        {needsReview && (
          <div className="flex gap-1.5 pt-1" onClick={e => e.stopPropagation()}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" className="h-7 flex-1 gap-1 bg-green-600 hover:bg-green-700 text-white text-[10px]"
                  onClick={() => onConfirm?.(task.id)}>
                  <CheckCircle2 className="h-3 w-3" /> Подтвердить
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p className="text-xs">Подтвердить выполнение задачи</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="destructive" className="h-7 flex-1 gap-1 text-[10px]"
                  onClick={() => onReject?.(task.id)}>
                  <XCircle className="h-3 w-3" /> Отклонить
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p className="text-xs">Отклонить и вернуть в работу</p></TooltipContent>
            </Tooltip>
          </div>
        )}

        {hasChecklist && (
          <div className="flex items-center gap-1.5">
            <CheckSquare className="h-3 w-3 text-muted-foreground" />
            <Progress value={checkPercent} className="h-1 flex-1" />
            <span className="text-[10px] text-muted-foreground">{task.checklist_done}/{task.checklist_total}</span>
          </div>
        )}

        {task.due_date && (
          <div className={`flex items-center gap-1 text-xs ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
            {overdue ? <AlertCircle className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
            {fmtDate(task.due_date)}
            {overdue && "  Просрочено"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/*  MAIN PAGE  */

export default function TasksPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);

  const isAdmin = user?.role === "admin" || user?.role === "umo_head";
  const uid = user ? parseInt(user.id) : 0;

  const load = useCallback(async () => {
    setLoading(true);
    await processRecurringTasks();
    const [t, u] = await Promise.all([fetchTasks(), fetchUsers()]);
    setTasks(t);
    setUsers(u);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Handle command palette action=create
  useEffect(() => {
    if (searchParams.get("action") === "create") {
      searchParams.delete("action");
      setSearchParams(searchParams, { replace: true });
      setShowCreate(true);
    }
  }, [searchParams, setSearchParams]);

  // Admins see all; others see only tasks assigned to them (or created by them)
  const visible = useMemo(() => {
    if (isAdmin) return tasks;
    return tasks.filter(
      (t) =>
        t.created_by === uid ||
        (t.assignees ?? []).some((a: any) => a.id === uid)
    );
  }, [tasks, isAdmin, uid]);

  const columns = useMemo(
    () => COLUMNS.map((c) => ({ ...c, items: visible.filter((t) => t.status === c.key) })),
    [visible],
  );

  const onDragEnd = async (result: DropResult) => {
    const { destination, draggableId } = result;
    if (!destination) return;
    const newStatus = destination.droppableId;
    const taskId = parseInt(draggableId);
    const task = tasks.find(t => t.id === taskId);
    const isTaskCreator = task?.created_by === uid;
    const isTaskAssignee = (task?.assignees ?? []).some((a: any) => a.id === uid);

    // When non-creator assignee drags task to "done", auto-send for review
    if (newStatus === "done" && !isTaskCreator && isTaskAssignee && (task?.confirmation_status === "none" || task?.confirmation_status === "rejected")) {
      setTasks((p) => p.map((t) => (t.id === taskId ? { ...t, status: newStatus, confirmation_status: "pending" } : t)));
      await updateTask(taskId, { status: newStatus, confirmation_status: "pending" });
      playSuccess();
      return;
    }

    setTasks((p) => p.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
    await updateTask(taskId, { status: newStatus });
    if (newStatus === "done") playSuccess();
  };

  const handleInlineConfirm = async (taskId: number) => {
    setTasks(p => p.map(t => t.id === taskId ? { ...t, confirmation_status: "confirmed" } : t));
    await updateTask(taskId, { confirmation_status: "confirmed", acting_user_id: uid });
    load();
  };

  const handleInlineReject = async (taskId: number) => {
    setTasks(p => p.map(t => t.id === taskId ? { ...t, confirmation_status: "rejected", status: "todo" } : t));
    await updateTask(taskId, { confirmation_status: "rejected", rejection_reason: "Отклонено автором", status: "todo", acting_user_id: uid });
    load();
  };

  const handleDelete = (id: number) => {
    const deleted = tasks.find((t) => t.id === id);
    setTasks((p) => p.filter((t) => t.id !== id));
    playDelete();
    const timer = setTimeout(() => deleteTask(id), 5000);
    toast("Задача удалена", {
      duration: 5000,
      action: { label: "Отменить", onClick: () => { clearTimeout(timer); if (deleted) setTasks((p) => [...p, deleted]); } },
    });
  };

  const canDeleteTask = (task: any) => isAdmin || task.created_by === uid;

  return (
    <div>
      <div className="flex items-center justify-end mb-4 md:mb-6">
        <Button onClick={() => setShowCreate(true)} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />Новая задача
        </Button>
      </div>

      {showCreate && (
        <CreateTaskModal users={users} currentUserId={uid}
          onClose={() => setShowCreate(false)} onCreated={load} />
      )}
      {selectedTask && (
        <TaskDetailDialog
          task={selectedTask}
          canDelete={canDeleteTask(selectedTask)}
          currentUserId={uid}
          users={users}
          onClose={() => setSelectedTask(null)}
          onDeleted={() => { handleDelete(selectedTask.id); setSelectedTask(null); }}
          onUpdated={load}
        />
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {COLUMNS.map((c) => (
            <div key={c.key} className="space-y-3">
              <Skeleton className="h-7 w-32" />
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Admin Statistics */}
          {isAdmin && (
            <div className="mb-6 space-y-4">
              {/* Statistics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="border-0 shadow-sm">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-foreground">{tasks.length}</div>
                      <p className="text-sm text-muted-foreground mt-1">Всего задач</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-sm">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600">{tasks.filter(t => t.status === "done").length}</div>
                      <p className="text-sm text-muted-foreground mt-1">Выполнено</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-sm">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-amber-600">{tasks.filter(t => t.status === "in_progress").length}</div>
                      <p className="text-sm text-muted-foreground mt-1">В процессе</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-sm">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-600">{tasks.filter(t => t.status === "todo").length}</div>
                      <p className="text-sm text-muted-foreground mt-1">К выполнению</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Task Distribution Table */}
              <Card className="border-0 shadow-sm overflow-hidden">
                <CardContent className="p-0">
                  <div className="px-6 py-4 border-b border-border">
                    <h3 className="font-semibold text-foreground">Распределение задач по исполнителям</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="px-6 py-3 text-left font-semibold">Исполнитель</th>
                          <th className="px-6 py-3 text-center font-semibold">Всего</th>
                          <th className="px-6 py-3 text-center font-semibold">Выполнено</th>
                          <th className="px-6 py-3 text-center font-semibold">В процессе</th>
                          <th className="px-6 py-3 text-center font-semibold">К выполнению</th>
                          <th className="px-6 py-3 text-center font-semibold">Процент выполнения</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users
                          .map((user) => {
                            const userTasks = tasks.filter((t) =>
                              (t.assignees ?? []).some((a: any) => a.id === user.id)
                            );
                            return {
                              user,
                              total: userTasks.length,
                              done: userTasks.filter((t) => t.status === "done").length,
                              inProgress: userTasks.filter((t) => t.status === "in_progress").length,
                              todo: userTasks.filter((t) => t.status === "todo").length,
                            };
                          })
                          .filter((row) => row.total > 0)
                          .sort((a, b) => b.total - a.total)
                          .map((row, idx) => (
                            <tr key={row.user.id} className={`border-b ${idx % 2 ? "bg-muted/20" : ""}`}>
                              <td className="px-6 py-3">
                                <div className="flex items-center gap-2">
                                  <UserAvatar user={{ id: row.user.id, full_name: row.user.name + " " + row.user.surname, avatar_url: row.user.avatar_url }} size="sm" />
                                  <span className="font-medium">{row.user.name} {row.user.surname}</span>
                                </div>
                              </td>
                              <td className="px-6 py-3 text-center">
                                <Badge variant="outline">{row.total}</Badge>
                              </td>
                              <td className="px-6 py-3 text-center">
                                <span className="text-green-600 font-medium">{row.done}</span>
                              </td>
                              <td className="px-6 py-3 text-center">
                                <span className="text-amber-600 font-medium">{row.inProgress}</span>
                              </td>
                              <td className="px-6 py-3 text-center">
                                <span className="text-blue-600 font-medium">{row.todo}</span>
                              </td>
                              <td className="px-6 py-3">
                                <div className="flex items-center gap-2">
                                  <Progress value={(row.done / row.total) * 100} className="h-2 flex-1" />
                                  <span className="text-xs font-medium text-muted-foreground min-w-[2.5rem]">
                                    {Math.round((row.done / row.total) * 100)}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Task Board */}
          <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
            {columns.map((col) => (
              <div key={col.key} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-heading font-semibold text-foreground text-sm">{col.label}</h2>
                  <div className="flex items-center gap-1.5">
                    {col.key === "done" && col.items.filter(t => t.confirmation_status === "pending" && t.created_by === uid).length > 0 && (
                      <Badge variant="default" className="text-[10px] gap-0.5 bg-amber-500 hover:bg-amber-600 animate-pulse">
                        <Hourglass className="h-2.5 w-2.5" />
                        {col.items.filter(t => t.confirmation_status === "pending" && t.created_by === uid).length} на проверку
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">{col.items.length}</Badge>
                  </div>
                </div>

                <Droppable droppableId={col.key}>
                  {(provided, snapshot) => (
                    <div ref={provided.innerRef} {...provided.droppableProps}
                      className={`space-y-2 min-h-[120px] rounded-xl p-2 transition-colors ${
                        snapshot.isDraggingOver ? "bg-primary/5 ring-1 ring-primary/20" : ""
                      }`}>

                      {col.items.map((item, idx) => (
                        <Draggable key={String(item.id)} draggableId={String(item.id)} index={idx}>
                          {(prov, snap) => (
                            <div ref={prov.innerRef} {...prov.draggableProps} {...prov.dragHandleProps}
                              style={{ ...prov.draggableProps.style, opacity: snap.isDragging ? 0.85 : 1 }}>
                              <TaskCard
                                task={item}
                                canDelete={canDeleteTask(item)}
                                onDelete={() => handleDelete(item.id)}
                                onClick={() => setSelectedTask(item)}
                                currentUserId={uid}
                                onConfirm={handleInlineConfirm}
                                onReject={handleInlineReject}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}

                      {col.items.length === 0 && !snapshot.isDraggingOver && (
                        <div className="flex items-center justify-center h-16 text-xs text-muted-foreground/50 border-2 border-dashed rounded-lg">
                          Пусто
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
        </>
      )}
    </div>
  );
}
