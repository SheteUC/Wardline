import { prisma } from './index';
import { buildExpectedProjectionRecord, compareProjectionRecords } from './call-projection-migration';
import { parseBatchSize } from './migration-utils';

async function main() {
    const batchSize = parseBatchSize(process.env.CALL_PROJECTION_VERIFY_BATCH_SIZE);

    let cursor: string | undefined;
    let totalCalls = 0;
    let missingProjectionRows = 0;
    let mismatchedProjectionRows = 0;
    const firstMismatchByField = new Map<string, { callId: string; expected: unknown; actual: unknown }>();

    console.log(`Starting call-projection verification with batch size ${batchSize}.`);

    while (true) {
        const calls = await prisma.callSession.findMany({
            take: batchSize,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            orderBy: { id: 'asc' },
            select: {
                id: true,
                status: true,
                tag: true,
                isEmergency: true,
                turnsJson: true,
                voicemails: { select: { id: true, isListened: true } },
                followUpTasks: {
                    where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
                    select: { id: true, status: true, priority: true, type: true },
                },
                projection: {
                    select: {
                        lastSequenceApplied: true,
                        latestDomain: true,
                        resolution: true,
                        resolutionLabel: true,
                        operatorNextStep: true,
                        latestRuntimeAction: true,
                        handledLive: true,
                        fallbackReason: true,
                        transportSummaryJson: true,
                        intentTimelineJson: true,
                        operatorSummaryJson: true,
                    },
                },
            },
        });

        if (calls.length === 0) {
            break;
        }

        for (const call of calls) {
            totalCalls += 1;

            const { comparison } = buildExpectedProjectionRecord({
                status: call.status,
                tag: call.tag,
                isEmergency: call.isEmergency,
                turnsJson: call.turnsJson,
                voicemails: call.voicemails,
                followUpTasks: call.followUpTasks,
            });

            if (!call.projection) {
                missingProjectionRows += 1;
                continue;
            }

            const mismatches = compareProjectionRecords(call.projection, comparison);
            if (mismatches.length > 0) {
                mismatchedProjectionRows += 1;
                for (const mismatch of mismatches) {
                    if (!firstMismatchByField.has(mismatch.field)) {
                        firstMismatchByField.set(mismatch.field, {
                            callId: call.id,
                            expected: mismatch.expected,
                            actual: mismatch.actual,
                        });
                    }
                }
            }
        }

        cursor = calls[calls.length - 1]?.id;
    }

    const projectionRowCount = await prisma.callSessionProjection.count();

    console.log(`Total calls checked: ${totalCalls}`);
    console.log(`Projection rows present: ${projectionRowCount}`);
    console.log(`Missing projection rows: ${missingProjectionRows}`);
    console.log(`Mismatched projection rows: ${mismatchedProjectionRows}`);

    if (firstMismatchByField.size > 0) {
        console.log('First mismatch per field:');
        for (const [field, mismatch] of firstMismatchByField.entries()) {
            console.log(
                `${field}: callId=${mismatch.callId} expected=${JSON.stringify(mismatch.expected)} actual=${JSON.stringify(mismatch.actual)}`,
            );
        }
    }

    if (missingProjectionRows > 0 || mismatchedProjectionRows > 0) {
        process.exitCode = 1;
    }
}

main()
    .catch((error) => {
        console.error('Call-projection verification failed.', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
