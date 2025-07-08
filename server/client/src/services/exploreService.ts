import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  increment, 
  serverTimestamp,
  onSnapshot,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth } from 'firebase/auth';

const functions = getFunctions();
const auth = getAuth();

// Initialize callable functions
const getSkyboxStylesFunction = httpsCallable(functions, 'getSkyboxStyles');
const healthCheckFunction = httpsCallable(functions, 'healthCheck');

// Types
export interface SkyboxStyle {
  id: string;
  name: string;
  description?: string;
  category: string;
  preview_url?: string;
  image_jpg?: string;
  image?: string;
  tags: string[];
  author?: string;
  likes: number;
  views: number;
  downloads: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isTrending?: boolean;
  isStaffPick?: boolean;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
}

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  content: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  author: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: number; // in minutes
  views: number;
  likes: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  tags: string[];
}

export interface CommunityPost {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  skyboxStyleId?: string;
  skyboxImage?: string;
  likes: number;
  comments: number;
  views: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  tags: string[];
  isPinned?: boolean;
}

export interface UserInteraction {
  id: string;
  userId: string;
  skyboxStyleId: string;
  action: 'view' | 'like' | 'download' | 'use';
  timestamp: Timestamp;
}

export interface TrendingData {
  skyboxStyleId: string;
  views: number;
  likes: number;
  downloads: number;
  uses: number;
  trendScore: number;
  lastUpdated: Timestamp;
}

// Collections
const COLLECTIONS = {
  SKYBOX_STYLES: 'skyboxStyles',
  TUTORIALS: 'tutorials',
  COMMUNITY_POSTS: 'communityPosts',
  USER_INTERACTIONS: 'userInteractions',
  TRENDING_DATA: 'trendingData',
  STYLE_CATEGORIES: 'styleCategories'
};

// Import the authenticated API service
import { apiService } from './apiService';

// Skybox Styles Service
export const skyboxStylesService = {
  // Get all skybox styles
  async getAllStyles(): Promise<SkyboxStyle[]> {
    try {
      const result = await apiService.getSkyboxStyles(1, 20);
      
      if (result.success) {
        return result.data || [];
      } else {
        throw new Error(result.error || 'Failed to fetch skybox styles');
      }
    } catch (error) {
      console.error('Error fetching skybox styles:', error);
      // Fallback to Firebase Firestore
      return this.fetchSkyboxStylesFromFirestore();
    }
  },

  // Get styles by category
  async getStylesByCategory(category: string): Promise<SkyboxStyle[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.SKYBOX_STYLES),
        where('category', '==', category)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SkyboxStyle[];
    } catch (error) {
      console.error('Error fetching styles by category:', error);
      throw error;
    }
  },

  // Get trending styles
  async getTrendingStyles(limit: number = 10): Promise<SkyboxStyle[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.SKYBOX_STYLES),
        where('isTrending', '==', true),
        orderBy('likes', 'desc'),
        limit(limit)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SkyboxStyle[];
    } catch (error) {
      console.error('Error fetching trending styles:', error);
      throw error;
    }
  },

  // Get staff picks
  async getStaffPicks(): Promise<SkyboxStyle[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.SKYBOX_STYLES),
        where('isStaffPick', '==', true),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SkyboxStyle[];
    } catch (error) {
      console.error('Error fetching staff picks:', error);
      throw error;
    }
  },

  // Search styles
  async searchStyles(searchTerm: string): Promise<SkyboxStyle[]> {
    try {
      const allStyles = await this.getAllStyles();
      return allStyles.filter(style => 
        style.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        style.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        style.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    } catch (error) {
      console.error('Error searching styles:', error);
      throw error;
    }
  },

  // Record user interaction
  async recordInteraction(userId: string, skyboxStyleId: string, action: 'view' | 'like' | 'download' | 'use'): Promise<void> {
    try {
      // Add interaction record
      await addDoc(collection(db, COLLECTIONS.USER_INTERACTIONS), {
        userId,
        skyboxStyleId,
        action,
        timestamp: serverTimestamp()
      });

      // Update skybox style stats
      const styleRef = doc(db, COLLECTIONS.SKYBOX_STYLES, skyboxStyleId);
      const updateData: any = {};
      
      switch (action) {
        case 'view':
          updateData.views = increment(1);
          break;
        case 'like':
          updateData.likes = increment(1);
          break;
        case 'download':
          updateData.downloads = increment(1);
          break;
        case 'use':
          updateData.uses = increment(1);
          break;
      }

      await updateDoc(styleRef, updateData);

      // Update trending data
      await this.updateTrendingData(skyboxStyleId);
    } catch (error) {
      console.error('Error recording interaction:', error);
      throw error;
    }
  },

  // Update trending data
  async updateTrendingData(skyboxStyleId: string): Promise<void> {
    try {
      const styleRef = doc(db, COLLECTIONS.SKYBOX_STYLES, skyboxStyleId);
      const styleDoc = await getDoc(styleRef);
      
      if (styleDoc.exists()) {
        const styleData = styleDoc.data() as SkyboxStyle;
        const trendScore = (styleData.views * 0.1) + (styleData.likes * 0.3) + (styleData.downloads * 0.5) + (styleData.uses * 0.8);
        
        const trendingRef = doc(db, COLLECTIONS.TRENDING_DATA, skyboxStyleId);
        await updateDoc(trendingRef, {
          skyboxStyleId,
          views: styleData.views,
          likes: styleData.likes,
          downloads: styleData.downloads,
          uses: styleData.uses || 0,
          trendScore,
          lastUpdated: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Error updating trending data:', error);
      throw error;
    }
  },

  // Fetch styles from Firestore
  async fetchSkyboxStylesFromFirestore(): Promise<SkyboxStyle[]> {
    try {
      const stylesRef = collection(db, 'skyboxStyles');
      const q = query(
        stylesRef,
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      
      const snapshot = await getDocs(q);
      const styles = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      return styles;
    } catch (error) {
      console.error('Error fetching from Firestore:', error);
      throw error;
    }
  }
};

// Tutorials Service
export const tutorialsService = {
  // Get all tutorials
  async getAllTutorials(): Promise<Tutorial[]> {
    try {
      // For now, return empty array since tutorials endpoint might not be implemented
      // You can implement this when the backend endpoint is ready
      return [];
    } catch (error) {
      console.error('Error fetching tutorials:', error);
      throw error;
    }
  },

  // Get tutorials by category
  async getTutorialsByCategory(category: string): Promise<Tutorial[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.TUTORIALS),
        where('category', '==', category)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Tutorial[];
    } catch (error) {
      console.error('Error fetching tutorials by category:', error);
      throw error;
    }
  },

  // Get tutorials by difficulty
  async getTutorialsByDifficulty(difficulty: 'beginner' | 'intermediate' | 'advanced'): Promise<Tutorial[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.TUTORIALS),
        where('difficulty', '==', difficulty)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Tutorial[];
    } catch (error) {
      console.error('Error fetching tutorials by difficulty:', error);
      throw error;
    }
  },

  // Get popular tutorials
  async getPopularTutorials(limit: number = 10): Promise<Tutorial[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.TUTORIALS),
        orderBy('views', 'desc'),
        limit(limit)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Tutorial[];
    } catch (error) {
      console.error('Error fetching popular tutorials:', error);
      throw error;
    }
  }
};

