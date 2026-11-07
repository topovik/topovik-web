import { factories } from '@strapi/strapi';

async function resolveArticle(strapi: any, ref: string | number) {
  const asNumber = Number(ref);
  if (Number.isInteger(asNumber) && String(asNumber) === String(ref)) {
    return strapi.db.query('api::article.article').findOne({
      where: { id: asNumber },
      select: ['id', 'documentId'],
    });
  }

  return strapi.db.query('api::article.article').findOne({
    where: { documentId: String(ref) },
    select: ['id', 'documentId'],
  });
}

export default factories.createCoreController('api::comment.comment', ({ strapi }) => ({
  async create(ctx) {
    const body = ctx.request.body?.data ?? ctx.request.body ?? {};
    const { content, authorName, authorEmail, article, parent, approved, legacyWpId } = body;

    if (!content || !authorName || !article) {
      return ctx.badRequest('content, authorName and article are required');
    }

    const articleRow = await resolveArticle(strapi, article);
    if (!articleRow) {
      return ctx.notFound('Article not found');
    }

    let parentDocumentId: string | null = null;
    if (parent) {
      const parentRow = await strapi.db.query('api::comment.comment').findOne({
        where:
          Number.isInteger(Number(parent)) && String(Number(parent)) === String(parent)
            ? { id: Number(parent) }
            : { documentId: String(parent) },
        select: ['documentId'],
      });
      parentDocumentId = parentRow?.documentId || null;
    }

    const user = ctx.state?.user;

    // Public submissions stay unapproved unless explicitly set by privileged caller
    const approvedFlag = typeof approved === 'boolean' ? approved : false;

    const entry = await strapi.documents('api::comment.comment').create({
      data: {
        content,
        authorName: user?.username || authorName,
        authorEmail: user?.email || authorEmail || null,
        article: articleRow.documentId,
        parent: parentDocumentId,
        user: user?.id || null,
        approved: approvedFlag,
        ...(legacyWpId != null ? { legacyWpId } : {}),
      },
    });

    ctx.body = {
      data: {
        id: entry.id,
        documentId: entry.documentId,
        content: entry.content,
        authorName: entry.authorName,
        approved: entry.approved,
      },
    };
  },
}));
