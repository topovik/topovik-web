import fs from 'node:fs';
import path from 'node:path';
import type { Core } from '@strapi/strapi';
import {
  buildRevalidatePayload,
  notifyFrontendRevalidate,
  shouldRevalidate,
} from './utils/revalidate-frontend';
import { estimateReadingMinutes } from './utils/reading-time';
import { ensureFilePlaceholder } from './utils/media-placeholder';

const PUBLIC_FIND = [
  'api::article.article',
  'api::category.category',
  'api::tag.tag',
  'api::page.page',
  'api::comment.comment',
];

const PUBLIC_CREATE = [
  'api::comment.comment',
  'api::subscriber.subscriber',
  'api::contact-message.contact-message',
];

const PUBLIC_CUSTOM = [
  'api::article.article.incrementViews',
  'api::article.article.vote',
];

async function ensureAdminUser(strapi: Core.Strapi) {
  const email = process.env.ADMIN_EMAIL || 'admin@topovik.com';
  const password = process.env.ADMIN_PASSWORD || 'TopovikAdmin1!';
  const firstname = process.env.ADMIN_FIRSTNAME || 'Admin';
  const lastname = process.env.ADMIN_LASTNAME || 'Topovik';

  const existing = await strapi.db.query('admin::user').findOne({
    where: { email },
  });

  if (existing) {
    return;
  }

  const superAdminRole = await strapi.db.query('admin::role').findOne({
    where: { code: 'strapi-super-admin' },
  });

  if (!superAdminRole) {
    strapi.log.warn('Super admin role missing; skip admin bootstrap');
    return;
  }

  await strapi.admin.services.user.create({
    email,
    password,
    firstname,
    lastname,
    registrationToken: null,
    isActive: true,
    roles: [superAdminRole.id],
  });

  strapi.log.info(`Created admin user ${email}`);
}

async function setPublicPermissions(strapi: Core.Strapi) {
  const role = await strapi.db.query('plugin::users-permissions.role').findOne({
    where: { type: 'public' },
  });

  if (!role) {
    return;
  }

  const existing = await strapi.db.query('plugin::users-permissions.permission').findMany({
    where: { role: role.id },
  });
  const existingActions = new Set(existing.map((p: { action: string }) => p.action));

  const desired = new Set<string>();

  for (const uid of PUBLIC_FIND) {
    desired.add(`${uid}.find`);
    desired.add(`${uid}.findOne`);
  }

  for (const uid of PUBLIC_CREATE) {
    desired.add(`${uid}.create`);
  }

  for (const action of PUBLIC_CUSTOM) {
    desired.add(action);
  }

  for (const action of desired) {
    if (existingActions.has(action)) {
      continue;
    }
    await strapi.db.query('plugin::users-permissions.permission').create({
      data: {
        action,
        role: role.id,
      },
    });
  }
}

function asEntry(result: unknown): Record<string, unknown> | null {
  if (!result) return null;
  if (Array.isArray(result)) {
    const first = result[0];
    return first && typeof first === 'object' ? (first as Record<string, unknown>) : null;
  }
  if (typeof result === 'object') return result as Record<string, unknown>;
  return null;
}

async function loadArticleForRevalidate(strapi: Core.Strapi, documentId?: string) {
  if (!documentId) return null;
  try {
    return await strapi.documents('api::article.article').findOne({
      documentId,
      status: 'published',
      populate: {
        category: { fields: ['slug'] },
        tags: { fields: ['slug'] },
        cover: true,
      },
    });
  } catch {
    return null;
  }
}

async function loadCommentForRevalidate(strapi: Core.Strapi, documentId?: string) {
  if (!documentId) return null;
  try {
    return await strapi.documents('api::comment.comment').findOne({
      documentId,
      populate: {
        article: {
          fields: ['slug', 'legacyPath', 'documentId'],
          populate: {
            category: { fields: ['slug'] },
          },
        },
      },
    });
  } catch {
    return null;
  }
}

function registerReadingMinutes(strapi: Core.Strapi) {
  strapi.documents.use(async (context, next) => {
    if (
      context.uid === 'api::article.article' &&
      (context.action === 'create' || context.action === 'update')
    ) {
      const data = (context.params as { data?: Record<string, unknown> } | undefined)?.data;
      if (data && data.content != null) {
        data.readingMinutes = estimateReadingMinutes(String(data.content));
      }
    }
    return next();
  });
}

