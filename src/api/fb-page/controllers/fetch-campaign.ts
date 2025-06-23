import { factories } from '@strapi/strapi'


export default factories.createCoreController('api::fb-page.fb-page', ({ strapi }) => ({
  async fetchCampaignSync(ctx) {
    const { facebook_page_id } = ctx.request.body;

    console.log('Fetching campaign sync for page:', facebook_page_id);


    // 1. Find Facebook Page
    const page = await strapi.db.query('api::fb-page.fb-page').findOne({
        where: { facebook_page_id },
      });

    if (!page) return ctx.badRequest('FB Page not found');

    const adminUser = await strapi.db.query('api::fb-admin-user.fb-admin-user').findOne({});

      if (!adminUser || !adminUser.access_token) {
        return ctx.notFound('Admin user or access token not found');
      }

    const adAccountId = page.facebook_ad_account_id;
    const token = adminUser.access_token;

    // 2. Fetch campaigns
    const campaignsRes = await fetch(`https://graph.facebook.com/v19.0/${adAccountId}/campaigns?fields=id,name,objective,effective_status,daily_budget,lifetime_budget,insights{impressions,reach,spend,clicks,cpm,ctr,cpc}&effective_status=[\"ACTIVE\",\"PAUSED\"]&access_token=${token}`);
    const campaignsData = await campaignsRes.json();
    console.log('Campaigns data:', campaignsData);

    for (const campaign of (campaignsData as { data: any[] }).data) {
      // 3. Upsert Campaign
      // Manual upsert for campaign
      let campaignEntry = await strapi.db.query('api::fb-campaign.fb-campaign').findOne({
        where: { fb_campaign_id: campaign.id },
      });

      const campaignData = {
        fb_campaign_id: campaign.id,
        name: campaign.name,
        objective: campaign.objective,
        effective_status: campaign.effective_status,
        daily_budget: campaign.daily_budget,
        lifetime_budget: campaign.lifetime_budget,
        impressions: campaign.insights?.data?.[0]?.impressions || 0,
        reach: campaign.insights?.data?.[0]?.reach || 0,
        spend: campaign.insights?.data?.[0]?.spend || 0,
        fb_page: page.id,
      };

      if (campaignEntry) {
        await strapi.db.query('api::fb-campaign.fb-campaign').update({
          where: { id: campaignEntry.id },
          data: campaignData,
        });
        // Fetch the updated entry
        campaignEntry = await strapi.db.query('api::fb-campaign.fb-campaign').findOne({
          where: { id: campaignEntry.id },
        });
      } else {
        campaignEntry = await strapi.db.query('api::fb-campaign.fb-campaign').create({
          data: campaignData,
        });
      }

      // 4. Fetch ads under campaign
      const adsRes = await fetch(`https://graph.facebook.com/v19.0/${campaign.id}/ads?fields=id,name,effective_status,creative{effective_object_story_id,object_story_spec{link_data{message,name,description,link,call_to_action},video_data{video_id,title,message,call_to_action}}}&access_token=${token}`);
      const adsData = await adsRes.json() as { data: any[] };

      for (const ad of adsData.data) {
        // Only update ads with effective_status 'ACTIVE'
        if (ad.effective_status !== 'ACTIVE') {
          console.log(`⏭️ Skipping ad ${ad.id} with status ${ad.effective_status}`);
          continue;
        }

        // 5. Fetch insights per ad
        const insightsRes = await fetch(`https://graph.facebook.com/v19.0/${ad.id}/insights?fields=impressions,reach,spend,clicks,cpm,ctr,cpc,actions,date_start,date_stop&access_token=${token}`);
        const insightsData = await insightsRes.json() as { data?: any[] };

        // 6. Get full image from post
        let postImageUrl = null;
        const postId = ad.creative?.effective_object_story_id;
        if (postId) {
          const postRes = await fetch(`https://graph.facebook.com/v19.0/${postId}?fields=full_picture&access_token=${token}`);
          const postData: { full_picture?: string } = await postRes.json();
          postImageUrl = postData?.full_picture || null;
        }

        // 7. Create or update ad
        let adEntry = await strapi.db.query('api::fb-ad.fb-ad').findOne({
          where: { fb_ad_id: ad.id },
        });

        const adData = {
          fb_ad_id: ad.id,
          name: ad.name,
          effective_status: ad.effective_status,
          image_url: postImageUrl,
          creative_text: ad.creative?.object_story_spec?.link_data?.message || '',
          call_to_action: ad.creative?.object_story_spec?.link_data?.call_to_action?.type || '',
          fb_campaign: campaignEntry.id
        };

        if (adEntry) {
          await strapi.db.query('api::fb-ad.fb-ad').update({
            where: { id: adEntry.id },
            data: adData,
          });
          adEntry = await strapi.db.query('api::fb-ad.fb-ad').findOne({
            where: { id: adEntry.id },
          });
        } else {
          adEntry = await strapi.db.query('api::fb-ad.fb-ad').create({
            data: adData,
          });
        }

        // 8. Store insights per date (ad-insight)
        for (const insight of insightsData.data || []) {
          const insightEntry = await strapi.db.query('api::fb-ad-insight.fb-ad-insight').create({
            data: {
              ad: adEntry.id,
              date_start: insight.date_start,
              date_stop: insight.date_stop,
              impressions: insight.impressions || 0,
              reach: insight.reach || 0,
              clicks: insight.clicks || 0,
              spend: insight.spend || 0,
              cpm: insight.cpm || 0,
              ctr: insight.ctr || 0,
              cpc: insight.cpc || 0,
              actions: insight.actions || [],
            }
          });
          // Ensure the ad points to the new insight
          await strapi.db.query('api::fb-ad.fb-ad').update({
            where: { id: adEntry.id },
            data: { fb_ad_insight: insightEntry.id }
          });
        }
      }
    }

    return ctx.send({ message: 'Facebook sync complete ✅' });
  }
}))