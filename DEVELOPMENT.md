# Japan Ceramic — План разработки MVP

## Стек
- **Framework:** Next.js 16 (App Router, TypeScript)
- **Стили:** Tailwind CSS + CSS-переменные из лендинга
- **БД:** PostgreSQL (порт 5433) + Prisma 7 ORM
- **Auth:** JWT + httponly cookies (bcryptjs + jsonwebtoken)
- **Хранение файлов:** public/uploads/ (S3/R2 позже)
- **Лендинг:** оригинальный HTML-файл, дизайн не изменён, навигация обновлена

## Структура страниц
- `/` — лендинг (оригинальный HTML, парсится в Next.js: style + body + script)
- `/catalog` — каталог-галерея (~150 позиций, фильтры по категориям)
- `/catalog/[slug]` — карточка товара (полноэкран текстура, спеки, избранное, добавить в проект)
- `/auth/login` — вход
- `/auth/register` — регистрация дизайнера
- `/cabinet` — личный кабинет (проекты, статистика)
- `/cabinet/favorites` — избранное
- `/cabinet/projects/[id]` — проект/мудборд с товарами
- `/admin` — дашборд админки (статистика)
- `/admin/products` — управление товарами (таблица)
- `/admin/products/new` — создание товара
- `/admin/products/[id]` — редактирование товара
- `/admin/categories` — управление категориями
- `/admin/users` — управление пользователями

