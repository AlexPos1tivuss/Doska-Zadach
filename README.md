# Менеджер задач

Веб-приложение для управления задачами в стиле Trello. Доски, списки, карточки — всё на русском языке.

---

## Технологии

### Frontend
| Технология | Назначение |
|---|---|
| React 18 | UI-фреймворк |
| TypeScript | Типизация |
| Vite | Сборщик, dev-сервер |
| TanStack React Query v5 | Серверное состояние, кэш, запросы |
| wouter | Клиентский роутинг |
| @hello-pangea/dnd | Drag-and-drop карточек и списков |
| Tailwind CSS | Утилитарные стили |
| shadcn/ui (Radix UI) | UI-компоненты |
| lucide-react | Иконки |
| canvas-confetti | Анимация конфетти |

### Backend
| Технология | Назначение |
|---|---|
| Node.js + Express | HTTP-сервер |
| TypeScript + tsx | Запуск сервера в dev-режиме |
| Passport.js (local) | Аутентификация |
| bcrypt | Хэширование паролей |
| express-session | Сессии |
| connect-pg-simple | Хранение сессий в PostgreSQL |

### База данных
| Технология | Назначение |
|---|---|
| PostgreSQL | СУБД |
| Drizzle ORM | ORM, работа с таблицами |
| drizzle-zod | Генерация Zod-схем из Drizzle-таблиц |
| Zod | Валидация входных данных |

---

## Архитектура проекта

```
/
├── client/                  — Frontend (React)
│   └── src/
│       ├── App.tsx          — Роутер, ProtectedRoute
│       ├── main.tsx         — Точка входа React
│       ├── index.css        — Глобальные стили, CSS-переменные, анимации
│       ├── pages/           — Страницы приложения
│       ├── components/      — Переиспользуемые компоненты
│       │   └── ui/          — Базовые UI-компоненты (shadcn)
│       ├── hooks/           — React-хуки
│       └── lib/             — Утилиты, клиент запросов
│
├── server/                  — Backend (Express)
│   ├── index.ts             — Точка входа сервера
│   ├── routes.ts            — API-маршруты, аутентификация
│   ├── storage.ts           — Интерфейс и реализация работы с БД
│   └── db.ts                — Подключение к PostgreSQL
│
├── shared/
│   └── schema.ts            — Drizzle-схема БД, Zod-схемы, TypeScript-типы
│
├── drizzle.config.ts        — Конфигурация Drizzle Kit
└── vite.config.ts           — Конфигурация Vite
```

---

## Сущности (модели данных)

### User — Пользователь
```
id          UUID (PK, автогенерация)
username    string, уникальный логин
password    string, хэш bcrypt
displayName string, отображаемое имя
role        string, роль ("преподаватель" | "начальник кафедры")
```

### Board — Доска
```
id       UUID (PK)
title    string, название доски
ownerId  UUID → users.id, владелец
color    string, HEX-цвет фона
```

### BoardMember — Участник доски
```
id      UUID (PK)
boardId UUID → boards.id (cascade delete)
userId  UUID → users.id
```
Связывает пользователей с досками, к которым им дан доступ. Владелец не хранится в этой таблице — проверяется через `boards.ownerId`.

### List — Список (колонка)
```
id       UUID (PK)
title    string, название колонки
boardId  UUID → boards.id (cascade delete)
position integer, порядковый номер
```

### Card — Карточка
```
id          UUID (PK)
title       string, заголовок
description string, описание
listId      UUID → lists.id (cascade delete)
position    integer, порядок внутри списка
labels      JSONB (string[]), цветные метки
completed   boolean, выполнена ли задача
assigneeId  UUID → users.id, исполнитель (nullable)
deadline    timestamp, дедлайн (nullable)
```

### ChecklistItem — Пункт чеклиста
```
id       UUID (PK)
cardId   UUID → cards.id (cascade delete)
text     string, текст пункта
checked  boolean, отмечен ли
position integer, порядок
```

### Notification — Уведомление
```
id        UUID (PK)
userId    UUID → users.id (cascade delete)
type      string, тип (см. ниже)
title     string, заголовок уведомления
message   string, текст уведомления
read      boolean, прочитано ли (по умолчанию false)
boardId   UUID → boards.id (cascade, nullable)
cardId    UUID → cards.id (cascade, nullable)
createdAt timestamp, время создания (автогенерация)
```

