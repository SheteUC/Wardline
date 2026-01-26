/**
 * Script to manually apply performance indexes
 * Run with: pnpm tsx src/apply-indexes.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function applyIndexes() {
    console.log('📊 Applying performance indexes...\n');

    const indexes = [
        // Call Sessions Indexes
        {
            name: 'call_sessions_status_idx',
            sql: 'CREATE INDEX IF NOT EXISTS "call_sessions_status_idx" ON "call_sessions" ("status")',
        },
        {
            name: 'call_sessions_hospital_status_idx',
            sql: 'CREATE INDEX IF NOT EXISTS "call_sessions_hospital_status_idx" ON "call_sessions" ("hospital_id", "status")',
        },
        {
            name: 'call_sessions_is_emergency_idx',
            sql: 'CREATE INDEX IF NOT EXISTS "call_sessions_is_emergency_idx" ON "call_sessions" ("is_emergency") WHERE "is_emergency" = true',
        },
        {
            name: 'call_sessions_hospital_started_at_idx',
            sql: 'CREATE INDEX IF NOT EXISTS "call_sessions_hospital_started_at_idx" ON "call_sessions" ("hospital_id", "started_at" DESC)',
        },
        {
            name: 'call_sessions_sentiment_idx',
            sql: 'CREATE INDEX IF NOT EXISTS "call_sessions_sentiment_idx" ON "call_sessions" ("sentiment_overall_score") WHERE "sentiment_overall_score" IS NOT NULL',
        },
        // Transcript Segments Indexes
        {
            name: 'transcript_segments_call_start_time_idx',
            sql: 'CREATE INDEX IF NOT EXISTS "transcript_segments_call_start_time_idx" ON "transcript_segments" ("call_id", "start_time_ms")',
        },
        // Intents Indexes
        {
            name: 'intents_hospital_key_idx',
            sql: 'CREATE INDEX IF NOT EXISTS "intents_hospital_key_idx" ON "intents" ("hospital_id", "key")',
        },
        // Patients Indexes
        {
            name: 'patients_phone_idx',
            sql: 'CREATE INDEX IF NOT EXISTS "patients_phone_idx" ON "patients" ("primary_phone") WHERE "primary_phone" IS NOT NULL',
        },
        // Appointments Indexes
        {
            name: 'appointments_hospital_scheduled_idx',
            sql: 'CREATE INDEX IF NOT EXISTS "appointments_hospital_scheduled_idx" ON "appointments" ("hospital_id", "scheduled_at")',
        },
        // Audit Logs Indexes
        {
            name: 'audit_logs_entity_idx',
            sql: 'CREATE INDEX IF NOT EXISTS "audit_logs_entity_idx" ON "audit_logs" ("entity_type", "entity_id")',
        },
        // Phone Numbers Indexes
        {
            name: 'phone_numbers_twilio_number_idx',
            sql: 'CREATE INDEX IF NOT EXISTS "phone_numbers_twilio_number_idx" ON "phone_numbers" ("twilio_phone_number")',
        },
    ];

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    // First, enable pg_trgm extension if needed
    try {
        console.log('Enabling pg_trgm extension...');
        await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS pg_trgm');
        console.log('✅ Extension enabled\n');
    } catch (error: any) {
        if (error.message?.includes('already exists')) {
            console.log('⏭️  Extension already exists\n');
        } else {
            console.error('⚠️  Could not enable pg_trgm extension:', error.message);
            console.log('   Skipping name search index (requires pg_trgm)\n');
        }
    }

    // Apply indexes
    for (const index of indexes) {
        try {
            console.log(`Creating index: ${index.name}...`);
            await prisma.$executeRawUnsafe(index.sql);
            successCount++;
            console.log('✅ Success\n');
        } catch (error: any) {
            if (error.message?.includes('already exists')) {
                console.log('⏭️  Already exists\n');
                skipCount++;
            } else {
                console.error('❌ Error:', error.message);
                console.error('');
                errorCount++;
            }
        }
    }

    // Try to create the trigram name index
    try {
        console.log('Creating trigram index for patient names...');
        await prisma.$executeRawUnsafe(
            'CREATE INDEX IF NOT EXISTS "patients_name_idx" ON "patients" USING gin (lower("name") gin_trgm_ops) WHERE "name" IS NOT NULL'
        );
        console.log('✅ Success\n');
        successCount++;
    } catch (error: any) {
        if (error.message?.includes('already exists')) {
            console.log('⏭️  Already exists\n');
            skipCount++;
        } else if (error.message?.includes('pg_trgm')) {
            console.log('⚠️  Skipped (pg_trgm extension not available)\n');
            skipCount++;
        } else {
            console.error('❌ Error:', error.message);
            console.error('');
            errorCount++;
        }
    }

    console.log('\n📈 Summary:');
    console.log(`✅ Successfully created: ${successCount}`);
    console.log(`⏭️  Already existed: ${skipCount}`);
    if (errorCount > 0) {
        console.log(`❌ Errors: ${errorCount}`);
    }
    console.log('\n✨ Done! Your database queries should now be much faster!');

    await prisma.$disconnect();
}

applyIndexes()
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
