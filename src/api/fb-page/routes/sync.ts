module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/fb-pages/fetch-analytics',
      handler: 'fetch-analytics.fetchAnalytics',
    },
  ],
};