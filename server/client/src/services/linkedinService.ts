/**
 * LinkedIn Service
 * Fetches company posts from LinkedIn profile
 * Auto-refreshes with newer posts
 */

import { getApiBaseUrl } from '../utils/apiConfig';

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
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

let cachedPosts: LinkedInPost[] = [];
let lastFetchTime = 0;

/**
 * Fetch LinkedIn posts from backend API
 * Falls back to mock data if API is not available
 */
export const fetchLinkedInPosts = async (limit: number = 6): Promise<LinkedInPost[]> => {
  // Check cache first
  const now = Date.now();
  if (cachedPosts.length > 0 && (now - lastFetchTime) < CACHE_DURATION) {
    return cachedPosts.slice(0, limit);
  }

  try {
    // Get the API base URL (works for both local and production)
    const apiBaseUrl = getApiBaseUrl();
    const apiUrl = `${apiBaseUrl}/linkedin/posts`;
    
    console.log('🌐 Fetching LinkedIn posts from:', apiUrl);
    
    // Try to fetch from backend API
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ LinkedIn posts fetched successfully:', data);
      cachedPosts = data.posts || [];
      lastFetchTime = now;
      return cachedPosts.slice(0, limit);
    } else {
      console.warn('⚠️ LinkedIn API returned non-OK status:', response.status);
    }
  } catch (error) {
    console.error('❌ Error fetching LinkedIn posts:', error);
  }

  // Fallback to mock data for demonstration
  // In production, this should be replaced with actual LinkedIn API integration
  console.warn('⚠️ Using mock LinkedIn posts as fallback');
  return getMockLinkedInPosts(limit);
};

/**
 * Get mock LinkedIn posts for demonstration
 * Replace this with actual LinkedIn API integration
 */
const getMockLinkedInPosts = (limit: number): LinkedInPost[] => {
  const mockPosts: LinkedInPost[] = [
    {
      id: '1',
      text: '🎉 Exciting news! LearnXR™ has been selected as the official VR learning platform for 50+ schools across India. We\'re transforming education through immersive experiences! #EdTech #VR #LearnXR',
      author: {
        name: 'Altie Reality',
        profileUrl: LINKEDIN_COMPANY_URL,
        imageUrl: '/img/altierealitylogo.png',
      },
      imageUrl: '/img/lxrn1.png',
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      likes: 234,
      comments: 18,
      shares: 45,
      url: LINKEDIN_COMPANY_URL,
    },
    {
      id: '2',
      text: '🌟 We\'re proud to announce our partnership with leading educational institutions to bring immersive VR learning to students nationwide. Together, we\'re shaping the future of education! #Partnership #Innovation',
      author: {
        name: 'Altie Reality',
        profileUrl: LINKEDIN_COMPANY_URL,
        imageUrl: '/img/altierealitylogo.png',
      },
      imageUrl: '/img/lxrn2.png',
      timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      likes: 189,
      comments: 12,
      shares: 32,
      url: LINKEDIN_COMPANY_URL,
    },
    {
      id: '3',
      text: '📚 Our K-12 curriculum library now includes 10,000+ interactive VR lessons! From STEM to Humanities, students can explore subjects like never before. #Education #VR #K12',
      author: {
        name: 'Altie Reality',
        profileUrl: LINKEDIN_COMPANY_URL,
        imageUrl: '/img/altierealitylogo.png',
      },
      imageUrl: '/img/lxrn3.png',
      timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      likes: 312,
      comments: 25,
      shares: 67,
      url: LINKEDIN_COMPANY_URL,
    },
  ];

  return mockPosts.slice(0, limit);
};

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
