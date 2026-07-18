FROM rust:1.92-slim AS builder

WORKDIR /app
COPY . .

RUN cargo build --release

FROM debian:bookworm-slim AS runtime

WORKDIR /app

COPY --from=builder /app/target/release/server .

CMD ["./server"]