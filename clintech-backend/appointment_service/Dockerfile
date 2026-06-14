FROM golang:1.25-alpine AS builder
WORKDIR /go/src/github.com/printprince/vitalem

COPY . .

ENV GOPATH=/go
ENV GOPROXY=https://proxy.golang.org,direct
ENV GOSUMDB=sum.golang.org

RUN cd appointment_service && go mod download

RUN cd appointment_service && CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o appointment_service ./cmd/api/main.go

FROM alpine:latest

RUN apk --no-cache add ca-certificates tzdata wget curl postgresql-client

WORKDIR /app

COPY --from=builder /go/src/github.com/printprince/vitalem/appointment_service/appointment_service .
COPY --from=builder /go/src/github.com/printprince/vitalem/appointment_service/config.yaml .
COPY --from=builder /go/src/github.com/printprince/vitalem/appointment_service/migrations/ ./migrations/

EXPOSE 8805

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8805/health || exit 1

CMD ["./appointment_service"]