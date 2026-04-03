# Code Citations

## License: unknown
https://github.com/Abhishekduggal/portfolio/blob/f80d4adef62412f13640cefc0763ef4e4f389e15/server/index.js

```
Есть два варианта в зависимости от того, насколько серьёзно нужно.

---

## Вариант 1: Быстро и бесплатно (Railway)

Самый простой способ для этого стека (Node.js + SQLite + Vite).

**Проблема:** SQLite хранит данные в файле на диске — на большинстве облачных платформ файлы **сбрасываются при перезапуске**. Railway поддерживает persistent volumes, поэтому подходит лучше всего.

1. Создать аккаунт на [railway.app](https://railway.app)
2. Загрузить код в GitHub репозиторий
3. В Railway: New Project → Deploy from GitHub → выбрать репо
4. Добавить переменную окружения: `PORT=3001`
5. Фронтенд собрать статикой и раздавать через тот же Express сервер

Для этого нужно изменить `server/index.js` — добавить отдачу собранного фронтенда:

```js
// В конец server/index.js, перед app.listen
const path = require("path");
app.use(express.static(path.join(__dirname, "../dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../dist/index.html"));
});
```

И в `package
```


## License: unknown
https://github.com/dylanpilsner/rock-paper-scissors-online/blob/0686d15fa1a60f6281de679dc2f69f79778c668c/server/index.ts

```
Есть два варианта в зависимости от того, насколько серьёзно нужно.

---

## Вариант 1: Быстро и бесплатно (Railway)

Самый простой способ для этого стека (Node.js + SQLite + Vite).

**Проблема:** SQLite хранит данные в файле на диске — на большинстве облачных платформ файлы **сбрасываются при перезапуске**. Railway поддерживает persistent volumes, поэтому подходит лучше всего.

1. Создать аккаунт на [railway.app](https://railway.app)
2. Загрузить код в GitHub репозиторий
3. В Railway: New Project → Deploy from GitHub → выбрать репо
4. Добавить переменную окружения: `PORT=3001`
5. Фронтенд собрать статикой и раздавать через тот же Express сервер

Для этого нужно изменить `server/index.js` — добавить отдачу собранного фронтенда:

```js
// В конец server/index.js, перед app.listen
const path = require("path");
app.use(express.static(path.join(__dirname, "../dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../dist/index.html"));
});
```

И в `package
```


## License: unknown
https://github.com/Abhishekduggal/portfolio/blob/f80d4adef62412f13640cefc0763ef4e4f389e15/server/index.js

```
Есть два варианта в зависимости от того, насколько серьёзно нужно.

---

## Вариант 1: Быстро и бесплатно (Railway)

Самый простой способ для этого стека (Node.js + SQLite + Vite).

**Проблема:** SQLite хранит данные в файле на диске — на большинстве облачных платформ файлы **сбрасываются при перезапуске**. Railway поддерживает persistent volumes, поэтому подходит лучше всего.

1. Создать аккаунт на [railway.app](https://railway.app)
2. Загрузить код в GitHub репозиторий
3. В Railway: New Project → Deploy from GitHub → выбрать репо
4. Добавить переменную окружения: `PORT=3001`
5. Фронтенд собрать статикой и раздавать через тот же Express сервер

Для этого нужно изменить `server/index.js` — добавить отдачу собранного фронтенда:

```js
// В конец server/index.js, перед app.listen
const path = require("path");
app.use(express.static(path.join(__dirname, "../dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../dist/index.html"));
});
```

И в `package
```


## License: unknown
https://github.com/dylanpilsner/rock-paper-scissors-online/blob/0686d15fa1a60f6281de679dc2f69f79778c668c/server/index.ts

```
Есть два варианта в зависимости от того, насколько серьёзно нужно.

---

## Вариант 1: Быстро и бесплатно (Railway)

Самый простой способ для этого стека (Node.js + SQLite + Vite).

**Проблема:** SQLite хранит данные в файле на диске — на большинстве облачных платформ файлы **сбрасываются при перезапуске**. Railway поддерживает persistent volumes, поэтому подходит лучше всего.

