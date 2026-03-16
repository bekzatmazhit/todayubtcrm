export interface Student {
  id: string;
  full_name: string;
  attendance: "present" | "absent";
  lateness: "on_time" | "5m" | "15m_plus";
  homework: "done" | "partial" | "not_done";
  comment: string;
}

export interface Lesson {
  id: string;
  time_slot: string;
  room: string;
  group_name: string;
  subject: string;
  teacher_id: string;
  teacher_name: string;
  students: Student[];
}

const studentNames = [
  "Aisultan Karimov", "Dana Ospanova", "Arman Zhunisov", "Aisha Nurbekova",
  "Timur Sakenov", "Madina Rakhimova", "Bekzat Yergaliyev", "Zarina Tulegenova",
];

function makeStudents(count: number): Student[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `s-${crypto.randomUUID().slice(0, 8)}`,
    full_name: studentNames[i % studentNames.length],
    attendance: "present" as const,
    lateness: "on_time" as const,
    homework: "done" as const,
    comment: "",
  }));
}

export const TIME_SLOTS = [
  "08:00 – 08:45",
  "09:00 – 09:45",
  "10:00 – 10:45",
  "11:00 – 11:45",
  "12:00 – 12:45",
  "13:00 – 13:45",
  "14:00 – 14:45",
  "15:00 – 15:45",
];

export const ROOMS = ["Room 101", "Room 102", "Room 203", "Room 204", "Lab A", "Lab B"];

const subjects = ["Mathematics", "Physics", "English", "History", "Chemistry", "Biology", "IT", "Literature"];
const groups = ["Group A-11", "Group B-12", "Group C-21", "Group D-22", "Group E-31", "Group F-32"];

export const MOCK_LESSONS: Lesson[] = [];

let lessonIdx = 0;
for (const slot of TIME_SLOTS) {
  for (const room of ROOMS) {
    if (Math.random() > 0.4) {
      const teacherIdx = lessonIdx % 3;
      const teacherIds = ["3", "t2", "t3"];
      const teacherNames = ["Ustaz Amir", "Ustaz Marat", "Ustaz Dinara"];
      MOCK_LESSONS.push({
        id: `lesson-${lessonIdx}`,
        time_slot: slot,
        room,
        group_name: groups[lessonIdx % groups.length],
        subject: subjects[lessonIdx % subjects.length],
        teacher_id: teacherIds[teacherIdx],
        teacher_name: teacherNames[teacherIdx],
        students: makeStudents(6 + Math.floor(Math.random() * 4)),
      });
      lessonIdx++;
    }
  }
}
