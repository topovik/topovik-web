# Topovik

Миграция [topovik.com](https://topovik.com) с WordPress на **Strapi 5 + PostgreSQL** (CMS) и далее **Next.js** (этап 2).

Исходный WordPress лежит в [`old/`](old/) и не изменяется.

## Структура

| Путь | Назначение |
|------|------------|
| `cms/` | Strapi 5 CMS (PostgreSQL) |
| `scripts/migrate/` | Импорт из MySQL-дампа + медиа + SEO redirects |
| `old/` | Архив WordPress + `topovik.sql` + uploads |
| `frontend/` | Заготовка под Next.js (этап 2) |

## SEO URL (важно)

Канонические пути **как на старом сайте**:

- статья: `/{categorySlug}/{postSlug}`  
  пример: `/cinema/luchshie-ehkranizacii-romanov-stivena-kinga`
- рубрика: `/category/{slug}`
- тег: `/tag/{slug}`
- страницы: `/about`, `/contacts`, `/ads`, …

Артефакт permalink `.../%20` и хвостовой `/` закрываются 301 → канон.  
Карта: [`scripts/migrate/out/redirects.json`](scripts/migrate/out/redirects.json) (также CSV).

Поле `article.legacyPath` хранит канонический путь. Скрипт миграции **не переписывает** валидные латинские `post_name` из WordPress.

Проверка паритета (737/737 OK) пишется в `scripts/migrate/out/seo-parity.json`.

## Пакетный менеджер

Везде **Bun** (`bun@1.2.15+`). Из корня: `bun run dev:cms`, `bun run migrate`, …

## Быстрый старт CMS

```bash
# 1) Postgres для Strapi (порт 5434, чтобы не конфликтовать с локальным 5432)
bun run db:up
# или: docker compose up -d postgres

# 2) Strapi
cd cms
cp -n .env.example .env   # если ещё нет
bun install
bun run develop
```

Админка: http://localhost:1337/admin  

По умолчанию (bootstrap при первом старте):

- email: `admin@topovik.com`
- password: `TopovikAdmin1!`

## Миграция контента из WordPress

Нужен запущенный Strapi и full-access API token в `scripts/migrate/.api-token`.

```bash
# MySQL 8.4 только для чтения отфильтрованного дампа (профиль migrate, порт 3307)
bun run migrate:filter
bun run db:migrate-source
# дождаться healthy и импорта filtered.sql

cd scripts/migrate
bun install
# положите API token в .api-token (Admin → Settings → API Tokens → full access)
bun run extract-authors
bun run migrate
MEDIA_COPY_MODE=link bun run media   # symlink uploads → cms/public/uploads/wp-content/uploads
bun run redirects
```

Или из корня после MySQL+токена: `bun run migrate:all`.

### Что переносится

- 737 published + drafts статей, 13+ рубрик, теги, SEO (AIOSEO → component `seo`)
- комментарии (approved), просмотры / лайки / дизлайки
- страницы (без `/signin`, `/registration`, `/zabyli-parol` → редирект на `/`)
- **не** переносятся ~358k спам-пользователей; авторы комментариев — гостевые поля

### Медиа

`MEDIA_COPY_MODE=link` делает symlink `old/wp-content/uploads` → `cms/public/uploads/wp-content/uploads`.  
В HTML контента пути переписываются на `/uploads/wp-content/uploads/...`.  
Обложки дополнительно загружаются в Media Library Strapi.

## Публичное API (для будущего Next.js)

| Метод | Путь | Назначение |
|-------|------|------------|
| GET | `/api/articles` | список / фильтры |
| GET | `/api/articles/:documentId` | статья |
| POST | `/api/articles/:id/views` | +1 просмотр |
| POST | `/api/articles/:id/vote` | `{ "type": "like" \| "dislike" }` |
| POST | `/api/comments` | новый комментарий (по умолчанию `approved: false`) |
| POST | `/api/subscribers` | подписка |
| POST | `/api/contact-messages` | форма контактов |

Регистрация читателей — стандартный Users & Permissions Strapi (без импорта WP-спама).

## Фронтенд (этап 2)

```bash
bun run db:up
bun run dev:cms    # :1337
bun run dev:web    # :3000
```

Маршруты SEO: `/{category}/{slug}`, `/category/{slug}`, `/tag/{slug}`. Подробнее — [`frontend/README.md`](frontend/README.md).
