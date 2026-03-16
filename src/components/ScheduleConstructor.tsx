import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  fetchSchedule, fetchGroups, fetchSubjects, fetchUsers, fetchRooms, fetchTimeSlots,
  createScheduleEntry, updateScheduleEntry, moveScheduleEntry, deleteScheduleEntry, publishSchedule,
  type ScheduleEntry,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, X, Save } from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { UserAvatar } from "@/components/UserAvatar";

interface TimeSlot { id: number; start_time: string; end_time: string; label: string }
interface Group { id: number; name: string }
interface Subject { id: number; name: string }
interface Teacher { id: number; name: string; surname: string; role: string }
interface Room { id: number; name: string }

type ModalMode =
  | { kind: "add"; teacherId: number; slotId: number }
  | { kind: "edit"; entry: ScheduleEntry }
  | null;

interface Props { onClose: () => void }

const GROUP_COLORS = [
  "border-l-blue-500",
  "border-l-emerald-500",
  "border-l-violet-500",
  "border-l-amber-500",
  "border-l-rose-500",
  "border-l-cyan-500",
  "border-l-orange-500",
  "border-l-pink-500",
  "border-l-teal-500",
  "border-l-indigo-500",
  "border-l-lime-500",
  "border-l-red-500",
];
const getGroupColor = (groupId: number) => GROUP_COLORS[(groupId - 1) % GROUP_COLORS.length];

