# HMI JSON Editor

A lightweight web-based visual editor for ESP-HMI JSON projects (v1/v2).
Works locally via `http://localhost` and can be published on GitHub Pages.

---

## English

### Local usage

1. Put all files into a folder, e.g. `hmi-editor/`.
2. Start a local server in that folder: python -m http.server 8000
3. Open `http://localhost:8000/` in Chrome or Edge.

`file://` will not work for ES modules or Web Serial.

### Upload UI to display

The "Upload to display" button requires:
- Chrome or Edge,
- `http://localhost` or `https://`,
- firmware already flashed and waiting for `ehmi <size>`.

It packs the current JSON into `ui.ehmi` (32-byte `EHMI` header + JSON) and sends it over Web Serial in 1024-byte chunks with `HMI+ACK` handshake.

### Publish on GitHub Pages

1. Push the folder contents to a GitHub repository.
2. Go to `Settings → Pages → Deploy from a branch`, select `main` and `/ (root)`.
3. Open `https://username.github.io/repo-name/`.

### Files

- `index.html` — entry point.
- `css/style.css` — styles.
- `js/app.js` — initialization, load/save/upload.
- `js/editor.js` — canvas, drag, properties, pages, device, bindings, arduino.
- `js/json.js` — JSON load/save.
- `js/ehmi.js` — pack JSON into `ui.ehmi`.
- `js/serial.js` — Web Serial upload.

---
## Русский

### Локальный запуск

1. Положите все файлы в папку, например `hmi-editor/`.
2. Запустите локальный сервер в этой папке:
python -m http.server 8000
3. Откройте `http://localhost:8000/` в Chrome или Edge.

`file://` не подходит: ES-модули и Web Serial там не работают.

### Заливка UI в дисплей

Кнопка "Upload to display" требует:
- Chrome или Edge,
- `http://localhost` или `https://`,
- прошивка уже залита и ждёт `ehmi <size>`.

Редактор упаковывает текущий JSON в `ui.ehmi` (32-байтный заголовок `EHMI` + JSON) и отправляет его через Web Serial порциями по 1024 байта с подтверждением `HMI+ACK`.

### Публикация на GitHub Pages

1. Залейте содержимое папки в репозиторий GitHub.
2. Откройте `Settings → Pages → Deploy from a branch`, выберите `main` и `/ (root)`.
3. Откройте `https://username.github.io/repo-name/`.

### Файлы

- `index.html` — точка входа.
- `css/style.css` — стили.
- `js/app.js` — инициализация, загрузка/сохранение/заливка.
- `js/editor.js` — холст, drag, свойства, страницы, устройство, привязки, Arduino.
- `js/json.js` — загрузка/сохранение JSON.
- `js/ehmi.js` — упаковка JSON в `ui.ehmi`.
- `js/serial.js` — заливка через Web Serial.