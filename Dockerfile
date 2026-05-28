# Production Dockerfile
FROM node:20-alpine AS runner

# Set environment
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app

# Copy dependency lists
COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy source files
COPY src/ ./src/

# Expose port (default Express port)
EXPOSE 3000

# Start the application
CMD ["node", "src/server.js"]