export default function ScheduleConstructor({ onClose }: Props) {
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [cycle, setCycle] = useState<"PSP" | "VChS">("PSP");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalMode>(null);
  const [formGroup, setFormGroup] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [sched, grps, subjs, usrs, rms, slots] = await Promise.all([
      fetchSchedule(), fetchGroups(), fetchSubjects(), fetchUsers(), fetchRooms(), fetchTimeSlots(),
    ]);
    setSchedule(sched);
    setGroups(grps);
    setSubjects(subjs);
    setTeachers(usrs.filter((u: Teacher) => u.role === "teacher"));
    setRooms(rms);
    setTimeSlots(slots);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const view = schedule.filter(s => s.cycle === cycle);

  const getCell = (teacherId: number, slotId: number): ScheduleEntry | undefined =>
    view.find(s => s.teacher_id === teacherId && s.time_slot_id === slotId);

  const openAdd = (teacherId: number, slotId: number) => {
    setFormGroup(String(groups[0]?.id ?? ""));
    setFormSubject(String(subjects[0]?.id ?? ""));
    setModal({ kind: "add", teacherId, slotId });
  };

  const openEdit = (entry: ScheduleEntry) => {
    setFormGroup(String(entry.group_id));
    setFormSubject(String(entry.subject_id));
    setModal({ kind: "edit", entry });
  };

  const handleSave = async () => {
    if (!modal || !formGroup || !formSubject) return;
    setSaving(true);
    try {
      if (modal.kind === "add") {
        await createScheduleEntry({
          group_id: Number(formGroup),
          subject_id: Number(formSubject),
          teacher_id: modal.teacherId,
          room_id: rooms[0]?.id ?? 1,
          time_slot_id: modal.slotId,
          cycle,
        });
        toast.success("Урок добавлен");
      } else {
        await updateScheduleEntry(modal.entry.id, {
          group_id: Number(formGroup),
          subject_id: Number(formSubject),
          teacher_id: modal.entry.teacher_id,
          room_id: modal.entry.room_id,
          time_slot_id: modal.entry.time_slot_id,
          cycle: modal.entry.cycle,
        });
        toast.success("Урок обновлён");
      }
      setModal(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.error ?? "Конфликт расписания");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const result = await publishSchedule(cycle);
      toast.success(`Расписание сохранено и отправлено ${result.notified} преподавателям`);
    } catch {
      toast.error("Не удалось отправить уведомления");
    } finally {
      setPublishing(false);
    }
  };

  const handleDelete = (id: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const deleted = schedule.find(s => s.id === id);
    setSchedule(prev => prev.filter(s => s.id !== id));
    const timer = setTimeout(() => { deleteScheduleEntry(id).catch(() => { if (deleted) setSchedule(prev => [...prev, deleted]); toast.error("Не удалось удалить"); }); }, 5000);
    toast("Урок удалён", {
      duration: 5000,
      action: { label: "Отменить", onClick: () => { clearTimeout(timer); if (deleted) setSchedule(prev => [...prev, deleted]); } },
    });
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    if (result.source.droppableId === result.destination.droppableId) return;

    const entryId = parseInt(result.draggableId.replace("e-", ""));
    const [newTeacherStr, newSlotStr] = result.destination.droppableId.split("_");
    const newTeacherId = Number(newTeacherStr);
    const newSlotId = Number(newSlotStr);

    const entry = schedule.find(s => s.id === entryId);
    if (!entry) return;

    // Guard: target teacher's cell already occupied (by a different entry)
    const teacherOccupied = view.find(s => s.teacher_id === newTeacherId && s.time_slot_id === newSlotId && s.id !== entryId);
    if (teacherOccupied) {
      toast.error("Учитель уже занят в это время");
      return;
    }

    // Guard: same group already has a lesson in that time slot (by a different entry)
    const groupOccupied = view.find(s => s.group_id === entry.group_id && s.time_slot_id === newSlotId && s.id !== entryId);
    if (groupOccupied) {
      toast.error(`Группа уже занята в это время (${groupOccupied.group_name} — ${groupOccupied.subject_name})`);
      return;
    }

    // Optimistic update
    setSchedule(prev =>
      prev.map(s => s.id === entryId ? { ...s, teacher_id: newTeacherId, time_slot_id: newSlotId } : s)
    );

    try {
      await moveScheduleEntry(entryId, { teacher_id: newTeacherId, time_slot_id: newSlotId, cycle });
      toast.success("Расписание обновлено");
      // Background full sync
      fetchSchedule().then(sched => setSchedule(sched));
    } catch (err: any) {
      // Rollback
      setSchedule(prev =>
        prev.map(s => s.id === entryId ? { ...s, teacher_id: entry.teacher_id, time_slot_id: entry.time_slot_id } : s)
      );
      toast.error(err.error ?? "Ошибка: Учитель уже занят в это время");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-zinc-400 dark:text-zinc-500">
        Загрузка расписания…
      </div>
    );
  }

  const teacherName = (id: number) => {
    const t = teachers.find(t => t.id === id);
    return t ? `${t.name} ${t.surname}` : "";
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Конструктор расписания
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Изменения сохраняются автоматически. Нажмите «Сохранить» чтобы уведомить преподавателей.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Cycle toggle */}
          <div className="flex rounded-md overflow-hidden border border-zinc-200 dark:border-zinc-700 text-sm font-medium">
            {(["PSP", "VChS"] as const).map(c => (
              <button
                key={c}
                onClick={() => setCycle(c)}
                className={`px-3.5 py-1.5 transition-colors ${
                  cycle === c
                    ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                    : "bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                {c === "PSP" ? "ПСП" : "ВЧС"}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            onClick={handlePublish}
            disabled={publishing}
            className="h-8 px-3 text-sm bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-600 gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            {publishing ? "Отправка…" : "Сохранить"}
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Matrix */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <table
            className="w-full border-collapse bg-white dark:bg-zinc-950"
            style={{ minWidth: `${teachers.length * 160 + 120}px` }}
          >
            <thead>
              <tr>
                <th className="sticky left-0 z-20 bg-zinc-50 dark:bg-zinc-900 border-b border-r border-zinc-200 dark:border-zinc-800 p-3 text-left w-28 min-w-[112px]">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Время</span>
                </th>
                {teachers.map(t => (
                  <th
                    key={t.id}
                    className="border-b border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-2.5 text-center min-w-[160px]"
                  >
                    <div className="flex flex-col items-center gap-1.5">
                      <UserAvatar user={t} size="sm" />
                      <div>
                        <span className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200 leading-tight">{t.name}</span>
                        <span className="block text-[11px] text-zinc-400 dark:text-zinc-500 leading-tight">{t.surname}</span>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map(slot => (
                <tr key={slot.id}>
                  <td className="sticky left-0 z-10 bg-white dark:bg-zinc-950 border-b border-r border-zinc-200 dark:border-zinc-800 p-3">
                    <div className="text-sm font-bold text-zinc-800 dark:text-zinc-200 tabular-nums">{slot.start_time}</div>
                    <div className="text-[10px] text-zinc-400 mt-0.5 tabular-nums">{slot.end_time}</div>
                    <div className="text-[10px] text-zinc-500 font-medium mt-0.5">{slot.label}</div>
                  </td>
                  {teachers.map(teacher => {
                    const entry = getCell(teacher.id, slot.id);
                    const droppableId = `${teacher.id}_${slot.id}`;
                    return (
                      <td key={teacher.id} className="border-b border-r border-zinc-200 dark:border-zinc-800 p-1.5 align-top">
                        <Droppable droppableId={droppableId}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={[
                                "min-h-[76px] rounded-md transition-all duration-100",
                                snapshot.isDraggingOver && !entry
                                  ? "bg-zinc-100 dark:bg-zinc-800/70 ring-1 ring-zinc-300 dark:ring-zinc-600"
                                  : snapshot.isDraggingOver && entry
                                  ? "ring-1 ring-red-300 dark:ring-red-800 bg-red-50 dark:bg-red-950/20"
                                  : "",
                              ].join(" ")}
                            >
                              {entry ? (
                                <Draggable draggableId={`e-${entry.id}`} index={0}>
                                  {(dragProvided, dragSnapshot) => (
                                    <div
                                      ref={dragProvided.innerRef}
                                      {...dragProvided.draggableProps}
                                      {...dragProvided.dragHandleProps}
                                      className={[
                                        "group relative rounded-md p-2.5 select-none border border-l-4 transition-all",
                                        dragSnapshot.isDragging
                                          ? "bg-zinc-900 dark:bg-zinc-100 border-zinc-900 dark:border-zinc-100 shadow-2xl scale-[1.04] rotate-[0.8deg] cursor-grabbing"
                                          : `bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 ${getGroupColor(entry.group_id)} hover:border-zinc-300 dark:hover:border-zinc-600 hover:shadow-sm cursor-grab active:cursor-grabbing`,
                                      ].join(" ")}
                                    >
                                      {/* Delete × */}
                                      <button
                                        onPointerDown={e => e.stopPropagation()}
                                        onClick={e => handleDelete(entry.id, e)}
                                        className={[
                                          "absolute top-1 right-1 rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity",
                                          "text-zinc-300 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400",
                                          "hover:bg-red-50 dark:hover:bg-red-950/30",
                                          dragSnapshot.isDragging ? "hidden" : "",
                                        ].join(" ")}
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                      {/* Group name (bold) */}
                                      <p className={`text-xs font-bold leading-tight pr-4 truncate ${
                                        dragSnapshot.isDragging
                                          ? "text-zinc-100 dark:text-zinc-900"
                                          : "text-zinc-900 dark:text-zinc-100"
                                      }`}>
                                        {entry.group_name}
                                      </p>
                                      {/* Subject (secondary) */}
                                      <p className={`text-[11px] leading-tight mt-0.5 truncate ${
                                        dragSnapshot.isDragging
                                          ? "text-zinc-400 dark:text-zinc-600"
                                          : "text-zinc-500 dark:text-zinc-400"
                                      }`}>
                                        {entry.subject_name}
                                      </p>
                                    </div>
                                  )}
                                </Draggable>
                              ) : (
                                <button
                                  onClick={() => openAdd(teacher.id, slot.id)}
                                  className="w-full min-h-[76px] flex items-center justify-center rounded-md border-2 border-dashed border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-all group"
                                >
                                  <Plus className="h-3.5 w-3.5 text-zinc-200 group-hover:text-zinc-400 dark:text-zinc-700 dark:group-hover:text-zinc-500 transition-colors" />
                                </button>
                              )}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DragDropContext>

      {/* Footer stats */}
      <div className="flex items-center gap-5 text-xs text-zinc-400 dark:text-zinc-500">
        <span>Цикл: <strong className="text-zinc-600 dark:text-zinc-300">{cycle === "PSP" ? "ПСП" : "ВЧС"}</strong></span>
        <span>Уроков в цикле: <strong className="text-zinc-600 dark:text-zinc-300">{view.length}</strong></span>
        <span>Учителей: <strong className="text-zinc-600 dark:text-zinc-300">{teachers.length}</strong></span>
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={!!modal} onOpenChange={open => !open && setModal(null)}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {modal?.kind === "edit" ? "Изменить урок" : "Добавить урок"}
            </DialogTitle>
          </DialogHeader>
          {modal && (
            <div className="space-y-3 py-1">
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-500">Группа</Label>
                <Select value={formGroup} onValueChange={setFormGroup}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Выберите группу" /></SelectTrigger>
                  <SelectContent>
                    {groups.map(g => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-500">Предмет</Label>
                <Select value={formSubject} onValueChange={setFormSubject}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Выберите предмет" /></SelectTrigger>
                  <SelectContent>
                    {subjects.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {/* Context info */}
              <div className="rounded-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-2.5 space-y-1">
                <p className="text-xs text-zinc-500">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Учитель: </span>
                  {modal.kind === "add" ? teacherName(modal.teacherId) : modal.entry.teacher_name}
                </p>
                <p className="text-xs text-zinc-500">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Слот: </span>
                  {modal.kind === "add"
                    ? (() => { const s = timeSlots.find(ts => ts.id === modal.slotId); return s ? `${s.start_time} – ${s.end_time}` : ""; })()
                    : (() => { const s = timeSlots.find(ts => ts.id === modal.entry.time_slot_id); return s ? `${s.start_time} – ${s.end_time}` : ""; })()
                  }
                </p>
                <p className="text-xs text-zinc-500">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Цикл: </span>
                  {cycle === "PSP" ? "ПСП (пн/ср/пт)" : "ВЧС (вт/чт/сб)"}
                </p>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setModal(null)}>Отмена</Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !formGroup || !formSubject}
              className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {saving ? "…" : modal?.kind === "edit" ? "Сохранить" : "Добавить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
