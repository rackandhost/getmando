# Dockerfile for Dashboard App v2.1
# Multi-stage build for optimized image size and YAML volume support

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application for production
RUN npm run build -- --configuration production

# Production stage
FROM nginx:alpine

# Install basic tools for debugging
RUN apk add --no-cache curl

# Create directory for mounted config
RUN mkdir -p /app/config

# Copy built assets from builder
COPY --from=builder /app/dist/getmando/browser /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Ensure proper permissions
RUN chmod -R 755 /usr/share/nginx/html && \
    chmod -R 755 /app/config

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
