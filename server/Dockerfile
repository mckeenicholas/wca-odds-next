FROM rust:1.92-slim AS builder

ARG ENABLE_CACHE=true
ARG ENABLE_GOVERNOR=true

WORKDIR /app
COPY . .

RUN FEATURES=""; \
    if [ "$ENABLE_CACHE" = "true" ]; then FEATURES="$FEATURES enable_cache"; fi; \
    if [ "$ENABLE_GOVERNOR" = "true" ]; then FEATURES="$FEATURES enable_governor"; fi; \
    cargo build --release --no-default-features --features "${FEATURES# }";

FROM debian:bookworm-slim AS runtime

WORKDIR /app

COPY --from=builder /app/target/release/server .

CMD ["./server"]