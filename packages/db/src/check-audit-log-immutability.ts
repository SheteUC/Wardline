import './load-env';
import { randomUUID } from 'crypto';
import { Client } from 'pg';

function requireDatabaseUrl() {
    const databaseUrl = process.env.DATABASE_URL?.trim();
    if (!databaseUrl) {
        throw new Error('DATABASE_URL is required to verify AuditLog immutability');
    }
    return databaseUrl;
}

async function expectImmutableFailure(
    client: Client,
    operation: 'update' | 'delete',
    statement: string,
    values: unknown[],
) {
    const savepoint = `audit_log_${operation}_immutability`;
    const unexpectedSuccessMessage = `Expected audit log ${operation} to fail`;

    await client.query(`SAVEPOINT ${savepoint}`);

    try {
        await client.query(statement, values);
        throw new Error(unexpectedSuccessMessage);
    } catch (error: any) {
        if (error?.message === unexpectedSuccessMessage) {
            throw error;
        }

        if (error?.code !== '55000') {
            throw new Error(
                `Unexpected audit log ${operation} failure: ${error?.message ?? String(error)}`,
            );
        }
    } finally {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        await client.query(`RELEASE SAVEPOINT ${savepoint}`);
    }
}

async function main() {
    const client = new Client({ connectionString: requireDatabaseUrl() });
    await client.connect();

    const businessId = randomUUID();
    const auditLogId = randomUUID();
    const suffix = businessId.slice(0, 8);
    const updatedAt = new Date();
    const createdAt = new Date();

    try {
        await client.query('BEGIN');
        await client.query(
            `
            INSERT INTO "businesses" ("id", "name", "slug", "updated_at")
            VALUES ($1, $2, $3, $4)
            `,
            [
                businessId,
                `Audit Log Check ${suffix}`,
                `audit-log-check-${suffix}`,
                updatedAt,
            ],
        );
        await client.query(
            `
            INSERT INTO "audit_logs" ("id", "business_id", "action", "entity_type", "created_at")
            VALUES ($1, $2, $3, $4, $5)
            `,
            [auditLogId, businessId, 'TEST_CREATE', 'audit_log', createdAt],
        );

        await expectImmutableFailure(
            client,
            'update',
            `UPDATE "audit_logs" SET "action" = $2 WHERE "id" = $1`,
            [auditLogId, 'TAMPERED'],
        );
        await expectImmutableFailure(
            client,
            'delete',
            `DELETE FROM "audit_logs" WHERE "id" = $1`,
            [auditLogId],
        );

        console.log('Audit log immutability check passed.');
    } finally {
        await client.query('ROLLBACK').catch(() => undefined);
        await client.end();
    }
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