1. Создать аккаунт на [railway.app](https://railway.app)
2. Загрузить код в GitHub репозиторий
3. В Railway: New Project → Deploy from GitHub → выбрать репо
4. Добавить переменную окружения: `PORT=3001`
5. Фронтенд собрать статикой и раздавать через тот же Express сервер

Для этого нужно изменить `server/index.js` — добавить отдачу собранного фронтенда:

```js
// В конец server/index.js, перед app.listen
const path = require("path");
app.use(express.static(path.join(__dirname, "../dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../dist/index.html"));
});
```

И в `package
```


## License: unknown
https://github.com/Abhishekduggal/portfolio/blob/f80d4adef62412f13640cefc0763ef4e4f389e15/server/index.js

```
Есть два варианта в зависимости от того, насколько серьёзно нужно.

---

## Вариант 1: Быстро и бесплатно (Railway)

Самый простой способ для этого стека (Node.js + SQLite + Vite).

**Проблема:** SQLite хранит данные в файле на диске — на большинстве облачных платформ файлы **сбрасываются при перезапуске**. Railway поддерживает persistent volumes, поэтому подходит лучше всего.

1. Создать аккаунт на [railway.app](https://railway.app)
2. Загрузить код в GitHub репозиторий
3. В Railway: New Project → Deploy from GitHub → выбрать репо
4. Добавить переменную окружения: `PORT=3001`
5. Фронтенд собрать статикой и раздавать через тот же Express сервер

Для этого нужно изменить `server/index.js` — добавить отдачу собранного фронтенда:

```js
// В конец server/index.js, перед app.listen
const path = require("path");
app.use(express.static(path.join(__dirname, "../dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../dist/index.html"));
});
```

И в `package
```


## License: unknown
https://github.com/dylanpilsner/rock-paper-scissors-online/blob/0686d15fa1a60f6281de679dc2f69f79778c668c/server/index.ts

```
Есть два варианта в зависимости от того, насколько серьёзно нужно.

---

## Вариант 1: Быстро и бесплатно (Railway)

Самый простой способ для этого стека (Node.js + SQLite + Vite).

**Проблема:** SQLite хранит данные в файле на диске — на большинстве облачных платформ файлы **сбрасываются при перезапуске**. Railway поддерживает persistent volumes, поэтому подходит лучше всего.

1. Создать аккаунт на [railway.app](https://railway.app)
2. Загрузить код в GitHub репозиторий
3. В Railway: New Project → Deploy from GitHub → выбрать репо
4. Добавить переменную окружения: `PORT=3001`
5. Фронтенд собрать статикой и раздавать через тот же Express сервер

Для этого нужно изменить `server/index.js` — добавить отдачу собранного фронтенда:

```js
// В конец server/index.js, перед app.listen
const path = require("path");
app.use(express.static(path.join(__dirname, "../dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../dist/index.html"));
});
```

И в `package
```


## License: unknown
https://github.com/Abhishekduggal/portfolio/blob/f80d4adef62412f13640cefc0763ef4e4f389e15/server/index.js

```
Есть два варианта в зависимости от того, насколько серьёзно нужно.

---

## Вариант 1: Быстро и бесплатно (Railway)

Самый простой способ для этого стека (Node.js + SQLite + Vite).

**Проблема:** SQLite хранит данные в файле на диске — на большинстве облачных платформ файлы **сбрасываются при перезапуске**. Railway поддерживает persistent volumes, поэтому подходит лучше всего.

1. Создать аккаунт на [railway.app](https://railway.app)
2. Загрузить код в GitHub репозиторий
3. В Railway: New Project → Deploy from GitHub → выбрать репо
4. Добавить переменную окружения: `PORT=3001`
5. Фронтенд собрать статикой и раздавать через тот же Express сервер

Для этого нужно изменить `server/index.js` — добавить отдачу собранного фронтенда:

```js
// В конец server/index.js, перед app.listen
const path = require("path");
app.use(express.static(path.join(__dirname, "../dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../dist/index.html"));
});
```

И в `package
```


## License: unknown
https://github.com/dylanpilsner/rock-paper-scissors-online/blob/0686d15fa1a60f6281de679dc2f69f79778c668c/server/index.ts

```
Есть два варианта в зависимости от того, насколько серьёзно нужно.

