# Build stage
FROM golang:1.23-alpine AS builder

# Install build essentials for CGO (required by sqlite3)
RUN apk add --no-cache gcc musl-dev

WORKDIR /app

# Copy dependency files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Synchronize dependencies and update go.sum
RUN go mod tidy

# Build the application with CGO enabled
RUN CGO_ENABLED=1 GOOS=linux go build -o munify-gateway main.go

# Run stage
FROM alpine:latest

# Basic dependencies for running
RUN apk add --no-cache ca-certificates texlive-full

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/munify-gateway .
# Copy migrations
COPY --from=builder /app/migrations ./migrations

# Create data directory for SQLite
RUN mkdir -p /app/data

# Environment defaults
ENV PORT=8080
ENV DB_PATH=/app/data/munify.db

EXPOSE 8080

CMD ["./munify-gateway"]
