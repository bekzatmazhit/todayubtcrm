# 🚀 TODAY CRM - База данных и запуск

## ✅ Что было реализовано

1. **SQLite база данных** - создана в папке `server/`
2. **Express API сервер** на порту 3001
3. **Загрузка CSV данных** - пользователи из `database_today - users.csv` автоматически импортированы в БД
4. **API endpoints** для получения пользователей, уроков и студентов

---

## 🗄️ Структура базы данных

### Таблицы:

- **users** - пользователи (учителя, администраторы, УМО)
  - id, name, surname, phone, email, role_id

- **roles** - роли (admin=1, umo_head=2, teacher=3)

- **subjects** - учебные предметы

- **groups** - группы студентов

- **lessons** - уроки  
  - time_slot, room, group_id, subject_id, teacher_id, date

- **students** - студенты
  - full_name, lesson_id

- **attendance** - посещаемость
  - student_id, lesson_id, status, lateness, homework, comment

---

## 🔧 Запуск

### Вариант 1: Запустить оба сервера одновременно

```bash
npm run dev:all
```

Это запустит:
- Backend: http://localhost:3001
- Frontend (Vite): http://localhost:8080 (или другой порт)

### Вариант 2: Запустить отдельно

**Терминал 1 - Backend:**
```bash
npm run server
```

**Терминал 2 - Frontend:**
```bash
npm run dev
```

---

## 📡 API Endpoints

```
GET  /api/health              - Проверка статуса сервера

GET  /api/users               - Все пользователи
GET  /api/users/:id           - Пользователь по ID

GET  /api/lessons             - Все уроки со студентами
GET  /api/lessons/teacher/:id - Уроки учителя

GET  /api/subjects            - Все предметы
GET  /api/groups              - Все группы

POST /api/attendance          - Обновить посещаемость
```

---

## 📝 Как добавить реальные данные

### Вариант 1: Напрямую в базу (через сервер)

1. Создай CSV файл с уроками/предметами/группами
2. Обнови `server/index.js` функциями для импорта этих данных

### Вариант 2: Использовать Settings страницу

На странице Settings добавлен импорт CSV для студентов:
- Загрузи CSV с колонками: `lesson_id`, `full_name`
- Студенты будут добавлены к соответствующим урокам

---

## 🗂️ Файлы проекта

```
server/
├── index.js          - Express сервер
├── db.js             - Инициализация SQLite
└── database.sqlite   - БД файл (создается автоматически)

src/lib/
├── api.ts            - API клиент для фронтенда
└── storage.ts        - LocalStorage функции (устаревает)
```

---

## ⚡ Следующие шаги

1. **Добавь реальные предметы/группы** - отредактируй таблицы через эндпоинты или SQL
2. **Синхронизируй фронтенд** - обнови `CalendarPage.tsx` для использования API вместо MOCK данных
3. **Добавь страницы управления** - для редактирования предметов, групп, уроков в UI

---

## 🐛 Если версия не работает

1. Проверь, запущен ли сервер на 3001
2. Проверь консоль браузера на ошибки CORS
3. Удали `server/database.sqlite` и перезапусти - БД пересоздастся

```bash
rm server/database.sqlite
npm run server
```
