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
    <div className="w-full">
      <div className="flex flex-col gap-6">
        {posts.map((post, index) => (
          <motion.div
            key={post.id}
            className="rounded-lg w-[35vw] flex flex-col p-4 bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all group"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
          >
            {/* Post Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center overflow-hidden">
                {post.author.imageUrl ? (
                  <img
                    src={post.author.imageUrl}
                    alt={post.author.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FaLinkedin className="text-white text-xl" />
                )}
              </div>
              <div className="flex-1">
                <h4 className="text-white font-semibold">{post.author.name}</h4>
                <p className="text-white/60 text-sm">{formatRelativeTime(post.timestamp)}</p>
              </div>
              <a
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/60 hover:text-purple-400 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <FaExternalLinkAlt className="text-sm" />
              </a>
            </div>

            {/* Post Content */}
            <div className="mb-4">
              <p className="text-white/90 text-[2vmin] leading-relaxed mb-4 line-clamp-4">
                {post.text}
              </p>

              {/* Post Image */}
              {post.imageUrl && (
                <div className="rounded-lg overflow-hidden mb-4">
                  <img
                    src={post.imageUrl}
                    alt="Post content"
                    className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
              )}
            </div>

            {/* Post Stats */}
            <div className="flex items-center justify-between text-white/60 text-sm pt-3 border-t border-white/10">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <FaHeart className="text-red-400" />
                  <span>{post.likes}</span>
                </div>
                <div className="flex items-center gap-1">
                  <FaComment />
                  <span>{post.comments}</span>
                </div>
                <div className="flex items-center gap-1">
                  <FaShare />
                  <span>{post.shares}</span>
                </div>
              </div>
              <a
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1 text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                View on LinkedIn
                <FaExternalLinkAlt className="text-xs" />
              </a>
            </div>
          </motion.div>
        ))}
      </div>

      {/* View More Link */}
      <div className="mt-8 text-center">
        <motion.a
          href="https://www.linkedin.com/company/altie-reality/mycompany/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-purple-700/20 hover:bg-purple-700/30 border border-purple-700/50 text-white font-medium transition-all"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <FaLinkedin className="text-xl" />
          View All Updates on LinkedIn
          <FaExternalLinkAlt className="text-sm" />
        </motion.a>
      </div>
    </div>
  );
};

export default LinkedInActivity;
