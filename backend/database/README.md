# MySQL and Prisma

MySQL 8.4 LTS is the canonical database for normal backend startup. Prisma ORM 6 remains in use because the backend is CommonJS; this database cutover does not redesign authentication or domain behavior.

## Local setup

Docker Compose provides the reproducible development database. A hosted MySQL 8.x instance can also be used by setting `DATABASE_URL`.

### Initial Docker development setup

1. Copy `.env.docker.example` to the repository-root `.env`, replace `MYSQL_PASSWORD` and `MYSQL_ROOT_PASSWORD`, and keep the resulting file uncommitted.
2. Choose the host port with `MYSQL_HOST_PORT`. The example uses `3307`; the container always listens on MySQL's internal port `3306`.
3. Copy `backend/.env.example` to `backend/.env`. Configure `DATABASE_URL` for `kucur` and `TEST_DATABASE_URL` for the distinct `kucur_test`. Both URLs must use the host port selected by `MYSQL_HOST_PORT`; application code must not assume either `3306` or `3307`.
4. Install backend packages with `npm install`.
5. Run `npm run db:start`. On first volume initialization, Compose creates `kucur` and the guarded `kucur_test` database.
6. Wait for `npm run db:status` to report the MySQL container as healthy.
7. Run `npm run prisma:generate`, `npm run db:migrate`, and `npm run db:seed`.
8. Start the backend with `npm run dev` or `npm start`.

The development URLs have this shape; substitute the local password and configured host port:

```dotenv
DATABASE_URL=mysql://kucur:PASSWORD@127.0.0.1:3307/kucur
TEST_DATABASE_URL=mysql://kucur:PASSWORD@127.0.0.1:3307/kucur_test
```

Do not commit real credentials or reuse development credentials in production.

### Normal subsequent startup

Start MySQL with `npm run db:start`, verify its health, and then start the backend. Re-running `npm run db:migrate` applies only committed pending MySQL migrations. Normal startup never resets or seeds a database automatically.

### Dedicated test database

Run `npm run test:integration` with `TEST_DATABASE_URL` configured. The cross-platform Node runner:

1. parses the URL and accepts only MySQL URLs whose database name ends in `_test`;
2. exposes the test URL as `DATABASE_URL` only to child integration commands;
3. invokes the local Prisma CLI through Node and applies committed migrations;
4. runs the idempotent development seed twice;
5. executes the real MySQL integration suite and propagates its exit code.

The runner preserves inherited stdio and reports spawn failures explicitly. It does not use `npx.cmd`, Unix-only shell syntax, or the normal development database.

`GET /health/live` reports whether the process is alive. `GET /health/ready` verifies Prisma can access MySQL. Startup must fail clearly when `DATABASE_URL` is absent or MySQL is unreachable; there is no in-memory runtime fallback.

## Migration history

Active migrations under `prisma/migrations` target MySQL only. The original PostgreSQL migrations are retained under `prisma/migrations_postgresql_archive` for historical reference and must never be executed by the active MySQL migration workflow.

After intentionally changing `prisma/schema.prisma`, use `npm run db:migrate:dev -- --name descriptive_name` against the development MySQL database, then review the generated SQL before committing it.

`prisma migrate reset` destroys data. It is development-only and must never be automated or run against a shared, staging, or production database.

## Seed and tests

The seed is idempotent and recreates the established QA users, roles and role relations, Stores, Platform Settings, and Product/Variant fixtures. Passwords remain hashed using the application's existing scrypt implementation.

Unit/API authorization tests may inject the isolated memory repository. Normal backend startup never uses it. Integration tests use the real `kucur_test` MySQL database and enforce the `_test` suffix before migrations or cleanup.

No browser localStorage data is imported by this infrastructure migration.