function registerFrontendRevalidation(strapi: Core.Strapi) {
  strapi.documents.use(async (context, next) => {
    const result = await next();

    if (!shouldRevalidate(context.uid, context.action)) {
      return result;
    }

    // Fire-and-forget so CMS writes stay fast.
    void (async () => {
      try {
        let entry = asEntry(result);

        if (context.uid === 'api::article.article') {
          const documentId =
            (entry?.documentId as string | undefined) ||
            (context.params as { documentId?: string } | undefined)?.documentId;
          entry = ((await loadArticleForRevalidate(strapi, documentId)) as Record<
            string,
            unknown
          > | null) || entry;
        }

        if (context.uid === 'api::comment.comment') {
          const documentId =
            (entry?.documentId as string | undefined) ||
            (context.params as { documentId?: string } | undefined)?.documentId;
          entry = ((await loadCommentForRevalidate(strapi, documentId)) as Record<
            string,
            unknown
          > | null) || entry;
        }

        const payload = buildRevalidatePayload(context.uid, entry);
        await notifyFrontendRevalidate(strapi, payload);
      } catch (err) {
        strapi.log.error('Failed to schedule frontend revalidation', err);
      }
    })();

    return result;
  });
}

function registerMediaPlaceholders(strapi: Core.Strapi) {
  strapi.db.lifecycles.subscribe({
    models: ['plugin::upload.file'],
    async afterCreate(event) {
      const result = event.result as
        | { id?: number; url?: string; mime?: string; provider_metadata?: Record<string, unknown> }
        | undefined;
      try {
        await ensureFilePlaceholder(strapi, result);
      } catch (err) {
        strapi.log.warn(`placeholder afterCreate failed: ${String(err)}`);
      }
    },
    async afterUpdate(event) {
      const result = event.result as
        | { id?: number; url?: string; mime?: string; provider_metadata?: Record<string, unknown> }
        | undefined;
      if (result?.provider_metadata?.placeholder) return;
      try {
        await ensureFilePlaceholder(strapi, result);
      } catch (err) {
        strapi.log.warn(`placeholder afterUpdate failed: ${String(err)}`);
      }
    },
  });
}

function registerUploadHashFallback(strapi: Core.Strapi) {
  const uploadsDir = path.join(strapi.dirs.static.public, 'uploads');
  let index: Map<string, string> | null = null;
  let builtAt = 0;

  const getIndex = () => {
    const now = Date.now();
    if (index && now - builtAt < 60_000) return index;
    const map = new Map<string, string | null>();
    try {
      for (const name of fs.readdirSync(uploadsDir)) {
        const m = name.match(/_([a-f0-9]{10})(\.[^.]+)$/i);
        if (!m) continue;
        const key = `${m[1].toLowerCase()}${m[2].toLowerCase()}`;
        if (map.has(key)) map.set(key, null);
        else map.set(key, name);
      }
    } catch (err) {
      strapi.log.warn(`upload hash fallback index failed: ${String(err)}`);
    }
    index = new Map();
    for (const [k, v] of map) {
      if (v) index.set(k, v);
    }
    builtAt = now;
    return index;
  };

  strapi.server.use(async (ctx, next) => {
    await next();
    if (ctx.method !== 'GET' && ctx.method !== 'HEAD') return;
    if (ctx.status !== 404) return;
    if (!ctx.path.startsWith('/uploads/')) return;

    const base = path.basename(ctx.path.split('?')[0]);
    const m = base.match(/_([a-f0-9]{10})(\.[^.]+)$/i);
    if (!m) return;
    const key = `${m[1].toLowerCase()}${m[2].toLowerCase()}`;
    const target = getIndex().get(key);
    if (!target || target === base) return;

    ctx.status = 302;
    ctx.redirect(`/uploads/${target}`);
  });
}

export default {
  register({ strapi }: { strapi: Core.Strapi }) {
    registerReadingMinutes(strapi);
    registerFrontendRevalidation(strapi);
    registerMediaPlaceholders(strapi);
    registerUploadHashFallback(strapi);
  },

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await ensureAdminUser(strapi);
    await setPublicPermissions(strapi);

    // Media Library settings (admin store): keep originals uncompressed, medium via breakpoints.
    const uploadSettings = strapi.store({ type: 'plugin', name: 'upload', key: 'settings' });
    const current =
      ((await uploadSettings.get({})) as Record<string, unknown> | null) || {};
    await uploadSettings.set({
      value: {
        ...current,
        sizeOptimization: false,
        responsiveDimensions: true,
        autoOrientation: current.autoOrientation ?? false,
      },
    });
  },
};
