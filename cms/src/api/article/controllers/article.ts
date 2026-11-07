import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::article.article', ({ strapi }) => ({
  async incrementViews(ctx) {
    const { id } = ctx.params;
    const article = await strapi.db.query('api::article.article').findOne({
      where: { id },
      select: ['id', 'views'],
    });

    if (!article) {
      return ctx.notFound('Article not found');
    }

    const updated = await strapi.db.query('api::article.article').update({
      where: { id },
      data: { views: (article.views || 0) + 1 },
    });

    ctx.body = { data: { id: updated.id, views: updated.views } };
  },

  async vote(ctx) {
    const { id } = ctx.params;
    const type = ctx.request.body?.type;

    if (type !== 'like' && type !== 'dislike') {
      return ctx.badRequest('type must be "like" or "dislike"');
    }

    const article = await strapi.db.query('api::article.article').findOne({
      where: { id },
      select: ['id', 'likes', 'dislikes'],
    });

    if (!article) {
      return ctx.notFound('Article not found');
    }

    const data =
      type === 'like'
        ? { likes: (article.likes || 0) + 1 }
        : { dislikes: (article.dislikes || 0) + 1 };

    const updated = await strapi.db.query('api::article.article').update({
      where: { id },
      data,
    });

    ctx.body = {
      data: {
        id: updated.id,
        likes: updated.likes,
        dislikes: updated.dislikes,
      },
    };
  },
}));
