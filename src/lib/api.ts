// ====================== STUDENT AVATAR ======================
export async function uploadStudentAvatar(studentId: string | number, file: File) {
  const fd = new FormData();
  fd.append("avatar", file);
  const res = await apiFetch(`${API_BASE}/students/${studentId}/avatar`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteStudentAvatar(studentId: string | number) {
  const res = await apiFetch(`${API_BASE}/students/${studentId}/avatar`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export type StudentCertificateType = "march" | "january" | "grant1" | "grant2";

export interface StudentCertificate {
  id: number;
  student_id: number;
  cert_type: StudentCertificateType;
  file_url: string;
  original_name?: string | null;
  uploaded_by?: number | null;
  uploaded_at: string;
}

export async function fetchStudentCertificates(studentId: string | number): Promise<StudentCertificate[]> {
  const res = await apiFetch(`${API_BASE}/students/${studentId}/certificates`, defaultOptions);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function uploadStudentCertificate(
  studentId: string | number,
  certType: StudentCertificateType,
  file: File
): Promise<StudentCertificate> {
  const fd = new FormData();
  fd.append("cert_type", certType);
  fd.append("file", file);
  const res = await apiFetch(`${API_BASE}/students/${studentId}/certificates`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteStudentCertificate(studentId: string | number, certId: number) {
  const res = await apiFetch(`${API_BASE}/students/${studentId}/certificates/${certId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
// Базовый URL API:
// - в проде на Netlify удобнее ходить на same-origin `/api` (Netlify proxy/redirect)
// - при необходимости можно переопределить через VITE_API_URL
const API_BASE = (import.meta as any).env?.VITE_API_URL || "/api";

// Для всех запросов по умолчанию не передаём credentials
const defaultOptions: RequestInit = {};

/** Читаем JWT-токен из localStorage */
function getAuthToken(): string | null {
  return localStorage.getItem("today_crm_token");
}

/** Обёртка над fetch — автоматически добавляет Authorization header */
function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(url, { ...options, headers });
}

// ====================== HEALTH ======================

export async function fetchHealth() {
  const res = await apiFetch(`${API_BASE}/health`, defaultOptions);
  if (!res.ok) throw new Error("Health check failed");
  return res.json();
}

// ====================== USERS ======================

export async function fetchUsers() {
  try {
    const res = await apiFetch(`${API_BASE}/users`, defaultOptions);
    if (!res.ok) throw new Error("Failed to fetch users");
    return await res.json();
  } catch (error) {
    console.error("Error fetching users:", error);
    return [];
  }
}

export async function fetchUser(id: string) {
  try {
    const res = await apiFetch(`${API_BASE}/users/${id}`, defaultOptions);
    if (!res.ok) throw new Error("Failed to fetch user");
    return await res.json();
  } catch (error) {
    console.error("Error fetching user:", error);
    return null;
  }
}

export async function createUser(data: Record<string, unknown>) {
  const res = await apiFetch(`${API_BASE}/users`, { ...defaultOptions, method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateUser(id: number, data: Record<string, unknown>) {
  const res = await apiFetch(`${API_BASE}/users/${id}`, { ...defaultOptions, method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteUser(id: number) {
  const res = await apiFetch(`${API_BASE}/users/${id}`, { ...defaultOptions, method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function uploadAvatar(userId: string | number, file: File) {
  const fd = new FormData();
  fd.append("avatar", file);
  const res = await apiFetch(`${API_BASE}/users/${userId}/avatar`, { ...defaultOptions, method: "POST", body: fd });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteAvatar(userId: string | number) {
  const res = await apiFetch(`${API_BASE}/users/${userId}/avatar`, { ...defaultOptions, method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateStudent(id: number, data: Record<string, unknown>) {
  const res = await apiFetch(`${API_BASE}/students/${id}`, { ...defaultOptions, method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function archiveStudent(id: number) {
  const res = await apiFetch(`${API_BASE}/students/${id}/archive`, { ...defaultOptions, method: "PATCH" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchGroups() {
  try {
    const res = await apiFetch(`${API_BASE}/groups`, defaultOptions);
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch { return []; }
}

export async function createGroup(data: Record<string, unknown>) {
  const res = await apiFetch(`${API_BASE}/groups`, { ...defaultOptions, method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateGroup(id: number, data: Record<string, unknown>) {
  const res = await apiFetch(`${API_BASE}/groups/${id}`, { ...defaultOptions, method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteGroup(id: number) {
  const res = await apiFetch(`${API_BASE}/groups/${id}`, { ...defaultOptions, method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Legacy alias used by SettingsPage
export async function addGroup(name: string) {
  try {
    return await createGroup({ name });
  } catch {
    return null;
  }
}

export async function fetchSubjects() {
  try {
    const res = await apiFetch(`${API_BASE}/subjects`, defaultOptions);
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch { return []; }
}

export async function createSubject(data: Record<string, unknown>) {
  const res = await apiFetch(`${API_BASE}/subjects`, { ...defaultOptions, method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateSubject(id: number, data: Record<string, unknown>) {
  const res = await apiFetch(`${API_BASE}/subjects/${id}`, { ...defaultOptions, method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteSubject(id: number) {
  const res = await apiFetch(`${API_BASE}/subjects/${id}`, { ...defaultOptions, method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchProfiles() {
  try {
    const res = await apiFetch(`${API_BASE}/profiles`, defaultOptions);
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch { return []; }
}

// ====================== LESSONS ======================

export async function fetchLessons(teacherId?: string) {
  try {
    const url = teacherId
      ? `${API_BASE}/lessons?teacher_id=${teacherId}`
      : `${API_BASE}/lessons`;
    const res = await apiFetch(url, defaultOptions);
    if (!res.ok) throw new Error("Failed to fetch lessons");
    return await res.json();
  } catch (error) {
    console.error("Error fetching lessons:", error);
    return [];
  }
}

export async function fetchLessonsForTeacher(teacherId: string) {
  return fetchLessons(teacherId);
}

// ====================== ATTENDANCE (helpers) ======================

export async function fetchMarkedLessons(params: { from: string; to: string; teacherId?: string | number }) {
  try {
    const search = new URLSearchParams();
    search.set("from", params.from);
    search.set("to", params.to);
    if (params.teacherId !== undefined) search.set("teacher_id", String(params.teacherId));
    const res = await apiFetch(`${API_BASE}/attendance/marked-lessons?${search.toString()}`, defaultOptions);
    if (!res.ok) throw new Error("Failed to fetch marked lessons");
    return await res.json();
  } catch (error) {
    console.error("Error fetching marked lessons:", error);
    return [];
  }
}

export async function fetchScheduleFillStatus(from: string, to: string) {
  try {
    const search = new URLSearchParams({ from, to });
    const res = await apiFetch(`${API_BASE}/admin/schedule-fill-status?${search.toString()}`, defaultOptions);
    if (!res.ok) throw new Error("Failed to fetch schedule fill status");
    return await res.json() as Array<{
      schedule_id: number; teacher_id: number; teacher_name: string;
      group_name: string; subject_name: string; time_label: string;
      start_time: string; cycle: string; date: string; has_attendance: boolean;
    }>;
  } catch (error) {
    console.error("Error fetching schedule fill status:", error);
    return [];
  }
}

export async function fetchAttendanceByScheduleDate(params: { scheduleId: number; date: string }) {
  try {
    const search = new URLSearchParams();
    search.set("schedule_id", String(params.scheduleId));
    search.set("date", params.date);
    const res = await apiFetch(`${API_BASE}/attendance?${search.toString()}`, defaultOptions);
    if (!res.ok) throw new Error("Failed to fetch attendance");
    return await res.json();
  } catch (error) {
    console.error("Error fetching attendance:", error);
    return [];
  }
}

export async function fetchLessonCommentsByStudent(params: { studentId: number; from?: string; to?: string; limit?: number }) {
  try {
    const search = new URLSearchParams();
    search.set("student_id", String(params.studentId));
    if (params.from) search.set("from", params.from);
    if (params.to) search.set("to", params.to);
    if (params.limit !== undefined) search.set("limit", String(params.limit));
    const res = await apiFetch(`${API_BASE}/attendance/comments/by-student?${search.toString()}`, defaultOptions);
    if (!res.ok) throw new Error("Failed to fetch lesson comments");
    return await res.json();
  } catch (error) {
    console.error("Error fetching lesson comments:", error);
    return [];
  }
}

// ====================== AD-HOC LESSONS ======================

export async function fetchAdhocLessons(date?: string, teacherId?: string) {
  try {
    const params = new URLSearchParams();
    if (date) params.set("date", date);
    if (teacherId) params.set("teacher_id", teacherId);
    const res = await apiFetch(`${API_BASE}/adhoc-lessons?${params}`, defaultOptions);
    if (!res.ok) throw new Error("Failed to fetch adhoc lessons");
    return await res.json();
  } catch (error) {
    console.error("Error fetching adhoc lessons:", error);
    return [];
  }
}

export async function createAdhocLesson(data: {
  title: string; teacher_id: number; subject_id?: number; room?: string;
  date: string; time_slot: string; description?: string; student_ids: number[]; created_by: number;
}) {
  const res = await apiFetch(`${API_BASE}/adhoc-lessons`, { ...defaultOptions, method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!res.ok) throw new Error("Failed to create adhoc lesson");
  return await res.json();
}

export async function updateAdhocLessonAttendance(id: number, students: { student_id: number; status: string; lateness: string; homework: string; comment?: string }[]) {
  const res = await apiFetch(`${API_BASE}/adhoc-lessons/${id}/attendance`, { ...defaultOptions, method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ students }) });
  if (!res.ok) throw new Error("Failed to update adhoc attendance");
  return await res.json();
}

export async function deleteAdhocLesson(id: number) {
  const res = await apiFetch(`${API_BASE}/adhoc-lessons/${id}`, { ...defaultOptions, method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete adhoc lesson");
  return await res.json();
}

// ====================== STUDENTS ======================

export async function createQuiz(data: {
  schedule_id: number | null;
  date: string;
  title: string;
  results: { student_id: number; score: number | null }[];
  created_by: number;
}) {
  const res = await apiFetch(`${API_BASE}/quizzes`, { ...defaultOptions, method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!res.ok) throw new Error("Failed to create quiz");
  return await res.json();
}

export async function fetchQuizzes(params?: { group_id?: number; subject_id?: number; student_id?: number }) {
  const q = new URLSearchParams();
  if (params?.group_id) q.set("group_id", String(params.group_id));
  if (params?.subject_id) q.set("subject_id", String(params.subject_id));
  if (params?.student_id) q.set("student_id", String(params.student_id));
  const res = await apiFetch(`${API_BASE}/quizzes?${q}`, defaultOptions);
  if (!res.ok) throw new Error("Failed to fetch quizzes");
  return await res.json();
}

export async function fetchStudents() {
  try {
    const res = await apiFetch(`${API_BASE}/students`, defaultOptions);
    if (!res.ok) throw new Error("Failed to fetch students");
    return await res.json();
  } catch (error) {
    console.error("Error fetching students:", error);
    return [];
  }
}

export async function fetchStudent(id: string) {
  try {
    const res = await apiFetch(`${API_BASE}/students/${id}`, defaultOptions);
    if (!res.ok) throw new Error("Failed to fetch student");
    return await res.json();
  } catch (error) {
    console.error("Error fetching student:", error);
    return null;
  }
}

export async function addStudent(fullName: string, groupId?: number) {
  try {
    const res = await apiFetch(`${API_BASE}/students`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: fullName, group_id: groupId }),
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to add student");
    return await res.json();
  } catch (error) {
    console.error("Error adding student:", error);
    return null;
  }
}

export async function deleteStudent(id: number) {
  try {
    const res = await apiFetch(`${API_BASE}/students/${id}`, { ...defaultOptions, method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete student");
    return await res.json();
  } catch (error) {
    console.error("Error deleting student:", error);
    return null;
  }
}

export async function createStudent(data: Record<string, unknown>) {
  const res = await apiFetch(`${API_BASE}/students`, {
    ...defaultOptions,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ====================== GROUPS ======================

// (fetchGroups, createGroup, updateGroup, deleteGroup defined above with full API)

// ====================== SUBJECTS ======================
// (fetchSubjects, createSubject, updateSubject, deleteSubject defined above)

// ====================== SCHEDULE ======================

export interface ScheduleEntry {
  id: number;
  group_id: number | null;
  subject_id: number;
  teacher_id: number;
  room_id: number;
  time_slot_id: number;
  cycle: string;
  group_name: string;
  subject_name: string;
  teacher_name: string;
  room_name: string;
  start_time: string;
  end_time: string;
  time_label: string;
  custom_label?: string;
  student_ids?: number[];
}

export interface ScheduleConflict {
  type: "teacher" | "room" | "student" | "group";
  id?: number;
  group_name?: string;
  subject_name?: string;
  teacher_name?: string;
  room_name?: string;
  student_name?: string;
  message?: string;
}

export async function fetchSchedule(teacherId?: string): Promise<ScheduleEntry[]> {
  try {
    const url = teacherId
      ? `${API_BASE}/schedule?teacher_id=${teacherId}`
      : `${API_BASE}/schedule`;
    const res = await apiFetch(url, defaultOptions);
    if (!res.ok) throw new Error("Failed to fetch schedule");
    return await res.json();
  } catch (error) {
    console.error("Error fetching schedule:", error);
    return [];
  }
}

export async function createScheduleEntry(data: {
  group_id?: number | null;
  subject_id: number;
  teacher_id: number;
  room_id: number;
  time_slot_id: number;
  cycle: string;
  student_ids?: number[];
  custom_label?: string;
}) {
  const res = await apiFetch(`${API_BASE}/schedule`, {
    ...defaultOptions,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw json;
  return json;
}

export async function updateScheduleEntry(id: number, data: {
  group_id?: number | null;
  subject_id: number;
  teacher_id: number;
  room_id: number;
  time_slot_id: number;
  cycle: string;
  student_ids?: number[];
  custom_label?: string;
}) {
  const res = await apiFetch(`${API_BASE}/schedule/${id}`, {
    ...defaultOptions,
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw json;
  return json;
}

export async function deleteScheduleEntry(id: number) {
  const res = await apiFetch(`${API_BASE}/schedule/${id}`, { ...defaultOptions, method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete schedule entry");
  return await res.json();
}

export async function moveScheduleEntry(id: number, data: { teacher_id: number; time_slot_id: number; cycle: string }) {
  const res = await apiFetch(`${API_BASE}/schedule/${id}/move`, {
    ...defaultOptions,
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw json;
  return json;
}

export async function publishSchedule(cycle: string): Promise<{ success: boolean; notified: number }> {
  const res = await apiFetch(`${API_BASE}/schedule/publish`, {
    ...defaultOptions,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cycle }),
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function checkScheduleConflicts(data: {
  teacher_id: number;
  room_id: number;
  time_slot_id: number;
  cycle: string;
  exclude_id?: number;
}): Promise<{ conflicts: ScheduleConflict[]; hasConflict: boolean }> {
  try {
    const res = await apiFetch(`${API_BASE}/schedule/check-conflicts`, {
      ...defaultOptions,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to check conflicts");
    return await res.json();
  } catch (error) {
    console.error("Error checking conflicts:", error);
    return { conflicts: [], hasConflict: false };
  }
}

// ====================== ROOMS & TIME SLOTS ======================

export async function fetchRooms() {
  try {
    const res = await apiFetch(`${API_BASE}/rooms`, defaultOptions);
    if (!res.ok) throw new Error("Failed to fetch rooms");
    return await res.json();
  } catch (error) {
    console.error("Error fetching rooms:", error);
    return [];
  }
}

export async function fetchTimeSlots() {
  try {
    const res = await apiFetch(`${API_BASE}/time-slots`, defaultOptions);
    if (!res.ok) throw new Error("Failed to fetch time slots");
    return await res.json();
  } catch (error) {
    console.error("Error fetching time slots:", error);
    return [];
  }
}

export async function createOrGetTimeSlot(start_time: string, end_time: string, label?: string) {
  const res = await apiFetch(`${API_BASE}/time-slots`, {
    ...defaultOptions,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ start_time, end_time, label }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ id: number; start_time: string; end_time: string; label: string }>;
}

// ====================== ATTENDANCE ======================

export async function updateAttendance(studentId: number, lessonId: number, data: Record<string, unknown>) {
  try {
    const res = await apiFetch(`${API_BASE}/attendance`, {
      ...defaultOptions,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId, lesson_id: lessonId, ...data }),
    });
    if (!res.ok) throw new Error("Failed to update attendance");
    return await res.json();
  } catch (error) {
    console.error("Error updating attendance:", error);
    return null;
  }
}

// ====================== ENT RESULTS ======================

export async function fetchEntResults(month?: string, groupId?: number) {
  try {
    const params = new URLSearchParams();
    if (month) params.append("month", month);
    if (groupId) params.append("group_id", groupId.toString());
    const res = await apiFetch(`${API_BASE}/ent-results?${params}`, defaultOptions);
    if (!res.ok) throw new Error("Failed to fetch ENT results");
    return await res.json();
  } catch (error) {
    console.error("Error fetching ENT results:", error);
    return [];
  }
}

export async function saveEntResult(data: { student_id: number; subject_id: number; score: number; month: string }) {
  try {
    const res = await apiFetch(`${API_BASE}/ent-results`, {
      ...defaultOptions,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to save ENT result");
    return await res.json();
  } catch (error) {
    console.error("Error saving ENT result:", error);
    return null;
  }
}

export async function saveEntResultsBatch(scores: { student_id: number; subject_id: number; score: number; month: string }[]) {
  try {
    const res = await apiFetch(`${API_BASE}/ent-results/batch`, {
      ...defaultOptions,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scores }),
    });
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch { return null; }
}

// ====================== TASKS ======================

export async function fetchTasks() {
  try {
    const res = await apiFetch(`${API_BASE}/tasks`, defaultOptions);
    if (!res.ok) throw new Error("Failed to fetch tasks");
    return await res.json();
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return [];
  }
}

export async function createTask(data: { title: string; description?: string; status?: string; priority?: string; assignee_ids?: number[]; created_by?: number; due_date?: string; is_recurring?: boolean; recurrence_day?: number }) {
  try {
    const res = await apiFetch(`${API_BASE}/tasks`, {
      ...defaultOptions,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create task");
    return await res.json();
  } catch (error) {
    console.error("Error creating task:", error);
    return null;
  }
}

export async function updateTask(id: number, data: Record<string, unknown>) {
  try {
    const res = await apiFetch(`${API_BASE}/tasks/${id}`, {
      ...defaultOptions,
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update task");
    return await res.json();
  } catch (error) {
    console.error("Error updating task:", error);
    return null;
  }
}

export async function deleteTask(id: number) {
  try {
    const res = await apiFetch(`${API_BASE}/tasks/${id}`, { method: "DELETE" });
    // defaultOptions not required here but safe
    if (!res.ok) throw new Error("Failed to delete task");
    return await res.json();
  } catch (error) {
    console.error("Error deleting task:", error);
    return null;
  }
}

export async function fetchTaskComments(taskId: number) {
  try {
    const res = await apiFetch(`${API_BASE}/tasks/${taskId}/comments`);
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch { return []; }
}

export async function createTaskComment(taskId: number, data: { user_id: number; text: string }) {
  try {
    const res = await apiFetch(`${API_BASE}/tasks/${taskId}/comments`, {
      ...defaultOptions,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch { return null; }
}

export async function deleteTaskComment(commentId: number) {
  try {
    const res = await apiFetch(`${API_BASE}/tasks/comments/${commentId}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch { return null; }
}

// ====================== TASK CHECKLIST ======================

export async function fetchTaskChecklist(taskId: number) {
  try {
    const res = await apiFetch(`${API_BASE}/tasks/${taskId}/checklist`);
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch { return []; }
}

export async function addChecklistItem(taskId: number, title: string) {
  try {
    const res = await apiFetch(`${API_BASE}/tasks/${taskId}/checklist`, {
      ...defaultOptions,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch { return null; }
}

export async function toggleChecklistItem(id: number, is_completed: number) {
  try {
    const res = await apiFetch(`${API_BASE}/tasks/checklist/${id}`, {
      ...defaultOptions,
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_completed }),
    });
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch { return null; }
}

export async function deleteChecklistItem(id: number) {
  try {
    const res = await apiFetch(`${API_BASE}/tasks/checklist/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch { return null; }
}

export async function processRecurringTasks() {
  try {
    const res = await apiFetch(`${API_BASE}/tasks/process-recurring`, { method: "POST" });
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch { return null; }
}

// ====================== CURATORSHIP EXTENDED ======================

export async function fetchCuratorGroups(curatorId: number) {
  try {
    const res = await apiFetch(`${API_BASE}/curatorship/my-groups?curator_id=${curatorId}`);
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch { return []; }
}

export async function fetchCuratorStudents(curatorId: number) {
  try {
    const res = await apiFetch(`${API_BASE}/curatorship/my-students?curator_id=${curatorId}`);
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch { return []; }
}

export async function fetchCuratorMetrics(curatorId: number) {
  try {
    const res = await apiFetch(`${API_BASE}/curatorship/metrics?curator_id=${curatorId}`);
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch { return null; }
}

export async function fetchStudentDetails(studentId: number) {
  try {
    const res = await apiFetch(`${API_BASE}/curatorship/student/${studentId}/details`);
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch { return { ent_history: [], absences: [], notes: [] }; }
}

export async function fetchStudentMonthlyStats(studentId: number, from: string, to: string) {
  try {
    const res = await apiFetch(`${API_BASE}/curatorship/student/${studentId}/monthly-stats?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch { return { subjects: [], overall: null }; }
}

export async function fetchAttendanceGrid(groupId: number, from: string, to: string) {
  try {
    const res = await apiFetch(`${API_BASE}/curatorship/attendance-grid?group_id=${groupId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch { return { dates: [], students: [] }; }
}

export async function fetchAttendanceReconciliation(from: string, to: string, groupId?: number) {
  try {
    const q = new URLSearchParams({ from, to });
    if (groupId) q.set("group_id", String(groupId));
    const res = await apiFetch(`${API_BASE}/admin/attendance-reconciliation?${q.toString()}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch { return { dates: [], students: [], groups: [] }; }
}

// ====================== PARENT FEEDBACK ======================

export async function fetchParentFeedback(params: { curator_id?: number; student_id?: number } = {}) {
  try {
    const q = new URLSearchParams();
    if (params.curator_id) q.append("curator_id", String(params.curator_id));
    if (params.student_id) q.append("student_id", String(params.student_id));
    const res = await apiFetch(`${API_BASE}/parent-feedback?${q}`);
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch { return []; }
}

export async function createParentFeedback(data: { student_id: number; curator_id: number; date: string; notes?: string; status?: string }) {
  try {
    const res = await apiFetch(`${API_BASE}/parent-feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch { return null; }
}

export async function updateParentFeedback(id: number, data: Record<string, unknown>) {
  try {
    const res = await apiFetch(`${API_BASE}/parent-feedback/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch { return null; }
}

export async function deleteParentFeedback(id: number) {
  try {
    const res = await apiFetch(`${API_BASE}/parent-feedback/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch { return null; }
}

// ====================== CURATOR CALL TASKS ======================

export async function generateCallTasks(curatorId: number) {
  try {
    const res = await apiFetch(`${API_BASE}/curatorship/call-tasks/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ curator_id: curatorId }),
    });
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch { return null; }
}

export async function fetchCallTasks(curatorId: number, month?: string) {
  try {
    const q = new URLSearchParams({ curator_id: String(curatorId) });
    if (month) q.append("month", month);
    const res = await apiFetch(`${API_BASE}/curatorship/call-tasks?${q}`);
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch { return { tasks: [], total: 0, completed: 0, month: "" }; }
}

export async function updateCallTask(id: number, data: { status?: string; call_result?: string; notes?: string }) {
  try {
    const res = await apiFetch(`${API_BASE}/curatorship/call-tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch { return null; }
}

export async function fetchCallTasksSummary(month?: string) {
  try {
    const q = month ? `?month=${encodeURIComponent(month)}` : "";
    const res = await apiFetch(`${API_BASE}/curatorship/call-tasks/summary${q}`);
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch { return { summary: [], month: "" }; }
}

// ====================== TEACHER STUDENT FEEDBACK ======================

export async function generateTeacherFeedback(teacherId: number) {
  try {
    const res = await apiFetch(`${API_BASE}/teacher-feedback/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacher_id: teacherId }),
    });
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch { return null; }
}

export async function fetchTeacherFeedback(teacherId: number, month?: string) {
  try {
    const q = new URLSearchParams({ teacher_id: String(teacherId) });
    if (month) q.append("month", month);
    const res = await apiFetch(`${API_BASE}/teacher-feedback?${q}`);
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch { return { tasks: [], total: 0, completed: 0, month: "" }; }
}

export async function updateTeacherFeedback(id: number, comment: string) {
  try {
    const res = await apiFetch(`${API_BASE}/teacher-feedback/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment }),
    });
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch { return null; }
}

export async function fetchTeacherFeedbackByStudent(studentId: number, month?: string) {
  try {
    const q = new URLSearchParams({ student_id: String(studentId) });
    if (month) q.append("month", month);
    const res = await apiFetch(`${API_BASE}/teacher-feedback/by-student?${q}`);
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch { return []; }
}

export async function fetchTeacherFeedbackSummary(month?: string) {
  try {
    const q = month ? `?month=${encodeURIComponent(month)}` : "";
    const res = await apiFetch(`${API_BASE}/teacher-feedback/summary${q}`);
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch { return { summary: [], month: "" }; }
}

// ====================== TASK ATTACHMENTS ======================

export async function fetchTaskAttachments(taskId: number) {
  try {
    const res = await apiFetch(`${API_BASE}/tasks/${taskId}/attachments`);
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch { return []; }
}

export async function uploadTaskAttachment(taskId: number, file: File) {
  try {
    const form = new FormData();
    form.append("file", file);
    const res = await apiFetch(`${API_BASE}/tasks/${taskId}/attachments`, { method: "POST", body: form });
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch { return null; }
}

export async function deleteTaskAttachment(attachmentId: number) {
  try {
    const res = await apiFetch(`${API_BASE}/tasks/attachments/${attachmentId}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch { return null; }
}

// ====================== HEALTH ======================

export async function checkHealth() {
  try {
    const res = await apiFetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

// ====================== NOTES ======================

export async function fetchNotes(userId: number) {
  try {
    const res = await apiFetch(`${API_BASE}/notes?user_id=${userId}`);
    if (!res.ok) throw new Error("Failed to fetch notes");
    return await res.json();
  } catch { return []; }
}

export async function createNote(data: { user_id: number; date: string; time_slot?: string | null; title: string; description?: string | null }) {
  try {
    const res = await apiFetch(`${API_BASE}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create note");
    return await res.json();
  } catch { return null; }
}

export async function deleteNoteById(id: number) {
  try {
    const res = await apiFetch(`${API_BASE}/notes/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete note");
    return await res.json();
  } catch { return null; }
}

// ====================== NOTIFICATIONS ======================

export interface AppNotification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string | null;
  is_read: number;
  action_url: string | null;
  created_at: string;
}

export async function fetchMyNotifications(userId: number): Promise<AppNotification[]> {
  try {
    const res = await apiFetch(`${API_BASE}/notifications/my?user_id=${userId}`);
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch { return []; }
}

export async function markNotificationRead(id: number) {
  try {
    const res = await apiFetch(`${API_BASE}/notifications/${id}/read`, { method: "PATCH" });
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch { return null; }
}

// ====================== WIKI ======================

export async function fetchWikiCategories() {
  const res = await apiFetch(`${API_BASE}/wiki/categories`);
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

export async function createWikiCategory(name: string) {
  const res = await apiFetch(`${API_BASE}/wiki/categories`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

export async function updateWikiCategory(id: number, data: { name?: string; order_index?: number }) {
  const res = await apiFetch(`${API_BASE}/wiki/categories/${id}`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

export async function deleteWikiCategory(id: number) {
  const res = await apiFetch(`${API_BASE}/wiki/categories/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

export async function fetchWikiArticles(categoryId?: number) {
  const url = categoryId ? `${API_BASE}/wiki/articles?category_id=${categoryId}` : `${API_BASE}/wiki/articles`;
  const res = await apiFetch(url);
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

export async function fetchWikiArticle(id: number) {
  const res = await apiFetch(`${API_BASE}/wiki/articles/${id}`);
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

export async function createWikiArticle(data: { category_id: number; title: string; content?: string; author_id?: number }) {
  const res = await apiFetch(`${API_BASE}/wiki/articles`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

export async function updateWikiArticle(id: number, data: { title?: string; content?: string; category_id?: number }) {
  const res = await apiFetch(`${API_BASE}/wiki/articles/${id}`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

export async function deleteWikiArticle(id: number) {
  const res = await apiFetch(`${API_BASE}/wiki/articles/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

export async function markAllNotificationsRead(userId: number) {
  try {
    const res = await apiFetch(`${API_BASE}/notifications/read-all`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch { return null; }
}

// ====================== STORAGE ======================

export interface StorageFolder {
  id: number;
  name: string;
  parent_id: number | null;
  creator_id: number | null;
  icon: string | null;
  created_at: string;
}

export interface StorageItem {
  id: number;
  folder_id: number | null;
  name: string;
  type: "file" | "link";
  url_or_path: string;
  uploaded_by: number | null;
  icon: string | null;
  created_at: string;
}

export async function fetchStorageFolders(parentId?: number | null) {
  try {
    const param = parentId == null ? "null" : String(parentId);
    const res = await apiFetch(`${API_BASE}/storage/folders?parent_id=${param}`);
    if (!res.ok) throw new Error("Failed");
    return (await res.json()) as StorageFolder[];
  } catch { return []; }
}

export async function createStorageFolder(data: { name: string; parent_id?: number | null; creator_id?: number | null }) {
  const res = await apiFetch(`${API_BASE}/storage/folders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function deleteStorageFolder(id: number) {
  const res = await apiFetch(`${API_BASE}/storage/folders/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function updateStorageFolder(id: number, data: { name?: string; icon?: string | null }) {
  const res = await apiFetch(`${API_BASE}/storage/folders/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function fetchStorageItems(folderId?: number | null) {
  try {
    const param = folderId == null ? "null" : String(folderId);
    const res = await apiFetch(`${API_BASE}/storage/items?folder_id=${param}`);
    if (!res.ok) throw new Error("Failed");
    return (await res.json()) as StorageItem[];
  } catch { return []; }
}

export async function createStorageLink(data: { folder_id?: number | null; name: string; url_or_path: string; uploaded_by?: number | null }) {
  const res = await apiFetch(`${API_BASE}/storage/items/link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function uploadStorageFile(folderId: number | null, file: File, userId: number | null) {
  const form = new FormData();
  form.append("file", file);
  if (folderId != null) form.append("folder_id", String(folderId));
  if (userId != null) form.append("uploaded_by", String(userId));
  const res = await apiFetch(`${API_BASE}/storage/items/file`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function deleteStorageItem(id: number) {
  const res = await apiFetch(`${API_BASE}/storage/items/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function updateStorageItem(id: number, data: { name?: string; icon?: string | null }) {
  const res = await apiFetch(`${API_BASE}/storage/items/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

// ====================== DYNAMIC TABLES ======================

export async function fetchDynamicTables(userId?: number) {
  const url = userId ? `${API_BASE}/dynamic-tables?user_id=${userId}` : `${API_BASE}/dynamic-tables`;
  const res = await apiFetch(url);
  if (!res.ok) throw new Error("Failed to fetch tables");
  return res.json();
}

export async function createDynamicTable(data: { creator_id: number; title: string; columns_json: unknown[]; visibility: string }) {
  const res = await apiFetch(`${API_BASE}/dynamic-tables`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create table");
  return res.json();
}

export async function updateDynamicTable(id: number, data: { title?: string; columns_json?: unknown[]; visibility?: string }) {
  const res = await apiFetch(`${API_BASE}/dynamic-tables/${id}`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update table");
  return res.json();
}

export async function deleteDynamicTable(id: number) {
  const res = await apiFetch(`${API_BASE}/dynamic-tables/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete table");
  return res.json();
}

export async function fetchDynamicTableRows(tableId: number) {
  const res = await apiFetch(`${API_BASE}/dynamic-tables/${tableId}/rows`);
  if (!res.ok) throw new Error("Failed to fetch rows");
  return res.json();
}

export async function createDynamicTableRow(tableId: number, rowData: Record<string, unknown>) {
  const res = await apiFetch(`${API_BASE}/dynamic-tables/${tableId}/rows`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ row_data: rowData }),
  });
  if (!res.ok) throw new Error("Failed to create row");
  return res.json();
}

export async function updateDynamicTableRow(rowId: number, rowData: Record<string, unknown>) {
  const res = await apiFetch(`${API_BASE}/dynamic-table-rows/${rowId}`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ row_data: rowData }),
  });
  if (!res.ok) throw new Error("Failed to update row");
  return res.json();
}

export async function deleteDynamicTableRow(rowId: number) {
  const res = await apiFetch(`${API_BASE}/dynamic-table-rows/${rowId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete row");
  return res.json();
}

// ====================== BROADCASTS ======================

export async function fetchBroadcasts(userId: number) {
  const res = await apiFetch(`${API_BASE}/broadcasts?user_id=${userId}`);
  if (!res.ok) throw new Error("Failed to fetch broadcasts");
  return res.json();
}

export async function fetchUnreadBroadcastCount(userId: number) {
  const res = await apiFetch(`${API_BASE}/broadcasts/unread-count?user_id=${userId}`);
  if (!res.ok) throw new Error("Failed to fetch unread count");
  return res.json();
}

export async function createBroadcast(data: { author_id: number; title: string; content?: string; channel?: string; priority?: string }) {
  const res = await apiFetch(`${API_BASE}/broadcasts`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create broadcast");
  return res.json();
}

export async function markBroadcastRead(messageId: number, userId: number) {
  const res = await apiFetch(`${API_BASE}/broadcasts/${messageId}/read`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: userId }),
  });
  if (!res.ok) throw new Error("Failed to mark as read");
  return res.json();
}

export async function deleteBroadcast(messageId: number) {
  const res = await apiFetch(`${API_BASE}/broadcasts/${messageId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete broadcast");
  return res.json();
}

// ====================== ADMIN BANNERS ======================

export async function fetchActiveBanners() {
  const res = await apiFetch(`${API_BASE}/banners/active`);
  if (!res.ok) throw new Error("Failed to fetch banners");
  return res.json();
}

export async function fetchAllBanners() {
  const res = await apiFetch(`${API_BASE}/banners`);
  if (!res.ok) throw new Error("Failed to fetch banners");
  return res.json();
}

export async function createBanner(data: { text: string; type?: string; created_by: number; expires_at?: string }) {
  const res = await apiFetch(`${API_BASE}/banners`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create banner");
  return res.json();
}

export async function updateBanner(id: number, data: { text?: string; type?: string; is_active?: number; expires_at?: string }) {
  const res = await apiFetch(`${API_BASE}/banners/${id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update banner");
  return res.json();
}

export async function deleteBanner(id: number) {
  const res = await apiFetch(`${API_BASE}/banners/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete banner");
  return res.json();
}

export async function fetchAuditLog(params: { limit?: number; offset?: number; entity_type?: string; action?: string; search?: string; from?: string; to?: string } = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') query.set(k, String(v)); });
  const res = await apiFetch(`${API_BASE}/audit-log?${query.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch audit log");
  return res.json();
}

// ====================== CHAT ======================

export async function fetchChatMessages(room = 'general', limit = 100, before?: number) {
  const params = new URLSearchParams({ room, limit: String(limit) });
  if (before) params.set('before', String(before));
  const res = await apiFetch(`${API_BASE}/chat/messages?${params}`);
  if (!res.ok) throw new Error("Failed to fetch messages");
  return res.json();
}

export async function sendChatMessage(sender_id: number, text: string, room = 'general') {
  const res = await apiFetch(`${API_BASE}/chat/messages`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sender_id, text, room }),
  });
  if (!res.ok) throw new Error("Failed to send message");
  return res.json();
}

// ====================== DASHBOARD ======================

export async function fetchAttendanceStats(months = 6) {
  const res = await apiFetch(`${API_BASE}/dashboard/attendance-stats?months=${months}`);
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

// ====================== PERMISSIONS ======================

export async function fetchPermissions() {
  const res = await apiFetch(`${API_BASE}/permissions`);
  if (!res.ok) throw new Error("Failed to fetch permissions");
  return res.json();
}

export async function fetchRolesWithPermissions() {
  const res = await apiFetch(`${API_BASE}/roles`);
  if (!res.ok) throw new Error("Failed to fetch roles");
  return res.json();
}

export async function updateRolePermissions(roleId: number, permissionIds: number[]) {
  const res = await apiFetch(`${API_BASE}/roles/${roleId}/permissions`, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ permission_ids: permissionIds }),
  });
  if (!res.ok) throw new Error("Failed to update permissions");
  return res.json();
}

export async function fetchUserPermissions(userId: string) {
  const res = await apiFetch(`${API_BASE}/users/${userId}/permissions`);
  if (!res.ok) throw new Error("Failed to fetch user permissions");
  return res.json();
}
