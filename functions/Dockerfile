# Use Node.js 22 LTS (pinned for reproducibility)
FROM node:22.11.0-slim

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 --ingroup nodejs nodejs

# Set working directory
WORKDIR /workspace

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy built application
COPY lib/ ./lib/
COPY src/ ./src/

# Set ownership
RUN chown -R nodejs:nodejs /workspace

# Set environment variable
ENV NODE_ENV=production

# Expose port (Cloud Run will set PORT env var)
EXPOSE 8080

# Run as non-root user
USER nodejs

# Start the function
CMD ["node", "lib/index.js"]

