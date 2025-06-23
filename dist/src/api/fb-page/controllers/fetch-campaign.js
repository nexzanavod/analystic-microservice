"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const strapi_1 = require("@strapi/strapi");
exports.default = strapi_1.factories.createCoreController('api::fb-page.fb-page', ({ strapi }) => ({
    async fetchCampaignSync(ctx) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
        const { facebook_page_id } = ctx.request.body;
        console.log('Fetching campaign sync for page:', facebook_page_id);
        // 1. Find Facebook Page
        const page = await strapi.db.query('api::fb-page.fb-page').findOne({
            where: { facebook_page_id },
        });
        if (!page)
            return ctx.badRequest('FB Page not found');
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
        for (const campaign of campaignsData.data) {
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
                impressions: ((_c = (_b = (_a = campaign.insights) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.impressions) || 0,
                reach: ((_f = (_e = (_d = campaign.insights) === null || _d === void 0 ? void 0 : _d.data) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.reach) || 0,
                spend: ((_j = (_h = (_g = campaign.insights) === null || _g === void 0 ? void 0 : _g.data) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.spend) || 0,
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
            }
            else {
                campaignEntry = await strapi.db.query('api::fb-campaign.fb-campaign').create({
                    data: campaignData,
                });
            }
            // 4. Fetch ads under campaign
            const adsRes = await fetch(`https://graph.facebook.com/v19.0/${campaign.id}/ads?fields=id,name,effective_status,creative{effective_object_story_id,object_story_spec{link_data{message,name,description,link,call_to_action},video_data{video_id,title,message,call_to_action}}}&access_token=${token}`);
            const adsData = await adsRes.json();
            for (const ad of adsData.data) {
                // Only update ads with effective_status 'ACTIVE'
                if (ad.effective_status !== 'ACTIVE') {
                    console.log(`⏭️ Skipping ad ${ad.id} with status ${ad.effective_status}`);
                    continue;
                }
                // 5. Fetch insights per ad
                const insightsRes = await fetch(`https://graph.facebook.com/v19.0/${ad.id}/insights?fields=impressions,reach,spend,clicks,cpm,ctr,cpc,actions,date_start,date_stop&access_token=${token}`);
                const insightsData = await insightsRes.json();
                // 6. Get full image from post
                let postImageUrl = null;
                const postId = (_k = ad.creative) === null || _k === void 0 ? void 0 : _k.effective_object_story_id;
                if (postId) {
                    const postRes = await fetch(`https://graph.facebook.com/v19.0/${postId}?fields=full_picture&access_token=${token}`);
                    const postData = await postRes.json();
                    postImageUrl = (postData === null || postData === void 0 ? void 0 : postData.full_picture) || null;
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
                    creative_text: ((_o = (_m = (_l = ad.creative) === null || _l === void 0 ? void 0 : _l.object_story_spec) === null || _m === void 0 ? void 0 : _m.link_data) === null || _o === void 0 ? void 0 : _o.message) || '',
                    call_to_action: ((_s = (_r = (_q = (_p = ad.creative) === null || _p === void 0 ? void 0 : _p.object_story_spec) === null || _q === void 0 ? void 0 : _q.link_data) === null || _r === void 0 ? void 0 : _r.call_to_action) === null || _s === void 0 ? void 0 : _s.type) || '',
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
                }
                else {
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
}));