## Навигация (лендинг)
- Навбар: Коллекции (#), Атмосферы (#), AI-визуализация (#), О бренде (#), **Каталог (/catalog)**, Контакты (#)
- Кнопка **«Каталог»** в header → /catalog
- Кнопка **«Войти»** / **имя юзера** в header → /auth/login или /cabinet
- Hero CTA **«Смотреть коллекции»** → /catalog
- Мобильный drawer — те же ссылки

## Модели данных (Prisma)
- **User** — email, пароль, роль (admin/designer), компания, телефон
- **Category** — название, slug, порядок сортировки
- **Product** — название, slug, категория, описание, цена, размеры, поверхность, коллекция, цвет
- **ProductImage** — привязка к товару, URL, primary-флаг
- **DesignerProject** — мудборды (draft/in_progress/completed)
- **ProjectItem** — товары в проекте с количеством
- **Favorite** — избранное (уникальная пара user+product)

## API Routes
### Auth
- `POST /api/auth/register` — регистрация
- `POST /api/auth/login` — вход
- `GET /api/auth/logout` — выход (redirect на /)

### Кабинет дизайнера
- `POST /api/cabinet/favorites` — toggle избранное
- `GET/POST /api/cabinet/projects` — список/создание проектов
- `POST /api/cabinet/projects/[id]/items` — добавить товар в проект
- `DELETE /api/cabinet/projects/[id]/items/[itemId]` — удалить товар

### Админка
- `GET/POST /api/admin/products` — список/создание товаров
- `GET/PUT/DELETE /api/admin/products/[id]` — CRUD товара
- `GET/POST /api/admin/categories` — список/создание категорий
- `PUT/DELETE /api/admin/categories/[id]` — CRUD категории
- `GET /api/admin/users` — список пользователей
- `PUT /api/admin/users/[id]` — блокировка/смена роли
- `POST /api/admin/upload` — загрузка изображений

## Что сделано (Phases 1-5)

### Phase 1: Skeleton + DB ✅
- [x] Next.js 16 проект (TypeScript, Tailwind, App Router)
- [x] Prisma 7 schema (7 моделей, PrismaPg adapter)
- [x] Docker-compose для PostgreSQL (порт 5433)
- [x] Seed-скрипт (5 категорий, 15 товаров, admin-юзер)
- [x] Миграции работают

### Phase 2: Auth ✅
- [x] API: регистрация, логин, логаут
- [x] JWT + httponly cookies (7 дней)
- [x] getSession() для серверных компонентов
- [x] requireAdmin() guard для админки
- [x] Страницы: /auth/login, /auth/register (тёмная тема, дизайн-токены лендинга)

### Phase 3: Каталог ✅
- [x] Галерея товаров (grid 3 колонки, публичная)
- [x] Фильтрация по категориям (табы: Все/Камень/Бетон/Мрамор/Металл/Дерево)
- [x] Карточка товара (полноэкран текстура, спеки снизу)
- [x] Навигация между товарами (prev/next стрелки)
- [x] Lazy-load изображений
- [x] Кнопки: избранное ★, «+ В проект» (dropdown с проектами)
- [x] Дизайн-токены из лендинга (CSS-переменные, шрифты)

### Phase 4: Кабинет дизайнера ✅
- [x] Дашборд: проекты + статистика (кол-во проектов, избранное)
- [x] Создание проектов (модалка с названием и описанием)
- [x] Страница проекта: таблица товаров, удаление, ссылки на каталог
- [x] Избранное: галерея + toggle кнопка
- [x] Добавление товаров в проект из карточки товара
- [x] Удаление товаров из проекта

### Phase 5: Админка ✅
- [x] Дашборд: статистика (товары, категории, дизайнеры, проекты)
- [x] Товары: таблица, создание, редактирование, удаление
- [x] Форма товара: все поля + загрузка изображений + вставка URL
- [x] Категории: inline CRUD (с защитой от удаления если есть товары)
- [x] Пользователи: список, блокировка/разблокировка, смена роли
- [x] Загрузка изображений (JPG/PNG/WebP, до 10MB)
- [x] Защита всех admin-роутов
- [x] Ссылка «Админка» в Header для admin-юзеров

### Phase 5.5: Интеграция лендинга ✅
- [x] Лендинг правильно парсится (style + body + script, без дублирования html/body)
- [x] Hero-видео работает (скопировано в public/hero-video.mp4)
- [x] Навигация: «Шоурум» заменён на «Каталог» (/catalog)
- [x] Кнопка «Каталог» в header → /catalog
- [x] Кнопка «Войти» / имя юзера → /auth/login или /cabinet
- [x] Hero CTA «Смотреть коллекции» → /catalog

## Что осталось для полного MVP

### Phase 6: AI-визуализация (отложено)
- [ ] Выбор AI API (Replicate/Stability AI)
- [ ] POST /api/visualize — генерация
- [ ] Дневной лимит генераций на юзера
- [ ] UI визуализатора в кабинете
- [ ] Кнопка «Визуализировать» на карточке товара → реальная генерация

### Phase 7: Полировка и продакшен
- [ ] SEO: meta-теги на каждой странице, Open Graph
- [ ] Мобильная адаптация каталога и кабинета (проверить)
- [ ] 404 страница
- [ ] Поиск по каталогу
- [ ] Пагинация (если >50 товаров на странице)
- [ ] Сжатие загруженных изображений
- [ ] Кэширование (ISR для каталога)
- [ ] Продакшен деплой (Vercel / VPS)
- [ ] HTTPS + домен
- [ ] .env.production с реальными секретами

## Запуск проекта

```bash
cd web

# 1. Запустить PostgreSQL (порт 5433)
docker compose up -d

# 2. Сгенерировать Prisma-клиент и мигрировать
npm run db:generate
npm run db:migrate

# 3. Заполнить демо-данными
npm run db:seed

# 4. Запустить dev-сервер (порт 3001)
npm run dev
```

**Dev URL:** http://localhost:3001
**Логин админа:** `admin@japanceramic.com` / `admin123`
**Тестовый дизайнер:** `test@designer.com` / `test123`

## Важные файлы

| Файл | Описание |
|------|----------|
| `japan-ceramic.html` | Оригинальный лендинг (корень проекта) |
| `web/prisma/schema.prisma` | Схема БД |
| `web/prisma/seed.ts` | Seed-данные |
| `web/src/app/page.tsx` | Лендинг (парсинг HTML) |
| `web/src/app/(site)/` | Все страницы сайта (каталог, кабинет, админка) |
| `web/src/app/api/` | API routes |
| `web/src/lib/auth.ts` | JWT auth (createToken, getSession) |
| `web/src/lib/db.ts` | Prisma client |
| `web/src/components/` | React-компоненты (Header, FavoriteButton, ProductForm...) |

## Лог разработки

### 2026-05-22
- Создан план разработки, party mode обсуждение стека
- Перешли с Python/FastAPI на Next.js (TypeScript) по просьбе Эмира
- Phase 1-5: полная реализация (auth, каталог, кабинет, админка)
- Fix: лендинг интеграция (парсинг HTML, видео, навигация)
- Fix: порты (PostgreSQL 5433, Next.js 3001) — не конфликтуют с другими проектами
- Билд проходит чисто, 0 ошибок TypeScript
- Все эндпоинты проверены curl'ом: 200 OK
