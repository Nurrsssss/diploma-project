## Quick orientation for coding agents

This file contains concise, actionable guidance to help an AI coding agent be productive in this repository.

- Project layout: code lives under `internal/`. Key folders:
  - `internal/router` — HTTP routing and middleware (`routes.go`). See how handlers and services are wired.
  - `internal/handlers` — HTTP handlers that translate requests to service calls.
  - `internal/services` — business logic; constructed in `routes.SetupRouter` and called by handlers.
  - `internal/repository` — DB access; uses `sqlx` and a package-level `db` variable. Functions expect `context.Context`.
  - `internal/openai` — custom OpenAI client with rich helpers; optional (returns error when OPENAI_API_KEY is empty).
  - `internal/client` — HTTP clients for external services (identity, patient, files, appointment, doctor).
  - `internal/config` — `Load()` reads configuration from environment variables. Prefer reading env names here (DB_*, OPENAI_*, PORT, etc.).

## Big picture architecture

- Entry point: `cmd/api/main.go`. It calls `config.Load()`, `database.InitDB(cfg)`, `database.RunMigrations()` and `routes.SetupRouter(cfg)` then runs Gin.
- Router wiring: `internal/router/routes.go` constructs external clients, optional OpenAI client, services and handlers, then registers routes and middleware groups (unauthenticated, authGroup, doctorGroup).
- Data flow: HTTP -> handler -> service -> repository / external client / openai -> DB / external service.

## Conventions & important patterns (project-specific)

- Environment-driven config: Use `internal/config.Load()` and env var names there. Example: `OPENAI_API_KEY`, `DB_HOST`, `PORT`.
- Optional OpenAI: `openai.NewClient(&cfg.OpenAI)` returns an error if API key is missing — code handles `openaiClient == nil`. When adding AI features, check for nil before calling.
- Repositories use a global `db *sqlx.DB`. Ensure `database.InitDB(cfg)` ran before calling repository functions (this is done in `main.go`).
- SQL style: Postgres placeholders (`$1`) and ON CONFLICT upserts are used (see `internal/repository/answers.go`). When adding queries, follow that style.
- Services return domain types and accept `context.Context` (follow `AnswersService` and others). Keep validation and domain logic in `internal/services` and SQL in `internal/repository`.

## Integration points & external dependencies

- External microservices: identity, patient, file server, appointment, doctor — configured via `internal/config.ExternalService*` and created in `routes.SetupRouter` (see `client.NewIdentityClient(...)`).
- OpenAI: custom client at `internal/openai`. Calls use JSON REST to OpenAI endpoints; respect rate/timeouts defined there and avoid blocking the Gin main thread (use context properly).
- Database: Postgres via `github.com/jackc/pgx`/`sqlx`. Migrations are invoked via `database.RunMigrations()` in `main.go`.
- Static uploads served at `/uploads` (see router static registration).

## Developer workflows & commands (what actually runs)

- Run locally (development): from repo root

  ```pwsh
  go run ./cmd/api
  ```

- Build binary:

  ```pwsh
  go build ./cmd/api
  ```

- Env vars to set when running locally (examples):
  - `PORT` (default 8080)
  - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
  - `OPENAI_API_KEY` (optional; if missing OpenAI features disabled)

- DB init & migrations are invoked automatically by `main.go` (`database.InitDB(cfg)` and `database.RunMigrations()`). If you change repository schema, update migration scripts and ensure `RunMigrations()` handles new scripts.

## Editing & adding endpoints

- Add new routes in `internal/router/routes.go`. Create a handler in `internal/handlers`, a service in `internal/services` (business logic), and repository functions in `internal/repository` (DB). Follow existing pattern: constructor in `services`, handler method uses a service instance.
- Use middleware groups for auth/roles (see `middleware.AuthMiddleware` and `middleware.RequireRole("doctor")`). Pass the appropriate external client(s) to middleware when wiring.

## Quick examples to reference

- Route wiring sample: see `internal/router/routes.go` — e.g., how `answersService` and `answersHandler` are registered for `/patients/:patient_id/questionnaire` GET and PUT.
- Config/Env: see `internal/config/config.go` for default env var names and fallbacks.
- OpenAI: see `internal/openai/client.go` for request structure and error handling; `builder.go` exposes template execution.
- DB upsert pattern: `internal/repository/answers.go` shows dynamic batched upsert with `ON CONFLICT`.

## Safety & practical notes for agents

- Do not assume OpenAI is available — always check for nil `openaiClient` or propagate errors the service expects.
- Keep DB changes minimal and follow existing migration approach; repository code expects Postgres-style placeholders and types.
- Prefer small, focused changes that include tests or at least a local smoke run via `go run ./cmd/api` where practical.

If anything here is unclear or you'd like more details (example tests, migration tooling, or DB conventions), tell me which section to expand and I'll iterate.
