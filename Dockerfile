FROM node:24-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --legacy-peer-deps --omit=optional

# Copy source
COPY . .

# Expose port
EXPOSE 3000

# Run dev server directly via ts-node/nest
CMD ["npx", "nest", "start", "--watch"]
