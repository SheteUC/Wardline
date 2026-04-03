# Database Backup and Restore Runbook

This runbook is the operational baseline for Wardline PostgreSQL environments. Use it before schema changes, before major releases, and during incident recovery.

## Ownership and cadence

- Owner: platform/on-call engineer responsible for the environment
- Production cadence: daily automated backups plus a pre-release on-demand backup before database migrations
- Staging cadence: daily automated backups or a fresh snapshot before destructive test runs
- Storage location: provider-managed encrypted snapshot storage plus a restricted-access export bucket when manual dumps are required

## Backup procedure

1. Confirm the target environment and capture the database identifier, region, and retention policy in the deployment ticket.
2. Verify the database is healthy and replication/storage alarms are clear before taking the backup.
3. Create a provider snapshot for the environment.
4. For pre-migration or pre-cutover changes, also create a logical export:
   ```bash
   pg_dump --format=custom --no-owner --file wardline-prechange.dump "$DATABASE_URL"
   ```
5. Record the snapshot ID or dump artifact location, creation timestamp, operator, and reason in the change record.
6. Verify backup encryption and access controls before closing the step.

## Restore procedure

1. Pause writes to the target environment or take the application out of service.
2. Restore the provider snapshot into a new database instance when possible. Do not overwrite the source database until verification is complete.
3. If a logical dump is the only recovery path, restore into a clean database:
   ```bash
   pg_restore --clean --if-exists --no-owner --dbname "$RESTORE_DATABASE_URL" wardline-prechange.dump
   ```
4. Point the application at the restored database only after verification succeeds.
5. Keep the failed database instance available until incident review is complete unless there is an explicit data-exposure reason to remove it.

## Post-restore verification

Run all of the following before reopening traffic:

1. Confirm Prisma connectivity and schema health:
   ```bash
   pnpm --filter @wardline/db generate
   pnpm --filter @wardline/db exec prisma migrate status
   ```
2. Verify core read paths:
   ```bash
   pnpm test:smoke:db
   pnpm --filter @wardline/core-api test -- --runInBand health.controller.spec.ts
   ```
3. Validate a few high-value tables manually: businesses, calls, workflow versions, integrations, follow-up tasks, and audit logs.
4. Confirm application health endpoints return success after the restored environment is wired back in.
5. Document restore source, verification evidence, and any data-loss window in the incident ticket.

## When to use this runbook

- Before `prisma migrate deploy` in staging or production
- Before bulk backfills or data repair scripts
- During failed migration recovery
- During provider-region or infrastructure cutover testing
