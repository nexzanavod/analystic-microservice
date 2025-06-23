"use strict";
/**
 * fb-page controller - Refactored
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strapi_1 = require("@strapi/strapi");
const facebook_graph_api_1 = __importDefault(require("../services/facebook-graph-api"));
const facebook_reaction_api_1 = require("../services/facebook-reaction-api");
exports.default = strapi_1.factories.createCoreController('api::fb-page.fb-page', ({ strapi }) => ({
    async fetchAnalytics(ctx) {
        var _a, _b;
        const { facebook_page_id, date } = ctx.request.body;
        if (!facebook_page_id || !date) {
            return ctx.badRequest('Missing facebook_page_id or date');
        }
        try {
            const page = await strapi.db.query('api::fb-page.fb-page').findOne({
                where: { facebook_page_id },
            });
            if (!page) {
                return ctx.notFound('Page not found');
            }
            const adminUser = await strapi.db.query('api::fb-admin-user.fb-admin-user').findOne({});
            if (!adminUser || !adminUser.access_token) {
                return ctx.notFound('Admin user or access token not found');
            }
            console.log('Fetching analytics for page:', facebook_page_id, 'on date:', date, 'with access token:', adminUser.access_token);
            const analyticsResponse = await facebook_graph_api_1.default.getAnalyticsData(facebook_page_id, adminUser.access_token, date);
            const growthResponse = await facebook_graph_api_1.default.getAudienceGrowthData(facebook_page_id, adminUser.access_token, date);
            // Fetch and store Facebook post reactions
            let reactionResponse, reactionData;
            try {
                reactionResponse = await (0, facebook_reaction_api_1.fetchPageReactions)(facebook_page_id, adminUser.access_token, date);
                reactionData = (_a = reactionResponse.data) === null || _a === void 0 ? void 0 : _a.find((m) => m.name === 'page_actions_post_reactions_total');
            }
            catch (err) {
                console.error('Error fetching Facebook reactions:', ((_b = err === null || err === void 0 ? void 0 : err.response) === null || _b === void 0 ? void 0 : _b.data) || err.message || err);
                throw ctx.badRequest('Failed to fetch Facebook reactions. See server logs for details.');
            }
            let reactionCounts = { like: 0, love: 0, wow: 0, haha: 0, sorry: 0, anger: 0 };
            if (reactionData && reactionData.values && reactionData.values[0] && reactionData.values[0].value) {
                const val = reactionData.values[0].value;
                reactionCounts = {
                    like: val.like || 0,
                    love: val.love || 0,
                    wow: val.wow || 0,
                    haha: val.haha || 0,
                    sorry: val.sorry || 0,
                    anger: val.anger || 0,
                };
            }
            // Save to fb-page-reaction table
            // Track reaction creation status
            let fbPageReactionCreated = false;
            let fbPageReactionSkipped = false;
            const existingReaction = await strapi.db.query('api::fb-page-reaction.fb-page-reaction').findOne({
                where: { date },
            });
            if (!existingReaction) {
                await strapi.db.query('api::fb-page-reaction.fb-page-reaction').create({
                    data: {
                        date,
                        like: reactionCounts.like,
                        loves: reactionCounts.love,
                        wows: reactionCounts.wow,
                        hahas: reactionCounts.haha,
                        sorrys: reactionCounts.sorry,
                        angers: reactionCounts.anger,
                    },
                });
                console.log('✅ FB Page Reaction data created for date:', date);
                fbPageReactionCreated = true;
            }
            else {
                console.log('⏭️ FB Page Reaction data already exists for date:', date, '- Skipping creation');
                fbPageReactionSkipped = true;
            }
            const analyticsData = analyticsResponse.data;
            let analyticsCreated = false;
            const existingAnalytics = await strapi.db.query('api::daily-fb-page-analytic.daily-fb-page-analytic').findOne({
                where: { fb_page: page.id, date },
            });
            if (!existingAnalytics) {
                const analyticsEntry = {
                    fb_page: page.id,
                    date,
                    impressions: facebook_graph_api_1.default.extractMetricValue(analyticsData, 'page_impressions'),
                    views: facebook_graph_api_1.default.extractMetricValue(analyticsData, 'page_views_total'),
                    reach: facebook_graph_api_1.default.extractMetricValue(analyticsData, 'page_impressions_unique'),
                    followers: facebook_graph_api_1.default.extractMetricValue(analyticsData, 'page_fans'),
                    engagements: facebook_graph_api_1.default.extractMetricValue(analyticsData, 'page_post_engagements'),
                };
                await strapi.db.query('api::daily-fb-page-analytic.daily-fb-page-analytic').create({
                    data: analyticsEntry,
                });
                console.log('✅ Analytics data created for date:', date);
                analyticsCreated = true;
            }
            else {
                console.log('⏭️ Analytics data already exists for date:', date, '- Skipping creation');
                analyticsCreated = false;
            }
            const growthData = growthResponse.data;
            let growthCreated = false;
            const existingGrowth = await strapi.db.query('api::audience-growth.audience-growth').findOne({
                where: { fb_page: page.id, date },
            });
            if (!existingGrowth) {
                const growthEntry = {
                    fb_page: page.id,
                    date,
                    followers: facebook_graph_api_1.default.extractMetricValue(growthData, 'page_fans'),
                    new_followers: facebook_graph_api_1.default.extractMetricValue(growthData, 'page_fan_adds'),
                };
                await strapi.db.query('api::audience-growth.audience-growth').create({
                    data: growthEntry,
                });
                console.log('✅ Audience growth data created for date:', date);
                growthCreated = true;
            }
            else {
                console.log('⏭️ Audience growth data already exists for date:', date, '- Skipping creation');
                growthCreated = false;
            }
            const createdItems = [];
            const skippedItems = [];
            if (analyticsCreated)
                createdItems.push('analytics');
            else
                skippedItems.push('analytics');
            if (growthCreated)
                createdItems.push('audience growth');
            else
                skippedItems.push('audience growth');
            let summaryMessage = `Data processing completed for page ${facebook_page_id} on ${date}`;
            if (createdItems.length > 0) {
                summaryMessage += ` - Created: ${createdItems.join(', ')}`;
            }
            if (skippedItems.length > 0) {
                summaryMessage += ` - Skipped: ${skippedItems.join(', ')} (already exists)`;
            }
            return ctx.send({
                message: summaryMessage,
                data: {
                    facebook_page_id,
                    date,
                    status: 'completed',
                    analytics_created: analyticsCreated,
                    growth_created: growthCreated,
                    created_items: createdItems,
                    skipped_items: skippedItems,
                    fb_page_reaction_created: fbPageReactionCreated,
                    fb_page_reaction_skipped: fbPageReactionSkipped
                },
            });
        }
        catch (error) {
            if (error.response && error.response.data) {
                console.error('Facebook API error:', error.response.data);
                return ctx.send({
                    error: 'Facebook API error',
                    details: error.response.data
                }, 400);
            }
            console.error('Error fetching analytics:', error);
            ctx.throw(500, 'Internal Server Error');
        }
    },
}));