Типы уведомлений:
| Тип | Событие |
|---|---|
| `task_assigned` | Пользователю назначена задача |
| `board_invite` | Пользователь приглашён на доску |
| `board_joined` | Владелец доски узнаёт о новом участнике |
| `task_completed` | Исполнитель узнаёт, что его задачу отметили выполненной |
| `deadline_warning` | Автоматическое предупреждение о дедлайне (менее 24 часов) |

---

## Схема базы данных

```
users
  ├─< boards (ownerId)
  │     ├─< board_members (boardId) >─ users
  │     ├─< lists (boardId)
  │     │     └─< cards (listId)
  │     │           ├── assigneeId → users
  │     │           └─< checklist_items (cardId)
  │     └─< notifications (boardId)
  └─< notifications (userId)
```

Все дочерние таблицы используют `CASCADE DELETE` — при удалении доски удаляются все её списки, карточки и пункты чеклистов.

---

## Слой хранения данных

### Интерфейс `IStorage` (`server/storage.ts`)

Определяет контракт для всех операций с данными:

| Метод | Описание |
|---|---|
| `getUser(id)` | Найти пользователя по ID |
| `getUserByUsername(username)` | Найти пользователя по логину |
| `createUser(data)` | Создать пользователя |
| `getBoards(userId)` | Получить все доски пользователя (свои + приглашённые) |
| `getBoard(id)` | Найти доску по ID |
| `createBoard(data)` | Создать доску |
| `deleteBoard(id)` | Удалить доску |
| `getBoardMembers(boardId)` | Получить участников доски |
| `addBoardMember(boardId, userId)` | Добавить участника |
| `removeBoardMember(memberId)` | Удалить участника |
| `isBoardMember(boardId, userId)` | Проверить, есть ли доступ |
| `getList(id)` | Найти список по ID |
| `getListsWithCards(boardId)` | Получить все списки с вложенными карточками |
| `createList(data)` | Создать список |
| `deleteList(id)` | Удалить список |
| `getCard(id)` | Найти карточку по ID |
| `createCard(data)` | Создать карточку |
| `updateCard(id, data)` | Обновить поля карточки |
| `deleteCard(id)` | Удалить карточку |
| `moveCard(id, listId, position)` | Переместить карточку в другой список |
| `getChecklistItems(cardId)` | Получить пункты чеклиста |
| `createChecklistItem(data)` | Добавить пункт |
| `updateChecklistItem(id, data)` | Обновить пункт (текст, состояние) |
| `deleteChecklistItem(id)` | Удалить пункт |
| `getNotifications(userId)` | Все уведомления пользователя (по убыванию даты) |
| `createNotification(data)` | Создать уведомление |
| `markNotificationRead(id)` | Отметить одно уведомление как прочитанное |
| `markAllNotificationsRead(userId)` | Прочитать все уведомления пользователя |
| `getUnreadNotificationCount(userId)` | Количество непрочитанных уведомлений |
| `getCardsWithUpcomingDeadlines(from, to)` | Карточки с дедлайном в заданном диапазоне (для планировщика) |

### Класс `DatabaseStorage`

Реализует `IStorage`. Использует Drizzle ORM для всех запросов к PostgreSQL. Экспортируется как единственный экземпляр `storage`.

---

## API-маршруты (`server/routes.ts`)

Все маршруты требуют авторизации (`requireAuth`), кроме `/api/auth/*`.

### Аутентификация
| Метод | Маршрут | Описание |
|---|---|---|
| POST | `/api/auth/register` | Регистрация нового пользователя |
| POST | `/api/auth/login` | Вход (Passport local strategy) |
| POST | `/api/auth/logout` | Выход из системы |
| GET | `/api/auth/me` | Получить текущего пользователя |

### Доски
| Метод | Маршрут | Описание |
|---|---|---|
| GET | `/api/boards` | Список всех доступных досок |
| POST | `/api/boards` | Создать доску |
| GET | `/api/boards/:id` | Получить доску по ID |
| DELETE | `/api/boards/:id` | Удалить доску (только владелец) |

### Участники доски
| Метод | Маршрут | Описание |
|---|---|---|
| GET | `/api/boards/:id/members` | Список участников |
| POST | `/api/boards/:id/members` | Пригласить по логину |
| DELETE | `/api/boards/:id/members/:memberId` | Удалить участника (только владелец) |

### Списки
| Метод | Маршрут | Описание |
|---|---|---|
| GET | `/api/boards/:id/lists` | Все списки доски с карточками |
| POST | `/api/lists` | Создать список |
| DELETE | `/api/lists/:id` | Удалить список |

