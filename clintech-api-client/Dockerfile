# Build stage
FROM golang:1.24.2-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . ./

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main cmd/api/main.go

# Final stage
FROM debian:bullseye-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates tzdata curl imagemagick \
  && rm -rf /var/lib/apt/lists/*



# Update ImageMagick security policy to allow PDF processing
RUN sed -i 's/<policy domain="coder" rights="none" pattern="PDF" \/>/<policy domain="coder" rights="read|write" pattern="PDF" \/>/' /etc/ImageMagick-6/policy.xml

WORKDIR /app

# Copy the binary from builder stage
COPY --from=builder /app/main .

# Copy templates and static files
COPY --from=builder /app/internal/utils/pdf/templates ./internal/utils/pdf/templates
COPY --from=builder /app/internal/utils/pdf/covers ./internal/utils/pdf/covers

# SQL migrations are executed at runtime by database.RunMigrations()
COPY --from=builder /app/internal/database/*.sql ./internal/database/

# Copy logo file
COPY --from=builder /app/logo-word.jpeg ./logo-word.jpeg

# Create uploads directory
RUN mkdir -p uploads/pdfs uploads/temp

# Expose port
EXPOSE 8080

# Run the application
CMD ["./main"]
