/**
 * LinkedIn Service
 * Fetches real LinkedIn company posts using LinkedIn Official API
 * NO MOCK DATA - Only returns real posts or throws errors
 */

import axios from 'axios';

export interface LinkedInPost {
  id: string;
  text: string;
  author: {
    name: string;
    profileUrl: string;
    imageUrl?: string;
  };
  imageUrl?: string;
  videoUrl?: string;
  timestamp: string;
  likes: number;
  comments: number;
  shares: number;
  url: string;
}

const LINKEDIN_COMPANY_URL = 'https://www.linkedin.com/company/altie-reality/mycompany/';

/**
 * Fetch posts using LinkedIn Official API
 * Uses LinkedIn Marketing Developer Platform API
 */
export async function fetchPostsViaLinkedInAPI(): Promise<LinkedInPost[]> {
  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
  const companyURN = process.env.LINKEDIN_COMPANY_URN;

  if (!accessToken) {
    throw new Error('LINKEDIN_ACCESS_TOKEN is not set in environment variables');
  }
  
  if (!companyURN) {
    throw new Error('LINKEDIN_COMPANY_URN is not set in environment variables');
  }

  console.log('🔗 Attempting to fetch LinkedIn posts via Official API...');
  console.log('Company URN:', companyURN);
  console.log('Access Token present:', !!accessToken);

  try {
    // Method 1: Try UGC Posts API (for user-generated content)
    try {
      console.log('📡 Trying UGC Posts API...');
      const ugcResponse = await axios.get(
        `https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List(${encodeURIComponent(companyURN)})&count=10`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
          },
        }
      );

      const posts = ugcResponse.data?.elements || [];
      console.log(`✅ UGC Posts API returned ${posts.length} posts`);

      if (posts.length > 0) {
        // Fetch engagement metrics for each post
        const postsWithMetrics = await Promise.all(
          posts.map(async (post: any) => {
            try {
              // Get post engagement metrics
              const metricsResponse = await axios.get(
                `https://api.linkedin.com/v2/socialActions/${post.id}`,
                {
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'X-Restli-Protocol-Version': '2.0.0',
                  },
                }
              ).catch(() => null);

              const shareContent = post.specificContent?.['com.linkedin.ugc.ShareContent'];
              const text = shareContent?.text?.text || '';
              const media = shareContent?.media?.elements?.[0];
              
              const postId = post.id || post.urn || `post-${Date.now()}`;
              const postIdClean = typeof postId === 'string' ? postId.replace('urn:li:ugcPost:', '') : postId;
              
              return {
                id: postId,
                text: text,
                author: {
                  name: 'Altie Reality',
                  profileUrl: LINKEDIN_COMPANY_URL,
                  imageUrl: '/img/altierealitylogo.png',
                },
                imageUrl: media?.media?.originalUrl || media?.thumbnails?.[0]?.url || undefined,
                timestamp: post.created?.time || post.firstPublishedAt || new Date().toISOString(),
                likes: metricsResponse?.data?.likesSummary?.totalLikes || 0,
                comments: metricsResponse?.data?.commentsSummary?.totalFirstLevelComments || 0,
                shares: metricsResponse?.data?.sharesSummary?.totalShares || 0,
                url: `https://www.linkedin.com/feed/update/${postIdClean}` || LINKEDIN_COMPANY_URL,
              };
            } catch (error: any) {
              console.error(`❌ Error processing post ${post.id}:`, error.response?.data || error.message);
              return null;
            }
          })
        );

        const validPosts = postsWithMetrics.filter((post) => post !== null) as LinkedInPost[];
        if (validPosts.length > 0) {
          console.log(`✅ Successfully processed ${validPosts.length} posts from UGC API`);
          return validPosts;
        }
      }
    } catch (ugcError: any) {
      console.error('❌ UGC Posts API failed:', {
        status: ugcError.response?.status,
        statusText: ugcError.response?.statusText,
        data: ugcError.response?.data,
        message: ugcError.message
      });
    }

    // Method 2: Try Share API (alternative endpoint)
    console.log('📡 Trying Share API as fallback...');
    const shareResponse = await axios.get(
      `https://api.linkedin.com/v2/shares?q=owners&owners=${encodeURIComponent(companyURN)}&count=10`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      }
    );

    const shares = shareResponse.data?.elements || [];
    console.log(`✅ Share API returned ${shares.length} shares`);

    if (shares.length === 0) {
      throw new Error('No posts found via Share API');
    }

    return shares.map((share: any, index: number) => {
      const content = share.content || {};
      const text = content.text || '';
      
      return {
        id: share.id || `share-${index}`,
        text: text,
        author: {
          name: 'Altie Reality',
          profileUrl: LINKEDIN_COMPANY_URL,
          imageUrl: '/img/altierealitylogo.png',
        },
        imageUrl: content.media?.thumbnailUrl || undefined,
        timestamp: share.created?.time || new Date().toISOString(),
        likes: share.numLikes || 0,
        comments: share.numComments || 0,
        shares: share.numShares || 0,
        url: `https://www.linkedin.com/feed/update/${share.id}` || LINKEDIN_COMPANY_URL,
      };
    });
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('LinkedIn API authentication failed. Please refresh your access token.');
    } else if (error.response?.status === 403) {
      throw new Error('LinkedIn API access denied. Please check your app permissions and company URN.');
    } else if (error.response?.status === 404) {
      throw new Error('LinkedIn API endpoint not found. Please verify the API version and endpoint.');
    }
    console.error('❌ LinkedIn API error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    throw new Error(`Failed to fetch posts via LinkedIn API: ${error.message}`);
  }
}

