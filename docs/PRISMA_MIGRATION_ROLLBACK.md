# Prisma Migration Rollback Procedure

Prisma migrations are forward-only by default. Wardline rollback is therefore a controlled recovery procedure, not an automatic down migration.

## Default policy

- Always take a backup before `prisma migrate deploy`
- Treat production rollback as restore-based unless there is a reviewed hotfix migration that is safer than restore
- Never edit an already-applied migration in place

## Standard recovery flow

1. Stop or drain application writes.
2. Capture the failure state:
   - deployment ID
   - migration name
   - `prisma migrate status` output
   - database snapshot ID or dump artifact
3. Decide whether the failed migration changed data or only schema metadata.
4. If the safest path is restore:
   - follow [Database Backup and Restore Runbook](./OPERATIONS_BACKUP_RESTORE.md)
   - restore the last known-good snapshot into a clean database
   - verify before repointing the app

## `prisma migrate resolve` usage

Use `prisma migrate resolve` only to reconcile migration bookkeeping after you understand the real database state.

- Mark as rolled back:
  ```bash
  pnpm --filter @wardline/db exec prisma migrate resolve --rolled-back "<migration_name>"
  ```
- Mark as applied:
  ```bash
  pnpm --filter @wardline/db exec prisma migrate resolve --applied "<migration_name>"
  ```

Do not use `resolve` as a substitute for actual schema recovery.

## Partial-apply incident procedure

1. Freeze writes and prevent a second deploy from racing the first incident.
2. Inspect whether tables, indexes, constraints, or data changes landed partially.
3. If the state is ambiguous, restore from backup instead of trying to hand-edit production schema.
4. If the state is unambiguous and safe to repair, apply a reviewed corrective migration rather than mutating the failed migration directory.
5. Re-run:
   ```bash
   pnpm --filter @wardline/db exec prisma migrate status
   ```
6. Record the final resolution in the incident and deployment logs.

## Acceptance before reopening traffic

- The database matches the intended schema state
- `prisma migrate status` is clean
- Core API smoke checks pass
- The restore or repair path is documented in the incident record
