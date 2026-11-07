# Topovik Frontend

Next.js 16 + TypeScript + Tailwind 4 + Bun.

## Запуск

Нужен поднятый Strapi (`bun run dev:cms` из корня).

```bash
cd frontend
bun install
bun run dev
```

Сайт: http://localhost:3000  
API: `NEXT_PUBLIC_STRAPI_URL` / `STRAPI_URL` (по умолчанию `http://127.0.0.1:1337`)

## SEO-маршруты

| Тип | Путь |
|-----|------|
| Статья | `/{category}/{slug}` |
| Рубрика | `/category/{slug}` |
| Тег | `/tag/{slug}` |
| Пагинация | `/page/2` |
| Поиск | `/search?q=` |
| Страницы CMS | `/about`, `/contacts`, `/ads` |

`src/proxy.ts` снимает хвостовой `/` и артефакт `%20`. Медиа `/uploads/*` проксируется на Strapi.
