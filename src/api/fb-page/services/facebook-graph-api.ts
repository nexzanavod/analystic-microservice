/**
 * Facebook Graph API Service
 */

import axios from 'axios';

interface FacebookInsightMetric {
  name: string;
  values: Array<{
    value: number;
    end_time: string;
  }>;
}

interface FacebookInsightResponse {
  data: FacebookInsightMetric[];
}

export class FacebookGraphAPI {
  private baseUrl = 'https://graph.facebook.com/v23.0';

  async getPageInsights(
    pageId: string,
    accessToken: string,
    metrics: string[],
    date: string
  ): Promise<FacebookInsightResponse> {
    const response = await axios.get(`${this.baseUrl}/${pageId}/insights`, {
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

  async getAnalyticsData(pageId: string, accessToken: string, date: string) {
    const metrics = [
      'page_impressions',
      'page_views_total',
      'page_impressions_unique',
      'page_fans',
      'page_post_engagements'
    ];

    return this.getPageInsights(pageId, accessToken, metrics, date);
  }

  async getAudienceGrowthData(pageId: string, accessToken: string, date: string) {
    const metrics = ['page_fans', 'page_fan_adds'];
    return this.getPageInsights(pageId, accessToken, metrics, date);
  }

  extractMetricValue(data: FacebookInsightMetric[], metricName: string): number {
    return data.find(m => m.name === metricName)?.values?.[0]?.value || 0;
  }
}

export default new FacebookGraphAPI();
