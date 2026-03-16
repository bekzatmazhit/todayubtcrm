// Import ENT results from CSV into the database
// Usage: node import_ent_data.js

import Database from "better-sqlite3";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "server", "database.sqlite");

console.log("Opening database:", dbPath);
const db = Database(dbPath);

// Ensure "Грамотность чтения" subject exists (id=8)
db.prepare(
  "INSERT OR IGNORE INTO subjects (id, name, type) VALUES (8, 'Грамотность чтения', 'mandatory')"
).run();
console.log('✅ Subject "Грамотность чтения" ensured (id=8)');

// Profile → [subject4_id, subject5_id]
// CSV pos4 = Математика/Биология, pos5 = Информатика/Физика/Химия
const PROFILE_SUBJECTS = {
  1: [2, 4], // Мат-Инфо (ИНФМАТ): Математика, Информатика
  2: [2, 5], // Мат-Физ (ФМ): Математика, Физика
  3: [6, 7], // Био-Хим (ХБ): Биология, Химия
};

// CSV position → subject_id (mandatory, same for all)
const MANDATORY = { 1: 1, 2: 8, 3: 3 };

// Month name in CSV → YYYY-MM (academic year 2025–2026)
const MONTH_MAP = {
  september: "2025-09",
  october: "2025-10",
  november: "2025-11",
  december: "2025-12",
  january: "2026-01",
  february: "2026-02",
  march: "2026-03",
  april: "2026-04",
};

// Read CSV
const csvPath = path.join(
  "C:\\Users\\bekza\\Downloads",
  "database_today - database_today_ent_results_filled.csv"
);
console.log("Reading CSV:", csvPath);
const csv = readFileSync(csvPath, "utf-8");
const lines = csv.trim().split("\n").map((l) => l.trim());
const headers = lines[0].split(",");

// Build column name → index map
const colIndex = {};
for (let i = 0; i < headers.length; i++) {
  if (headers[i]) colIndex[headers[i]] = i;
}

console.log(`CSV: ${headers.length} columns, ${lines.length - 1} data rows`);

// Prepared statements
const getStudent = db.prepare(`
  SELECT s.group_id, g.profile_id
  FROM students s JOIN groups g ON s.group_id = g.id
  WHERE s.id = ?
`);
const upsert = db.prepare(`
  INSERT INTO ent_results (student_id, subject_id, score, month)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(student_id, subject_id, month) DO UPDATE SET score = excluded.score
`);

let imported = 0;
let skippedMonths = 0;
const errors = [];

const tx = db.transaction(() => {
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const studentId = parseInt(cols[1]);
    if (!studentId || isNaN(studentId)) continue;

    const student = getStudent.get(studentId);
    if (!student) {
      errors.push(`student_id ${studentId} not found in DB`);
      continue;
    }

    const profileSubs = PROFILE_SUBJECTS[student.profile_id];
    if (!profileSubs) {
      errors.push(`unknown profile_id ${student.profile_id} for student ${studentId}`);
      continue;
    }

    // Full subject map: CSV position → subject_id
    const subjectMap = {
      1: MANDATORY[1],
      2: MANDATORY[2],
      3: MANDATORY[3],
      4: profileSubs[0],
      5: profileSubs[1],
    };

    for (const [monthName, monthValue] of Object.entries(MONTH_MAP)) {
      // Read all 5 scores for this month
      const scores = [];
      for (let pos = 1; pos <= 5; pos++) {
        const ci = colIndex[`${monthName}${pos}`];
        if (ci === undefined) {
          scores.push(null);
          continue;
        }
        const raw = cols[ci]?.trim();
        if (!raw || raw === "") {
          scores.push(null);
        } else {
          scores.push(parseFloat(raw));
        }
      }

      // Skip if all values are null/empty
      if (scores.every((v) => v === null)) continue;

      // Skip if all values are 0 (student didn't take the test)
      const total = scores.reduce((s, v) => s + (v || 0), 0);
      if (total === 0) {
        skippedMonths++;
        continue;
      }

      // Insert each subject score
      for (let pos = 1; pos <= 5; pos++) {
        const score = scores[pos - 1];
        if (score === null) continue;
        upsert.run(studentId, subjectMap[pos], Math.round(score), monthValue);
        imported++;
      }
    }
  }
});

tx();

console.log(`\n✅ Import complete!`);
console.log(`   Records imported/updated: ${imported}`);
console.log(`   Months skipped (all zeros): ${skippedMonths}`);
if (errors.length > 0) {
  console.log(`   Errors (${errors.length}):`);
  errors.forEach((e) => console.log(`     - ${e}`));
}

// Verify
const count = db.prepare("SELECT COUNT(*) as c FROM ent_results").get();
console.log(`\n   Total records in ent_results: ${count.c}`);

const sample = db
  .prepare(
    `SELECT s.full_name, subj.name as subject, e.score, e.month
     FROM ent_results e
     JOIN students s ON e.student_id = s.id
     JOIN subjects subj ON e.subject_id = subj.id
     WHERE e.student_id = 401
     ORDER BY e.month, subj.name`
  )
  .all();
console.log(`\n   Sample data for student 401 (${sample[0]?.full_name || "?"}):`);
for (const r of sample) {
  console.log(`     ${r.month} | ${r.subject}: ${r.score}`);
}

db.close();
console.log("\nDone.");
