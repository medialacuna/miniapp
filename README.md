# HeartWins · Awareness Miniapp (Telegram / VK)

Мини-приложение Колесо осознанности:

- Авторизация через:
  - Telegram Mini App (`/api/auth/telegram`)
  - VK Mini App (`/api/auth/vk`)
  - или standalone-гость (`/api/auth/guest`) для обычного браузера
- Без e-mail / паролей, без SMTP
- Файловая "БД" в `users.json`
- Кликер кармы, Колесо, Викторина

## Запуск локально

```bash
npm install
npm start
# http://localhost:3000
```

## Деплой на Render

- Build command: `npm install`
- Start command: `npm start`
- Root directory: (оставить пустым, если файлы в корне)
