import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CallIngestDto } from './calls.dto';

describe('CallIngestDto', () => {
    it('accepts rich runtime event payloads without rejecting nested metadata', async () => {
        const dto = plainToInstance(CallIngestDto, {
            sessionId: 'session-1',
            events: [
                {
                    sequence: 1,
                    type: 'runtime_action_outcome',
                    actionName: 'manual-follow-up',
                    domain: 'handoff',
                    handledLive: false,
                    fallbackReason: 'manual_follow_up',
                    operatorSummary: 'Staff follow-up requested',
                    requiresFollowUp: true,
                    data: {
                        followUpTaskId: 'task-1',
                        integration: {
                            category: 'MANUAL',
                            vendor: 'wardline',
                        },
                    },
                    createdAt: '2026-04-03T20:52:01.000Z',
                },
            ],
            transcriptSegments: [
                {
                    speaker: 'CALLER',
                    text: 'Hello',
                    timestamp: '2026-04-03T20:52:01.000Z',
                    startTimeMs: 0,
                    endTimeMs: 1200,
                },
            ],
            statePatch: {
                status: 'ONGOING',
                isEmergency: false,
                turnCount: 1,
            },
        });

        const errors = await validate(dto, {
            whitelist: true,
            forbidNonWhitelisted: true,
        });

        expect(errors).toHaveLength(0);
    });
});