// Community Service
export const communityService = {
  // Get all community posts
  async getAllPosts(): Promise<CommunityPost[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/community/posts`);
      const data = await response.json();
      
      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.error || 'Failed to fetch community posts');
      }
    } catch (error) {
      console.error('Error fetching community posts:', error);
      throw error;
    }
  },

  // Get posts by tag
  async getPostsByTag(tag: string): Promise<CommunityPost[]> {
    try {
      const allPosts = await this.getAllPosts();
      return allPosts.filter(post => 
        post.tags.some(postTag => postTag.toLowerCase().includes(tag.toLowerCase()))
      );
    } catch (error) {
      console.error('Error fetching posts by tag:', error);
      throw error;
    }
  },

  // Create new post
  async createPost(postData: Omit<CommunityPost, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const response = await fetch(`${API_BASE_URL}/community/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postData)
      });
      const data = await response.json();
      
      if (data.success) {
        return data.data.id;
      } else {
        throw new Error(data.error || 'Failed to create post');
      }
    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  },

  // Like a post
  async likePost(postId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/community/posts/${postId}/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      
      if (data.success) {
        // Track user interaction
        const user = auth.currentUser;
        if (user) {
          await addDoc(collection(db, 'communityInteractions'), {
            postId,
            userId: user.uid,
            action: 'like',
            timestamp: new Date()
          });
        }
      } else {
        throw new Error(data.error || 'Failed to like post');
      }
    } catch (error) {
      console.error('Error liking post:', error);
      throw error;
    }
  }
};

// Trending Service
export const trendingService = {
  // Get trending data
  async getTrendingData(limit: number = 20): Promise<TrendingData[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/trending/data?limit=${limit}`);
      const data = await response.json();
      
      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.error || 'Failed to fetch trending data');
      }
    } catch (error) {
      console.error('Error fetching trending data:', error);
      throw error;
    }
  },

  // Get real-time trending updates
  subscribeToTrending(callback: (data: TrendingData[]) => void) {
    const q = query(
      collection(db, COLLECTIONS.TRENDING_DATA),
      orderBy('trendScore', 'desc'),
      limit(10)
    );
    
    return onSnapshot(q, (querySnapshot) => {
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TrendingData[];
      callback(data);
    });
  }
};

// Style Categories Service
export const styleCategoriesService = {
  // Get all style categories
  async getCategories(): Promise<any[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/style/categories`);
      const data = await response.json();
      
      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.error || 'Failed to fetch style categories');
      }
    } catch (error) {
      console.error('Error fetching style categories:', error);
      throw error;
    }
  },

  // Get styles count by category
  async getStylesCountByCategory(): Promise<Record<string, number>> {
    try {
      const styles = await skyboxStylesService.getAllStyles();
      const countMap: Record<string, number> = {};
      
      styles.forEach(style => {
        countMap[style.category] = (countMap[style.category] || 0) + 1;
      });
      
      return countMap;
    } catch (error) {
      console.error('Error getting styles count by category:', error);
      throw error;
    }
  }
};

// Environment check
export const checkEnvironment = async () => {
  try {
    const result = await healthCheckFunction({});
    const data = result.data as any;
    return data;
  } catch (error) {
    console.error('Error checking environment:', error);
    return {
      environment: 'development',
      firebase: true,
      razorpay: false,
      blockadelabs: false,
      timestamp: new Date().toISOString()
    };
  }
};

export default {
  skyboxStylesService,
  tutorialsService,
  communityService,
  trendingService,
  styleCategoriesService
}; 