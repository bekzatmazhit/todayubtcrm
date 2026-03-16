import { Lesson } from "@/data/mockSchedule";
import { MOCK_LESSONS } from "@/data/mockSchedule";

const STORAGE_KEY = "today_crm_lessons";

export function loadLessons(): Lesson[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return MOCK_LESSONS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return MOCK_LESSONS;
    return parsed;
  } catch (err) {
    console.error("loadLessons", err);
    return MOCK_LESSONS;
  }
}

export function saveLessons(lessons: Lesson[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lessons));
  } catch (err) {
    console.error("saveLessons", err);
  }
}

export function clearLessons() {
  localStorage.removeItem(STORAGE_KEY);
}
