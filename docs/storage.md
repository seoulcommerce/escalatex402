# Escalatex — Storage Strategy

## Goals

- **OSS reference implementation** should be easy to run: single binary/service, minimal dependencies.
- **Hosted/scale deployments** should have a clean path to a real database.

## OSS default: SQLite

The self-hosted reference implementation uses **SQLite** by default.

Pros:
- zero setup
- perfect for a single-provider inbox
- portable (single file)

Considerations:
- concurrency is limited vs Postgres
- backups/replication are manual

## Hosted recommendation: Postgres (planned)

For hosted deployments (many providers / high traffic), we will add a Postgres backend.

Planned approach:
- abstract storage behind a thin data access layer
- provide migrations for both SQLite and Postgres
- document a migration path from SQLite to Postgres

## Environment variables

- `DB_PATH` — SQLite file path (default: `./data.db`)
- (planned) `DATABASE_URL` — Postgres connection string

## Backups

SQLite:
- stop the process briefly and copy `data.db`, or use SQLite online backup.

Postgres:
- use standard pg_dump backups.
