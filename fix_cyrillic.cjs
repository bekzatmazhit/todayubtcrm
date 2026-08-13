const fs = require('fs');
const files = [
  'UsersTab.tsx', 'StudentsTab.tsx', 'GroupsTab.tsx', 'SubjectsTab.tsx', 
  'PermissionsTab.tsx', 'BannersTab.tsx', 'HealthTab.tsx', 'AuditTab.tsx'
];

for (const file of files) {
  const filepath = 'src/pages/admin-tabs/' + file;
  let content = fs.readFileSync(filepath, 'utf8');

  // Fix ROLE_LABELS in all files
  content = content.replace(
    /const ROLE_LABELS: Record<string, string> = \{ teacher:.*?\};/,
    'const ROLE_LABELS: Record<string, string> = { teacher: "Устаз", umo_head: "УМО", admin: "Админ" };'
  );

  // Fix SUBJECT_TYPE_LABELS in SubjectsTab
  if (file === 'SubjectsTab.tsx') {
    content = content.replace(
      /const SUBJECT_TYPE_LABELS: Record<string, string> = \{.*?\};/,
      'const SUBJECT_TYPE_LABELS: Record<string, string> = { mandatory: "Обязательный", elective: "Элективный", extra: "Доп." };'
    );
  }

  // Fix BANNER_TYPE_CONFIG in BannersTab
  if (file === 'BannersTab.tsx') {
    content = content.replace(
      /const BANNER_TYPE_CONFIG.*?\};/s,
      `const BANNER_TYPE_CONFIG: Record<string, { label: string; color: string; icon: typeof Info }> = {
  info: { label: "Инфо", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", icon: Info },
  warning: { label: "Внимание", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", icon: AlertTriangle },
  danger: { label: "Критический", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300", icon: AlertCircle },
};`.trim()
    );
  }

  // Fix ACTION_LABELS and ENTITY_LABELS in AuditTab
  if (file === 'AuditTab.tsx') {
    content = content.replace(
      /const ACTION_LABELS:.*?\};/s,
      `const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  login: { label: "Вход", color: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  create: { label: "Создание", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  update: { label: "Изменение", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  delete: { label: "Удаление", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
};`.trim()
    );
    
    content = content.replace(
      /const ENTITY_LABELS:.*?\};/s,
      `const ENTITY_LABELS: Record<string, string> = {
  user: "Пользователь",
  student: "Ученик",
  group: "Группа",
  subject: "Предмет",
  schedule: "Расписание",
  task: "Задача",
  wiki_category: "Категория Wiki",
  wiki_article: "Статья Wiki",
  dynamic_table: "Таблица",
  banner: "Баннер",
  broadcast: "Объявление",
  storage_folder: "Папка",
};`.trim()
    );
  }

  fs.writeFileSync(filepath, content, 'utf8');
}
console.log('Fixed cyrillic labels in all tabs.');
