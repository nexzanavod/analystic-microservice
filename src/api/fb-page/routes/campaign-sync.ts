module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/fb-pages/campaign-sync',
      handler: 'fetch-campaign.fetchCampaignSync',
    },
  ],
};