# Use Node.js 22 runtime
FROM node:22-slim

# Set working directory
WORKDIR /workspace

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy built application
COPY lib/ ./lib/
COPY src/ ./src/

# Set environment variable
ENV NODE_ENV=production

# Expose port (Cloud Run will set PORT env var)
EXPOSE 8080

# Start the function
CMD ["node", "lib/index.js"]

