import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "server/database.sqlite");

function toLatin(str) {
  // Simple Cyrillic to Latin transliteration
  const map = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
    А: "A", Б: "B", В: "V", Г: "G", Д: "D", Е: "E", Ё: "E", Ж: "Zh", З: "Z", И: "I", Й: "I", К: "K", Л: "L", М: "M", Н: "N", О: "O", П: "P", Р: "R", С: "S", Т: "T", У: "U", Ф: "F", Х: "H", Ц: "Ts", Ч: "Ch", Ш: "Sh", Щ: "Sh", Ъ: "", Ы: "Y", Ь: "", Э: "E", Ю: "Yu", Я: "Ya",
    " ": "", "’": "", "'": "", '"': "", ".": "", ",": "", "-": "", "_": ""
  };
  return str.split("").map(c => map[c] !== undefined ? map[c] : c).join("");
}

try {
  const db = new Database(dbPath);

  // Get all users
  const users = db.prepare("SELECT id, name, surname FROM users").all();

  console.log(`\n📋 Found ${users.length} users\n`);

  // Update each user with email
  const updateStmt = db.prepare("UPDATE users SET email = ? WHERE id = ?");

  users.forEach(user => {
    const name = toLatin(user.name?.toString().trim().toLowerCase() || 'user');
    const surname = toLatin(user.surname?.toString().trim().toLowerCase() || 'today');
    const email = `${name}.${surname}@today.edu`;
    try {
      updateStmt.run(email, user.id);
      console.log(`✅ User ${user.id}: ${email}`);
    } catch (err) {
      console.error(`❌ Error updating user ${user.id}:`, err.message);
    }
  });

  // Display all users with emails
  console.log("\n🔐 ===== ALL USERS WITH CREDENTIALS =====\n");
  const allUsers = db.prepare(`
    SELECT u.id, u.name, u.surname, u.email, u.password, r.name as role 
    FROM users u 
    JOIN roles r ON u.role_id = r.id 
    ORDER BY u.id
  `).all();

  allUsers.forEach(user => {
    console.log(`Email: ${user.email}`);
    console.log(`Password: ${user.password}`);
    console.log(`${user.name} ${user.surname} (${user.role})\n`);
  });

  console.log("================================\n");
  db.close();
} catch (err) {
  console.error("Error:", err.message);
  process.exit(1);
}
