# Archived PostgreSQL migrations

These migrations are retained as historical reference only. They contain
PostgreSQL-specific SQL and must not be applied to MySQL.

The active Prisma migration history is `../migrations`, beginning with the
clean MySQL baseline `20260826000000_mysql_baseline`.

Development data is recreated by the idempotent Prisma seed; this archive is
not a cross-database data migration mechanism.