/**
 * Fetch posts using RSS Feed (fallback method)
 */
export async function fetchPostsViaRSS(): Promise<LinkedInPost[]> {
  const RSSParser = require('rss-parser');
  const parser = new RSSParser();

  console.log('📡 Attempting to fetch LinkedIn posts via RSS feed...');

  try {
    // Try common RSS feed URLs
    const rssUrls = [
      `https://www.linkedin.com/company/altie-reality/mycompany/feed/rss/`,
      `https://www.linkedin.com/company/altie-reality/feed/rss/`,
    ];

    for (const url of rssUrls) {
      try {
        console.log(`Trying RSS feed: ${url}`);
        const feed = await parser.parseURL(url);
        
        if (feed.items && feed.items.length > 0) {
          console.log(`✅ RSS feed returned ${feed.items.length} items`);
          return feed.items.slice(0, 10).map((item: any, index: number) => ({
            id: item.guid || item.link || `rss-${index}`,
            text: item.contentSnippet || item.content || item.title || '',
            author: {
              name: 'Altie Reality',
              profileUrl: LINKEDIN_COMPANY_URL,
              imageUrl: '/img/altierealitylogo.png',
            },
            imageUrl: item.enclosure?.url || item['media:content']?.['$']?.url || undefined,
            timestamp: item.pubDate || new Date().toISOString(),
            likes: 0, // RSS doesn't provide engagement metrics
            comments: 0,
            shares: 0,
            url: item.link || LINKEDIN_COMPANY_URL,
          }));
        }
      } catch (error) {
        console.log(`RSS feed ${url} not available, trying next...`);
        continue;
      }
    }

    throw new Error('No RSS feed available');
  } catch (error: any) {
    console.error('❌ RSS feed error:', error.message);
    throw new Error(`Failed to fetch posts via RSS: ${error.message}`);
  }
}

/**
 * Main function to fetch LinkedIn posts
 * Tries LinkedIn Official API first, then RSS feed
 * NEVER returns mock data - throws error if all methods fail
 */
export async function getLinkedInPosts(): Promise<LinkedInPost[]> {
  console.log('🚀 Starting LinkedIn posts fetch...');
  console.log('Environment check:', {
    hasAccessToken: !!process.env.LINKEDIN_ACCESS_TOKEN,
    hasCompanyURN: !!process.env.LINKEDIN_COMPANY_URN,
    companyURN: process.env.LINKEDIN_COMPANY_URN
  });

  // Method 1: Try LinkedIn Official API (Most Professional)
  if (process.env.LINKEDIN_ACCESS_TOKEN && process.env.LINKEDIN_COMPANY_URN) {
    try {
      console.log('📡 Attempting LinkedIn Official API...');
      const posts = await fetchPostsViaLinkedInAPI();
      if (posts.length > 0) {
        console.log(`✅ Successfully fetched ${posts.length} posts from LinkedIn API`);
        return posts;
      } else {
        console.warn('⚠️ LinkedIn API returned 0 posts');
      }
    } catch (error: any) {
      console.error('❌ LinkedIn API failed:', error.message);
      // Don't fall through to RSS if API credentials are set - this means there's a real problem
      throw new Error(`LinkedIn API failed: ${error.message}`);
    }
  } else {
    console.warn('⚠️ LinkedIn API credentials not configured');
    console.warn('Missing:', {
      accessToken: !process.env.LINKEDIN_ACCESS_TOKEN,
      companyURN: !process.env.LINKEDIN_COMPANY_URN
    });
  }

  // Method 2: Try RSS Feed (Simple and reliable)
  try {
    console.log('📡 Attempting RSS feed as fallback...');
    const posts = await fetchPostsViaRSS();
    if (posts.length > 0) {
      console.log(`✅ Successfully fetched ${posts.length} posts from RSS feed`);
      return posts;
    }
  } catch (error: any) {
    console.error('❌ RSS feed failed:', error.message);
  }

  // NO MOCK DATA - Throw error instead
  throw new Error('All LinkedIn fetch methods failed. Please configure LinkedIn API credentials or check RSS feed availability.');
}

/**
 * Format timestamp to relative time (e.g., "2 days ago")
 */
export const formatRelativeTime = (timestamp: string): string => {
  const now = new Date();
  const postDate = new Date(timestamp);
  const diffInSeconds = Math.floor((now.getTime() - postDate.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)}w ago`;
  return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
};
