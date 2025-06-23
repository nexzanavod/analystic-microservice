import axios from 'axios';

export async function fetchPageReactions(pageId: string, accessToken: string, date: string) {
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
    const response = await axios.get(`${baseUrl}/${pageId}/insights`, { params });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error('[FB API] Error response:', error.response.data);
    } else {
      console.error('[FB API] Error:', error.message);
    }
    throw error;
  }
}
