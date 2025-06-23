"use strict";
/**
 * Facebook Graph API Service
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FacebookGraphAPI = void 0;
const axios_1 = __importDefault(require("axios"));
class FacebookGraphAPI {
    constructor() {
        this.baseUrl = 'https://graph.facebook.com/v23.0';
    }
    async getPageInsights(pageId, accessToken, metrics, date) {
        const response = await axios_1.default.get(`${this.baseUrl}/${pageId}/insights`, {
            params: {
                metric: metrics.join(','),
                period: 'day',
                since: date,
                until: date,
                access_token: accessToken,
            },
        });
        return response.data;
    }
    async getAnalyticsData(pageId, accessToken, date) {
        const metrics = [
            'page_impressions',
            'page_views_total',
            'page_impressions_unique',
            'page_fans',
            'page_post_engagements'
        ];
        return this.getPageInsights(pageId, accessToken, metrics, date);
    }
    async getAudienceGrowthData(pageId, accessToken, date) {
        const metrics = ['page_fans', 'page_fan_adds'];
        return this.getPageInsights(pageId, accessToken, metrics, date);
    }
    extractMetricValue(data, metricName) {
        var _a, _b, _c;
        return ((_c = (_b = (_a = data.find(m => m.name === metricName)) === null || _a === void 0 ? void 0 : _a.values) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.value) || 0;
    }
}
exports.FacebookGraphAPI = FacebookGraphAPI;
exports.default = new FacebookGraphAPI();
