import { prisma } from './index';
import { buildExpectedProjectionRecord } from './call-projection-migration';
import { parseBatchSize } from './migration-utils';

async function main() {
    const batchSize = parseBatchSize(process.env.CALL_EVENT_BACKFILL_BATCH_SIZE);

    let cursor: string | undefined;
    let processedCalls = 0;
    let insertedEvents = 0;
    let updatedProjections = 0;

    console.log(`Starting call-event backfill with batch size ${batchSize}.`);

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
                callEvents: {
                    orderBy: { sequence: 'asc' },
                    select: { sequence: true, payload: true },
                },
            },
        });

        if (calls.length === 0) {
            break;
        }

        for (const call of calls) {
            processedCalls += 1;

            const { normalizedTurns, comparison } = buildExpectedProjectionRecord({
                status: call.status,
                tag: call.tag,
                isEmergency: call.isEmergency,
                turnsJson: call.turnsJson,
                voicemails: call.voicemails,
                followUpTasks: call.followUpTasks,
            });
            if (normalizedTurns.length > 0) {
                const result = await prisma.callEvent.createMany({
                    data: normalizedTurns.map((event) => ({
                        callId: call.id,
                        sequence: Number(event.sequence),
                        type: String(event.type),
                        domain: typeof event.domain === 'string' ? event.domain : undefined,
                        actionName: typeof event.actionName === 'string' ? event.actionName : undefined,
                        createdAt: typeof event.createdAt === 'string' ? new Date(event.createdAt) : new Date(),
                        payload: event as any,
                    })),
                    skipDuplicates: true,
                });
                insertedEvents += result.count;
            }

            await prisma.callSessionProjection.upsert({
                where: { callId: call.id },
                create: {
                    callId: call.id,
                    ...comparison,
                },
                update: {
                    ...comparison,
                },
            });
            updatedProjections += 1;
        }

        cursor = calls[calls.length - 1]?.id;
    }

    console.log(
        `Backfill complete. Processed ${processedCalls} calls, inserted ${insertedEvents} call events, updated ${updatedProjections} projections.`,
    );
}

main()
    .catch((error) => {
        console.error('Call-event backfill failed.', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