### Карточки
| Метод | Маршрут | Описание |
|---|---|---|
| POST | `/api/cards` | Создать карточку |
| PATCH | `/api/cards/:id` | Обновить карточку |
| PATCH | `/api/cards/:id/move` | Переместить в другой список |
| DELETE | `/api/cards/:id` | Удалить карточку |

### Чеклисты
| Метод | Маршрут | Описание |
|---|---|---|
| GET | `/api/cards/:id/checklist` | Пункты чеклиста карточки |
| POST | `/api/checklist` | Добавить пункт |
| PATCH | `/api/checklist/:id` | Обновить пункт |
| DELETE | `/api/checklist/:id` | Удалить пункт |

### Уведомления
| Метод | Маршрут | Описание |
|---|---|---|
| GET | `/api/notifications` | Все уведомления текущего пользователя |
| GET | `/api/notifications/unread-count` | Количество непрочитанных (`{ count: number }`) |
| PATCH | `/api/notifications/:id/read` | Отметить одно уведомление прочитанным |
| POST | `/api/notifications/read-all` | Прочитать все уведомления |

---

## Авторизация и безопасность

- Пароли хэшируются через `bcrypt` (salt rounds: 10)
- Сессии хранятся в PostgreSQL через `connect-pg-simple`
- Middleware `requireAuth` проверяет наличие активной сессии перед каждым API-запросом
- Перед каждой операцией с данными доски проверяется членство через `isBoardMember`
- Удалять участников и доску может только владелец (`board.ownerId === req.user.id`)
- Пароль никогда не отправляется клиенту — поле вырезается перед формированием ответа
- Роль пользователя проверяется на сервере по белому списку: `["преподаватель", "начальник кафедры"]`
- Исполнитель карточки должен быть участником доски — проверяется при создании и обновлении карточки
- Прочитать чужое уведомление нельзя — сервер проверяет, что `notification.userId === req.user.id`

---

## Страницы (`client/src/pages/`)

| Файл | Маршрут | Описание |
|---|---|---|
| `auth-page.tsx` | `/auth` | Форма входа и регистрации |
| `boards-page.tsx` | `/` | Список всех досок пользователя |
| `board-page.tsx` | `/board/:id` | Доска с колонками и карточками |
| `not-found.tsx` | `*` | Страница 404 |

Доступ к `/` и `/board/:id` защищён: неавторизованный пользователь перенаправляется на `/auth`.

---

## Компоненты (`client/src/components/`)

| Файл | Описание |
|---|---|
| `board-list.tsx` | Колонка (список) с карточками; drag-and-drop через `@hello-pangea/dnd`; форма добавления карточки с выбором исполнителя и дедлайна |
| `card-detail.tsx` | Диалог с деталями карточки: заголовок, описание, цветные метки, чеклист с прогресс-баром, выбор исполнителя, дедлайн, кнопка завершения (запускает конфетти) |
| `invite-dialog.tsx` | Диалог приглашения пользователя на доску по логину; список текущих участников с возможностью удаления |
| `notifications-bell.tsx` | Колокольчик уведомлений в шапке: счётчик непрочитанных (опрос каждые 15 с), popover со списком, иконка для каждого типа, кнопки «Прочитать все» и отметка по одному |
| `ui/*` | Базовые компоненты shadcn/ui (Button, Dialog, Input, Label, Progress, Checkbox, Skeleton и др.) |

---

## Библиотека и утилиты (`client/src/lib/`)

| Файл | Описание |
|---|---|
| `auth.tsx` | `AuthProvider` — React Context с текущим пользователем, функциями `login`, `logout`, `register`; при входе и выходе полностью сбрасывается кэш React Query (`queryClient.clear()`) |
| `queryClient.ts` | Экземпляр `QueryClient` TanStack Query; функция `apiRequest` для типизированных HTTP-запросов |
| `utils.ts` | Утилита `cn()` — объединение классов Tailwind через `clsx` + `tailwind-merge` |

---

## Хуки (`client/src/hooks/`)

| Файл | Описание |
|---|---|
| `use-toast.ts` | Управление всплывающими уведомлениями (toast) |
| `use-mobile.tsx` | Определение мобильного устройства по ширине экрана |

---

## Типы данных (TypeScript)

Определены в `shared/schema.ts` и используются как на сервере, так и на клиенте:

