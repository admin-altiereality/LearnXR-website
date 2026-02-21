import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaLinkedin, FaHeart, FaComment, FaShare, FaExternalLinkAlt } from 'react-icons/fa';
import { fetchLinkedInPosts, formatRelativeTime, type LinkedInPost } from '../services/linkedinService';

interface LinkedInActivityProps {
  limit?: number;
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
}

const LinkedInActivity: React.FC<LinkedInActivityProps> = ({
  limit = 6,
  autoRefresh = true,
  refreshInterval = 5 * 60 * 1000, // 5 minutes
}) => {
  const [posts, setPosts] = useState<LinkedInPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPosts = async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchedPosts = await fetchLinkedInPosts(limit);
      setPosts(fetchedPosts);
    } catch (err) {
      setError('Failed to load LinkedIn posts');
      console.error('Error loading LinkedIn posts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();

    // Auto-refresh posts
    if (autoRefresh) {
      const interval = setInterval(() => {
        loadPosts();
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [limit, autoRefresh, refreshInterval]);

  if (loading && posts.length === 0) {
    return (
      <div className="w-full flex items-center justify-center py-20">
        <div className="text-white/70 text-xl">Loading company updates...</div>
      </div>
    );
  }

  if (error && posts.length === 0) {
    return (
      <div className="w-full flex items-center justify-center py-20">
        <div className="text-red-400 text-xl">{error}</div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full min-w-0">
      <div className="flex flex-col gap-4 sm:gap-6">
        {posts.map((post, index) => (
          <motion.div
            key={post.id}
            className="rounded-xl w-full max-w-full sm:w-[35vw] flex flex-col p-4 sm:p-5 bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all group box-border overflow-hidden"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
          >
            {/* Post Header */}
            <div className="flex items-center gap-3 mb-3 sm:mb-4 min-w-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                {post.author.imageUrl ? (
                  <img
                    src={post.author.imageUrl}
                    alt={post.author.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FaLinkedin className="text-white text-lg sm:text-xl" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-white font-semibold text-sm sm:text-base truncate">{post.author.name}</h4>
                <p className="text-white/60 text-xs sm:text-sm">{formatRelativeTime(post.timestamp)}</p>
              </div>
              <a
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/60 hover:text-purple-400 transition-colors flex-shrink-0 p-2 touch-manipulation"
                onClick={(e) => e.stopPropagation()}
                aria-label="Open on LinkedIn"
              >
                <FaExternalLinkAlt className="text-sm" />
              </a>
            </div>

            {/* Post Content */}
            <div className="mb-3 sm:mb-4 min-w-0">
              <p className="text-white/90 text-sm sm:text-[2vmin] leading-relaxed mb-3 sm:mb-4 line-clamp-4 break-words">
                {post.text}
              </p>

              {/* Post Image */}
              {post.imageUrl && (
                <div className="rounded-lg overflow-hidden mb-3 sm:mb-4">
                  <img
                    src={post.imageUrl}
                    alt="Post content"
                    className="w-full h-40 sm:h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
              )}
            </div>

            {/* Post Stats - stacks on mobile so "View on LinkedIn" stays inside card */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3 pt-3 border-t border-white/10">
              <div className="flex items-center gap-4 text-white/60 text-xs sm:text-sm">
                <div className="flex items-center gap-1">
                  <FaHeart className="text-red-400 flex-shrink-0" />
                  <span>{post.likes}</span>
                </div>
                <div className="flex items-center gap-1">
                  <FaComment className="flex-shrink-0" />
                  <span>{post.comments}</span>
                </div>
                <div className="flex items-center gap-1">
                  <FaShare className="flex-shrink-0" />
                  <span>{post.shares}</span>
                </div>
              </div>
              <a
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 transition-colors inline-flex items-center gap-1.5 text-xs font-medium touch-manipulation w-fit"
                onClick={(e) => e.stopPropagation()}
              >
                View on LinkedIn
                <FaExternalLinkAlt className="text-xs flex-shrink-0" />
              </a>
            </div>
          </motion.div>
        ))}
      </div>

      {/* View More Link */}
      <div className="mt-6 sm:mt-8 text-center px-2">
        <motion.a
          href="https://www.linkedin.com/company/altie-reality/mycompany/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 sm:px-6 py-3 rounded-lg bg-purple-700/20 hover:bg-purple-700/30 border border-purple-700/50 text-white text-sm sm:text-base font-medium transition-all touch-manipulation"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <FaLinkedin className="text-lg sm:text-xl flex-shrink-0" />
          <span className="truncate">View All Updates on LinkedIn</span>
          <FaExternalLinkAlt className="text-sm flex-shrink-0" />
        </motion.a>
      </div>
    </div>
  );
};

export default LinkedInActivity;
