# Backup and Restore Runbook

Owner: database operator. Production restore requires incident-commander approval and a maintenance window.

## Backup

Prefer Supabase point-in-time recovery when enabled. For a portable encrypted custom-format backup:

```bash
umask 077
pg_dump --format=custom --no-owner --no-acl \
  --file="indyfren-staging-$(date -u +%Y%m%dT%H%M%SZ).dump" \
  "$STAGING_DATABASE_URL"
```

Store the dump in the approved encrypted backup location and record its checksum; do not attach it to a ticket.

## Restore exercise

Create an isolated empty staging-restore database, never a production target:

```bash
createdb "$RESTORE_DATABASE_NAME"
pg_restore --exit-on-error --no-owner --no-acl \
  --dbname="$RESTORE_DATABASE_URL" "$BACKUP_FILE"
psql "$RESTORE_DATABASE_URL" --set=ON_ERROR_STOP=1 \
  --command="select schemaname, relname, n_live_tup from pg_stat_user_tables order by relname;"
DATABASE_URL="$RESTORE_DATABASE_URL" npm run db:migrate:check
```

Compare table names and aggregate row counts only; never copy user rows into evidence. Run a read-only health check against an application instance pointed at the restored database. Destroy the isolated restore database after evidence is approved.

## Required exercise record

Record backup start/end UTC, restore start/end UTC, source/target environment identifiers, encrypted artifact checksum, schema migration ledger, per-table aggregate counts before/after, verification result, operator, reviewer, and cleanup timestamp. Public beta and GA remain blocked until a current staging exercise record is attached to the release.

If restore verification fails, preserve the failed isolated target for investigation, do not promote, and create a fresh backup before retrying.
