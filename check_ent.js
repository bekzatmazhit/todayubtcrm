import Database from 'better-sqlite3';
const db = new Database('server/database.sqlite');

// Which groups have ENT results?
const groupsWithEnt = db.prepare(`
  SELECT g.id, g.name, g.profile_id, p.name as pn, COUNT(DISTINCT e.student_id) as students_with_ent
  FROM ent_results e
  JOIN students s ON e.student_id = s.id
  JOIN groups g ON s.group_id = g.id
  LEFT JOIN profiles p ON g.profile_id = p.id
  GROUP BY g.id ORDER BY g.id
`).all();
console.log('Groups with ENT results:');
groupsWithEnt.forEach(g => console.log(`  ${g.id} ${g.name} profile=${g.profile_id}(${g.pn}) students=${g.students_with_ent}`));

// Check which subject_ids exist per group
console.log('\nSubjects per group:');
for (const g of groupsWithEnt) {
  const subs = db.prepare(`
    SELECT DISTINCT subj.id, subj.name FROM ent_results e
    JOIN students s ON e.student_id = s.id
    JOIN subjects subj ON e.subject_id = subj.id
    WHERE s.group_id = ? ORDER BY subj.id
  `).all(g.id);
  console.log(`  ${g.name}(${g.pn}): ${subs.map(s => s.name).join(', ')}`);
}

// CSV check: read first few data rows to see patterns
import { readFileSync } from 'fs';
const csvPath = 'database_today - ent_results.csv';
try {
  const csv = readFileSync(csvPath, 'utf-8');
  const lines = csv.trim().split('\n');
  console.log('\nCSV headers:', lines[0]);
  console.log('CSV row 1:', lines[1]);
  console.log('CSV row 2:', lines[2]);
} catch(e) { console.log('CSV not at', csvPath); }

db.close();
