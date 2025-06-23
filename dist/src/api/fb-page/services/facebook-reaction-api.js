"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchPageReactions = void 0;
const axios_1 = __importDefault(require("axios"));
async function fetchPageReactions(pageId, accessToken, date) {
    const baseUrl = 'https://graph.facebook.com/v23.0';
    const params = {
        metric: 'page_actions_post_reactions_total',
        period: 'day',
        since: date,
        until: date,
        access_token: accessToken,
    };
    try {
        console.log('[FB API] Request:', `${baseUrl}/${pageId}/insights`, params);
        const response = await axios_1.default.get(`${baseUrl}/${pageId}/insights`, { params });
        return response.data;
    }
    catch (error) {
        if (error.response) {
            console.error('[FB API] Error response:', error.response.data);
        }
        else {
            console.error('[FB API] Error:', error.message);
        }
        throw error;
    }
}
exports.fetchPageReactions = fetchPageReactions;
