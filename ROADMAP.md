# RoadMap — Vocabulary Trainer 

## 0. Текущее состояние (as-is)
Репозиторий сейчас — **FastAPI + SQLite + SQLModel + Vanilla JS (SPA)** и cookie-session авторизация:

- Backend:
  - `POST /api/auth/register|login|logout`, `GET /api/auth/me` (cookie session)
  - `GET/POST/PATCH/DELETE /api/words`
  - `GET /api/review/today`, `POST /api/review/{id}`
  - `GET /api/stats`
- Frontend:
  - `static/index.html` + модальный логин/регистрация
  - базовые страницы Words/Review/Stats
  - визуальный стиль уже «игривый», есть drag&drop карточек
- Технический долг:
  - проект сейчас **не соответствует финальному стеку** (React/Tailwind/JWT/OAuth)
  - CSV import/export UI есть, но API-эндпоинтов нет
  - есть частично «MVP-подобные» функции, но потребуется **миграция архитектуры**

## 1. Целевое состояние (to-be, по ТЗ)
### Стек
- Backend: FastAPI, SQLAlchemy 2.0, SQLite, JWT (access 1h + refresh), Google OAuth, CORS для Vite dev
- Frontend: React 19 + Vite, Tailwind (dark mode), react-router-dom v6, framer-motion, lucide-react, chart.js, react-hot-toast, canvas-confetti
- Ограничения: bundle **< 300 кБ** после `vite build`, полностью responsive

### Основные модули продукта
- Auth: регистрация, мок-подтверждение email, вход/выход, forgot password (мок), Google OAuth, JWT
- Dashboard: «Due today: X», countdown до ближайшего `next_review`, Learning Path (узлы тем/тегов)
- Words: CRUD, поиск/фильтр/сортировка, starred, skeleton+retry, drag&drop плиток
- Review: today queue, flip-анимация, good/bad с bounce/shake/confetti
- Training: level 1 (multiple choice), уровни 2–4 (моки Coming soon)
- Settings: настройка интервалов stage 0–4, множитель частоты, streak/learned
- Stats: карточки метрик + график, streak counter

## 2. Стратегия перехода (важно)
Чтобы «с текущего состояния» прийти к финалу без бесконечного рефакторинга:

1) **Зафиксировать бэкенд как отдельный сервис** (`app/`), а фронтенд вынести в `frontend/` (Vite).
2) На время миграции оставить текущий `static/` как “legacy UI”, но новые фичи делать в React.
3) После готовности React — собирать в `static/` (vite build) и отдавать через FastAPI (или отдельным хостингом).
4) Параллельно заменить cookie-session на JWT (как требует ТЗ) и обновить фронт API-клиент.

## 3. План на MVP (05–12 Feb 2026)
MVP = красивый «портфолио-скриншотный» продукт + рабочая основа SRS/review.

### День 1 (05 Feb): каркас проекта + инфраструктура
- [ ] Создать `frontend/` (Vite + React), подключить Tailwind (dark mode).
- [ ] Настроить роутинг: `/login`, `/dashboard`, `/words`, `/review`, `/training`, `/stats`, `/settings`.
- [ ] Настроить `vite.config` proxy на FastAPI (`/api/*`).
- [ ] Принять дизайн-токены (цвета/радиусы/тени) и базовые компоненты UI (Button/Card/Input/Toast).
- [ ] Добавить измерение bundle size (скрипт/инструкция).

### День 2 (06 Feb): JWT auth + AuthContext
- [ ] Backend: заменить cookie-session на JWT:
  - `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`
  - access (1h), refresh (в `localStorage`, как в ТЗ)
- [ ] Frontend: `AuthContext` + защищённые роуты, редирект на `/dashboard` после логина.
- [ ] UI: экраны login/signup + мок «email sent» с кнопкой «Confirm» (для демо).

### День 3 (07 Feb): Words (CRUD + list UX)
- [ ] Backend: привести модели/DAO к SQLAlchemy 2.0 (или аккуратно совместить на MVP, но зафиксировать цель).
- [ ] Words page:
  - [ ] список + добавление/редактирование/удаление
  - [ ] поиск/фильтр по term/translation/tag
  - [ ] сортировка (stage, next_review, created_at)
  - [ ] skeleton loading + retry
- [ ] Starred (минимальная версия: поле + кнопка «сердечко» + фильтр).