---

## Вариант 1: Быстро и бесплатно (Railway)

Самый простой способ для этого стека (Node.js + SQLite + Vite).

**Проблема:** SQLite хранит данные в файле на диске — на большинстве облачных платформ файлы **сбрасываются при перезапуске**. Railway поддерживает persistent volumes, поэтому подходит лучше всего.

1. Создать аккаунт на [railway.app](https://railway.app)
2. Загрузить код в GitHub репозиторий
3. В Railway: New Project → Deploy from GitHub → выбрать репо
4. Добавить переменную окружения: `PORT=3001`
5. Фронтенд собрать статикой и раздавать через тот же Express сервер

Для этого нужно изменить `server/index.js` — добавить отдачу собранного фронтенда:

```js
// В конец server/index.js, перед app.listen
const path = require("path");
app.use(express.static(path.join(__dirname, "../dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../dist/index.html"));
});
```

И в `package
```


## License: unknown
https://github.com/Abhishekduggal/portfolio/blob/f80d4adef62412f13640cefc0763ef4e4f389e15/server/index.js

```
Есть два варианта в зависимости от того, насколько серьёзно нужно.

---

## Вариант 1: Быстро и бесплатно (Railway)

Самый простой способ для этого стека (Node.js + SQLite + Vite).

**Проблема:** SQLite хранит данные в файле на диске — на большинстве облачных платформ файлы **сбрасываются при перезапуске**. Railway поддерживает persistent volumes, поэтому подходит лучше всего.

1. Создать аккаунт на [railway.app](https://railway.app)
2. Загрузить код в GitHub репозиторий
3. В Railway: New Project → Deploy from GitHub → выбрать репо
4. Добавить переменную окружения: `PORT=3001`
5. Фронтенд собрать статикой и раздавать через тот же Express сервер

Для этого нужно изменить `server/index.js` — добавить отдачу собранного фронтенда:

```js
// В конец server/index.js, перед app.listen
const path = require("path");
app.use(express.static(path.join(__dirname, "../dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../dist/index.html"));
});
```

И в `package
```


## License: unknown
https://github.com/dylanpilsner/rock-paper-scissors-online/blob/0686d15fa1a60f6281de679dc2f69f79778c668c/server/index.ts

```
Есть два варианта в зависимости от того, насколько серьёзно нужно.

---

## Вариант 1: Быстро и бесплатно (Railway)

Самый простой способ для этого стека (Node.js + SQLite + Vite).

**Проблема:** SQLite хранит данные в файле на диске — на большинстве облачных платформ файлы **сбрасываются при перезапуске**. Railway поддерживает persistent volumes, поэтому подходит лучше всего.

1. Создать аккаунт на [railway.app](https://railway.app)
2. Загрузить код в GitHub репозиторий
3. В Railway: New Project → Deploy from GitHub → выбрать репо
4. Добавить переменную окружения: `PORT=3001`
5. Фронтенд собрать статикой и раздавать через тот же Express сервер

Для этого нужно изменить `server/index.js` — добавить отдачу собранного фронтенда:

```js
// В конец server/index.js, перед app.listen
const path = require("path");
app.use(express.static(path.join(__dirname, "../dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../dist/index.html"));
});
```

И в `package
```


## License: unknown
https://github.com/Abhishekduggal/portfolio/blob/f80d4adef62412f13640cefc0763ef4e4f389e15/server/index.js

```
Есть два варианта в зависимости от того, насколько серьёзно нужно.

---

## Вариант 1: Быстро и бесплатно (Railway)

Самый простой способ для этого стека (Node.js + SQLite + Vite).

**Проблема:** SQLite хранит данные в файле на диске — на большинстве облачных платформ файлы **сбрасываются при перезапуске**. Railway поддерживает persistent volumes, поэтому подходит лучше всего.

1. Создать аккаунт на [railway.app](https://railway.app)
2. Загрузить код в GitHub репозиторий
3. В Railway: New Project → Deploy from GitHub → выбрать репо
4. Добавить переменную окружения: `PORT=3001`
5. Фронтенд собрать статикой и раздавать через тот же Express сервер

Для этого нужно изменить `server/index.js` — добавить отдачу собранного фронтенда:

```js
// В конец server/index.js, перед app.listen
const path = require("path");
app.use(express.static(path.join(__dirname, "../dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../dist/index.html"));
});
```

И в `package
```


## License: unknown
https://github.com/dylanpilsner/rock-paper-scissors-online/blob/0686d15fa1a60f6281de679dc2f69f79778c668c/server/index.ts

```
Есть два варианта в зависимости от того, насколько серьёзно нужно.

