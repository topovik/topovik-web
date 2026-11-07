export default {
  routes: [
    {
      method: 'POST',
      path: '/articles/:id/views',
      handler: 'article.incrementViews',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/articles/:id/vote',
      handler: 'article.vote',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
