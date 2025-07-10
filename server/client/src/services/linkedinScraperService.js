// LinkedIn Scraper Service
// Note: Due to LinkedIn's anti-scraping measures, we'll use a proxy-based approach
// and implement proper rate limiting and user agents

class LinkedInScraperService {
  constructor() {
    this.baseUrl = 'https://www.linkedin.com/company/evoneural-ai-opc';
    this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }

  // Fetch posts using a proxy service (you'll need to set up a proxy service)
  async fetchLinkedInPosts() {
    try {
      // For now, we'll use a mock API endpoint that you can replace with actual scraping
      const response = await fetch('/api/linkedin-posts', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch LinkedIn posts');
      }

      const data = await response.json();
      return this.transformPosts(data.posts);
    } catch (error) {
      console.error('Error fetching LinkedIn posts:', error);
      // Return fallback data if scraping fails
      return this.getFallbackPosts();
    }
  }

  // Transform LinkedIn posts to blog format
  transformPosts(posts) {
    return posts.map(post => ({
      id: post.id,
      title: post.title || this.generateTitleFromContent(post.content),
      category: this.categorizePost(post.content),
      date: new Date(post.timestamp).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      excerpt: this.truncateContent(post.content, 200),
      image: post.image || this.getDefaultImage(post.category),
      readTime: this.calculateReadTime(post.content),
      featured: post.featured || false,
      achievements: this.extractAchievements(post.content),
      linkedInUrl: post.url,
      likes: post.likes,
      comments: post.comments,
      shares: post.shares
    }));
  }

  // Generate title from content if not provided
  generateTitleFromContent(content) {
    const sentences = content.split('.');
    return sentences[0].substring(0, 60) + (sentences[0].length > 60 ? '...' : '');
  }

  // Categorize post based on content
  categorizePost(content) {
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('award') || lowerContent.includes('achievement') || lowerContent.includes('milestone')) {
      return 'achievements';
    } else if (lowerContent.includes('ai') || lowerContent.includes('technology') || lowerContent.includes('update')) {
      return 'technology';
    } else if (lowerContent.includes('partnership') || lowerContent.includes('collaboration')) {
      return 'partnerships';
    } else if (lowerContent.includes('team') || lowerContent.includes('hiring') || lowerContent.includes('company')) {
      return 'company';
    }
    
    return 'company';
  }

  // Extract achievements from content
  extractAchievements(content) {
    const achievements = [];
    const lowerContent = content.toLowerCase();
    
    // Look for common achievement patterns
    if (lowerContent.includes('award')) achievements.push('Industry Award');
    if (lowerContent.includes('milestone')) achievements.push('Company Milestone');
    if (lowerContent.includes('partnership')) achievements.push('Strategic Partnership');
    if (lowerContent.includes('funding')) achievements.push('Funding Success');
    if (lowerContent.includes('launch')) achievements.push('Product Launch');
    if (lowerContent.includes('growth')) achievements.push('Company Growth');
    
    return achievements.length > 0 ? achievements : ['Company Update'];
  }

  // Truncate content for excerpt
  truncateContent(content, maxLength) {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength).trim() + '...';
  }

  // Calculate read time
  calculateReadTime(content) {
    const wordsPerMinute = 200;
    const wordCount = content.split(' ').length;
    const minutes = Math.ceil(wordCount / wordsPerMinute);
    return `${minutes} min read`;
  }

  // Get default image based on category
  getDefaultImage(category) {
    const images = {
      achievements: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
      technology: 'https://images.unsplash.com/photo-1676299251956-0d4c7c0c8c8c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
      partnerships: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
      company: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
    };
    return images[category] || images.company;
  }

  // Fallback posts if scraping fails
  getFallbackPosts() {
    return [
      {
        id: 1,
        title: "In3D.AI Platform Launch - Revolutionizing 3D Content Creation",
        category: "technology",
        date: "January 15, 2025",
        excerpt: "We're excited to announce the launch of In3D.AI, our revolutionary AI-powered platform that transforms text prompts into stunning 3D assets. This breakthrough technology is set to change how creators approach 3D content generation.",
        image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        readTime: "5 min read",
        featured: true,
        achievements: ["Platform Launch", "AI Innovation", "3D Technology"],
        linkedInUrl: "https://www.linkedin.com/company/evoneural-ai-opc",
        likes: 45,
        comments: 12,
        shares: 8
      },
      {
        id: 2,
        title: "Evoneural AI Secures Strategic Partnership in Gaming Industry",
        category: "partnerships",
        date: "January 10, 2025",
        excerpt: "We're thrilled to announce a groundbreaking partnership that will revolutionize how game developers create 3D assets. This collaboration will reduce production time by up to 70% while maintaining quality standards.",
        image: "https://images.unsplash.com/photo-1511512578047-dfb367046420?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        readTime: "4 min read",
        featured: false,
        achievements: ["Strategic Partnership", "Industry Collaboration", "Innovation"],
        linkedInUrl: "https://www.linkedin.com/company/evoneural-ai-opc",
        likes: 32,
        comments: 8,
        shares: 15
      }
    ];
  }
}

export default new LinkedInScraperService(); 