---

## Вариант 1: Быстро и бесплатно (Railway)

Самый простой способ для этого стека (Node.js + SQLite + Vite).

**Проблема:** SQLite хранит данные в файле на диске — на большинстве облачных платформ файлы **сбрасываются при перезапуске**. Railway поддерживает persistent volumes, поэтому подходит лучше всего.

1. Создать аккаунт на [railway.app](https://railway.app)
2. Загрузить код в GitHub репозиторий
3. В Railway: New Project → Deploy from GitHub → выбрать репо
4. Добавить переменную окружения: `PORT=3001`
5. Фронтенд собрать статикой и раздавать через тот же Express сервер

Для этого нужно изменить `server/index.js` — добавить отдачу собранного фронтенда:

```js
// В конец server/index.js, перед app.listen
const path = require("path");
app.use(express.static(path.join(__dirname, "../dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../dist/index.html"));
});
```

И в `package
```


## License: unknown
https://github.com/Abhishekduggal/portfolio/blob/f80d4adef62412f13640cefc0763ef4e4f389e15/server/index.js

```
Есть два варианта в зависимости от того, насколько серьёзно нужно.

---

## Вариант 1: Быстро и бесплатно (Railway)

Самый простой способ для этого стека (Node.js + SQLite + Vite).

**Проблема:** SQLite хранит данные в файле на диске — на большинстве облачных платформ файлы **сбрасываются при перезапуске**. Railway поддерживает persistent volumes, поэтому подходит лучше всего.

1. Создать аккаунт на [railway.app](https://railway.app)
2. Загрузить код в GitHub репозиторий
3. В Railway: New Project → Deploy from GitHub → выбрать репо
4. Добавить переменную окружения: `PORT=3001`
5. Фронтенд собрать статикой и раздавать через тот же Express сервер

Для этого нужно изменить `server/index.js` — добавить отдачу собранного фронтенда:

```js
// В конец server/index.js, перед app.listen
const path = require("path");
app.use(express.static(path.join(__dirname, "../dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../dist/index.html"));
});
```

И в `package
```


## License: unknown
https://github.com/dylanpilsner/rock-paper-scissors-online/blob/0686d15fa1a60f6281de679dc2f69f79778c668c/server/index.ts

```
Есть два варианта в зависимости от того, насколько серьёзно нужно.

---

## Вариант 1: Быстро и бесплатно (Railway)

Самый простой способ для этого стека (Node.js + SQLite + Vite).

**Проблема:** SQLite хранит данные в файле на диске — на большинстве облачных платформ файлы **сбрасываются при перезапуске**. Railway поддерживает persistent volumes, поэтому подходит лучше всего.

1. Создать аккаунт на [railway.app](https://railway.app)
2. Загрузить код в GitHub репозиторий
3. В Railway: New Project → Deploy from GitHub → выбрать репо
4. Добавить переменную окружения: `PORT=3001`
5. Фронтенд собрать статикой и раздавать через тот же Express сервер

Для этого нужно изменить `server/index.js` — добавить отдачу собранного фронтенда:

```js
// В конец server/index.js, перед app.listen
const path = require("path");
app.use(express.static(path.join(__dirname, "../dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../dist/index.html"));
});
```

И в `package
```