### День 4 (08 Feb): Review Today (анимации + SRS)
- [ ] `GET /api/review/today?limit=50` (по ТЗ) + учёт просрочки.
- [ ] ReviewCard (flip rotateY), кнопки Good/Bad.
- [ ] Анимации:
  - [ ] good: bounce + confetti при streak ≥ 5
  - [ ] bad: shake
- [ ] Автопереход к следующей карточке.

### День 5 (09 Feb): Dashboard (таймер + “due today”)
- [ ] Блок «Today to review: X» (scale on load, peach gradient).
- [ ] Countdown до ближайшего next_review:
  - [ ] desktop: sticky bottom bar
  - [ ] mobile: крупный таймер внизу, пульсация при < 5 минут
- [ ] Базовый navbar и UX-полировка.

### День 6 (10 Feb): Stats (cards + chart)
- [ ] `GET /api/stats` расширить под ТЗ:
  - due today, due 7d, new words 7d/30d, reviews 7d/30d, streak
- [ ] UI карточек + chart.js (новые слова vs повторения).

### День 7 (11–12 Feb): финальная полировка MVP
- [ ] “Learning Path” (MVP-версия):
  - [ ] темы = теги, узлы вертикальные, прогресс = % stage ≥ 2
  - [ ] переход по клику в Training (можно «Coming soon» в MVP)
- [ ] micro-animations: hover/press ripple/scale, toasts (react-hot-toast).
- [ ] responsive-проверка (минимум: iPhone SE + desktop).
- [ ] финальная проверка bundle size < 300 kB и оптимизация (tree-shaking, lazy routes, лёгкие импорты chart.js).

## 4. После MVP (Phase 2+)

### Phase 2: Training Mode (полноценный Level 1)
- [ ] `GET /api/training/questions?theme=&level=1&batch=16`
- [ ] Генератор distractors (из темы / общий пул), защита от повторов.
- [ ] UI multiple choice (8–16 заданий), прогресс-бар, финальный экран “Nice!”.
- [ ] Levels 2–4 оставить моками, но с красивыми иллюстрациями.

### Phase 3: Settings / SRS гибкость
- [ ] Таблица/модель Settings:
  - интервалы stage 0–4 (по умолчанию 1/3/7/14/30)
  - множитель частоты 1.0–2.0
- [ ] `PATCH /api/settings`, `GET /api/settings`
- [ ] UI sliders/inputs + сохранение + toast.

### Phase 4: Полная статистика + streak
- [ ] Счётчик streak (дней подряд с review activity).
- [ ] Расширить stats API и графики (7/30/365 дней).
- [ ] “total words learned” = words with stage=4 (или stage>=4).

### Phase 5: Импорт/экспорт CSV (end-to-end)
- [ ] `POST /api/words/import` (multipart CSV) + отчёт imported/skipped
- [ ] `GET /api/words/export` (CSV download)
- [ ] UX: короткая подпись у input файла, аккуратная вёрстка, toasts.

### Phase 6: Forgot password + Email verification (демо)
- [ ] Forgot password: форма → мок “Link sent”.
- [ ] Email verification: мок-экран + ручная кнопка “Confirm”.
- [ ] (Опционально) реальная отправка писем позже, если нужно для портфолио.

### Phase 7: Google OAuth (реальная интеграция)
- [ ] Google OAuth flow (backend endpoints + фронт кнопка).
- [ ] Связка аккаунта по email, создание пользователя при первом входе.

### Phase 8: Рейтинг пользователей (mock/simple)
- [ ] `GET /api/leaderboard?limit=10` (top-10 по words stage=4).
- [ ] UI: карточка “Leaderboard” + анимации.

### Phase 9: Финальный UI/UX Duolingo-style
- [ ] Mascot/иллюстрации, карточки 16–24px, кнопки 12–16px, peach palette + dark theme.
- [ ] Learning Path: анимированные unlock, sparkle/confetti, “уровни”.
- [ ] Микроанимации: scale/ripple, bounce/shake, transition модалок.
- [ ] Loading: skeleton + retry button.

## 5. Чек-лист готовности (Definition of Done)
- [ ] Все ключевые страницы работают: Dashboard/Words/Review/Training/Stats/Settings/Auth
- [ ] JWT auth: access+refresh работают, редиректы корректны
- [ ] Review: good/bad меняет stage/next_review, очереди корректны
- [ ] Responsive: кликабельные зоны ≥ 44×44, мобильный таймер читаемый
- [ ] Bundle < 300 kB после build (зафиксировано в README/скрипте)
- [ ] UI: единый стиль, тёмная тема, аккуратные toasts, skeleton loading