| Тип | Описание |
|---|---|
| `User` | Полная запись пользователя из БД |
| `InsertUser` | Данные для создания пользователя |
| `Board` | Полная запись доски |
| `InsertBoard` | Данные для создания доски |
| `BoardMember` | Запись участника доски |
| `List` | Запись списка (колонки) |
| `InsertList` | Данные для создания списка |
| `Card` | Полная запись карточки |
| `InsertCard` | Данные для создания карточки |
| `ChecklistItem` | Пункт чеклиста |
| `InsertChecklistItem` | Данные для создания пункта |
| `Notification` | Полная запись уведомления |
| `InsertNotification` | Данные для создания уведомления |

---

## Zod-схемы валидации

| Схема | Использование |
|---|---|
| `loginSchema` | Валидация формы входа |
| `registerSchema` | Валидация формы регистрации (включает поле `role`) |
| `insertBoardSchema` | Создание доски |
| `insertListSchema` | Создание списка |
| `insertCardSchema` | Создание карточки (включает `assigneeId`, `deadline`) |
| `insertChecklistItemSchema` | Создание пункта чеклиста |
| `insertNotificationSchema` | Создание уведомления (используется только на сервере) |

---

## UI-компоненты (shadcn/ui)

Все компоненты находятся в `client/src/components/ui/` и построены на Radix UI primitives:

`Button`, `Input`, `Label`, `Dialog`, `Checkbox`, `Progress`, `Skeleton`, `Badge`, `Textarea`, `Tooltip`, `Popover`, `Select`, `Tabs`, `Toast`, `Toaster`, `Form`, `ScrollArea`, `Separator` и другие.

---

## Роли пользователей

При регистрации пользователь выбирает роль, которая отображается в виде бейджа в шапке приложения:

| Роль | Отображение |
|---|---|
| `преподаватель` | Бейдж «Преподаватель» |
| `начальник кафедры` | Бейдж «Нач. кафедры» |

Роль хранится в поле `users.role` и проверяется на сервере при регистрации. Она носит информационный характер и видна только самому пользователю.

---

## Система уведомлений

### Когда создаются уведомления

| Событие | Получатель | Тип |
|---|---|---|
| Назначение исполнителя при создании карточки | Исполнитель | `task_assigned` |
| Изменение исполнителя карточки | Новый исполнитель | `task_assigned` |
| Приглашение на доску | Приглашённый | `board_invite` |
| Приглашение на доску | Владелец доски | `board_joined` |
| Отметка карточки как выполненной | Исполнитель карточки | `task_completed` |
| Дедлайн менее чем через 24 часа | Исполнитель карточки | `deadline_warning` |

### Фоновый планировщик дедлайнов

В `server/routes.ts` при старте сервера запускается таймер (`setInterval`):
- Первый запуск — через 10 секунд после старта
- Повторный опрос — каждые 30 минут
- Находит все незавершённые карточки с дедлайном в следующие 24 часа
- Для каждой карточки с исполнителем создаёт `deadline_warning`, если за последние 12 часов такое уведомление ещё не отправлялось

### Опрос на клиенте

Компонент `NotificationsBell` раз в 15 секунд запрашивает `/api/notifications/unread-count`. При открытии popover загружается полный список уведомлений.

---

## Анимации и визуальный стиль

- **Fade-in** и **slide-up** — CSS keyframe анимации при появлении элементов (определены в `index.css`)
- **Shake** — анимация при ошибке ввода
- **Конфетти** — `canvas-confetti` запускается при отметке карточки как выполненной
- **Drag-and-drop** — `@hello-pangea/dnd` для перетаскивания карточек между списками и изменения порядка списков
- **Цветовая палитра досок** — пастельные оттенки: `#a8d8ea`, `#aa96da`, `#fcbad3`, `#a8e6cf`, `#ffd3b6`, `#d4f1f9`
- **Тема** — светлая, с CSS-переменными в `:root`; поддержка тёмной темы через класс `.dark`

---

## Переменные окружения

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | Строка подключения к PostgreSQL (обязательна) |
| `SESSION_SECRET` | Секрет для подписи сессий |

---

## Запуск и разработка

```bash
# Установить зависимости
npm install

# Применить схему БД
npm run db:push

# Запустить dev-сервер (Express + Vite на одном порту 5000)
npm run dev
```

В режиме разработки Express проксирует запросы к Vite-серверу. В production-режиме Vite собирает клиент в `dist/public`, который раздаётся Express статически.
