const db = require('better-sqlite3')('server/database.sqlite');

try {
  db.exec('BEGIN TRANSACTION');

  const keepId = 505;

  const studentsToDelete = db.prepare('SELECT id FROM students WHERE id != ?').all(keepId).map(s => s.id);

  console.log(`Found ${studentsToDelete.length} students to delete...`);

  if (studentsToDelete.length > 0) {
    const tablesToClean = [
      'attendance',
      'ent_results',
      'schedule_students',
      'adhoc_lesson_students',
      'quiz_results',
      'ent_certificates',
      'admission_custom_values',
      'curator_call_tasks',
      'notes',
      'curatorship_logs',
      'teacher_student_feedback'
    ];

    for (const table of tablesToClean) {
      try {
        const info = db.prepare(`PRAGMA table_info(${table})`).all();
        if (info.some(c => c.name === 'student_id')) {
          const res = db.prepare(`DELETE FROM ${table} WHERE student_id != ?`).run(keepId);
          console.log(`Deleted ${res.changes} rows from ${table}`);
        }
      } catch (e) {
        console.error(`Error checking/cleaning table ${table}:`, e.message);
      }
    }

    // Now delete the students themselves
    const res = db.prepare(`DELETE FROM students WHERE id != ?`).run(keepId);
    console.log(`Deleted ${res.changes} students from students table.`);
  }

  db.exec('COMMIT');
  console.log('Cleanup complete!');
} catch (error) {
  if (db.inTransaction) db.exec('ROLLBACK');
  console.error('Failed to clean up students:', error);
}
