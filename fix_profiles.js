import Database from 'better-sqlite3';
const db = Database('./server/database.sqlite');

// Fix profile names
db.prepare("UPDATE profiles SET name = 'Математика-Информатика' WHERE id = 1").run();
db.prepare("UPDATE profiles SET name = 'Математика-Физика' WHERE id = 2").run();
db.prepare("UPDATE profiles SET name = 'Биология-Химия' WHERE id = 3").run();

// Fix group profile_ids to match user's reference
db.prepare('UPDATE groups SET profile_id = 1 WHERE id IN (1, 2)').run(); // were 3
db.prepare('UPDATE groups SET profile_id = 2 WHERE id IN (13, 14)').run(); // were 1
db.prepare('UPDATE groups SET profile_id = 3 WHERE id = 15').run(); // was 2
db.prepare('UPDATE groups SET profile_id = 1 WHERE id = 16').run(); // was 3

console.log('=== PROFILES ===');
console.log(db.prepare('SELECT * FROM profiles').all());
console.log('\n=== GROUPS ===');
console.log(db.prepare('SELECT id, name, profile_id FROM groups ORDER BY id').all());
db.close();
