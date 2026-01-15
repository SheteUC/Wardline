import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CallsService {
    constructor(private prisma: PrismaService) { }

    async findAllByHospital(hospitalId: string, filters?: any): Promise<any> {
        const page = parseInt(filters?.page) || 1;
        const pageSize = parseInt(filters?.pageSize) || 20;
        const skip = (page - 1) * pageSize;

        // Build where clause
        const where: any = { hospitalId };

        if (filters?.status) {
            // Convert to uppercase to match CallStatus enum
            where.status = filters.status.toUpperCase();
        }

        if (filters?.search) {
            // Search in phone number or patient name
            where.OR = [
                { phoneNumber: { twilioPhoneNumber: { contains: filters.search } } },
                { patient: { name: { contains: filters.search, mode: 'insensitive' } } },
            ];
        }

        const [calls, total] = await Promise.all([
            this.prisma.callSession.findMany({
                where,
                include: {
                    phoneNumber: true,
                    intent: true,
                    patient: {
                        select: { id: true, externalId: true, name: true },
                    },
                },
                orderBy: { startedAt: 'desc' },
                skip,
                take: pageSize,
            }),
            this.prisma.callSession.count({ where }),
        ]);

        // Transform to match frontend expectations
        const transformedCalls = calls.map((call) => ({
            id: call.id,
            hospitalId: call.hospitalId,
            twilioCallSid: call.twilioCallSid,
            direction: call.direction,
            status: call.status,
            callerPhone: call.phoneNumber.twilioPhoneNumber,
            callerName: call.patient?.name,
            duration: call.endedAt
                ? Math.floor((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000)
                : 0,
            recordingConsent: call.recordingConsent,
            wasEmergency: call.isEmergency,
            detectedIntent: call.intent?.displayName,
            sentiment: call.sentimentOverallScore
                ? (Number(call.sentimentOverallScore) >= 0.6 ? 'positive' : Number(call.sentimentOverallScore) >= 0.4 ? 'neutral' : 'negative')
                : undefined,
            sentimentScore: call.sentimentOverallScore ? Number(call.sentimentOverallScore) : undefined,
            createdAt: call.createdAt.toISOString(),
            updatedAt: call.updatedAt.toISOString(),
        }));

        return {
            data: transformedCalls,
            total,
            page,
            pageSize,
        };
    }

    async findOne(id: string): Promise<any> {
        return this.prisma.callSession.findUnique({
            where: { id },
            include: {
                phoneNumber: true,
                intent: true,
                patient: true,
                transcriptSegments: {
                    orderBy: { startTimeMs: 'asc' },
                },
                sentimentSnapshots: {
                    orderBy: { offsetMs: 'asc' },
                },
                handoffs: true,
            },
        });
    }

    async getAnalytics(hospitalId: string, startDate: Date, endDate: Date): Promise<any> {
        const calls = await this.prisma.callSession.findMany({
            where: {
                hospitalId,
                startedAt: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            select: {
                id: true,
                status: true,
                tag: true,
                isEmergency: true,
                startedAt: true,
                endedAt: true,
                sentimentOverallScore: true,
                intent: {
                    select: {
                        displayName: true,
                    },
                },
            },
        });

        const completedCalls = calls.filter((c) => c.status === 'COMPLETED');
        const abandonedCalls = calls.filter((c) => c.status === 'ABANDONED');
        const emergencyCalls = calls.filter((c) => c.isEmergency);
        const activeEmergencies = calls.filter((c) => c.isEmergency && c.status === 'ONGOING').length;

        // Calculate average duration
        const totalDuration = completedCalls.reduce((sum, call) => {
            if (!call.endedAt) return sum;
            return sum + (new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime());
        }, 0);
        const avgDurationMs = completedCalls.length > 0 ? totalDuration / completedCalls.length : 0;
        const avgDurationSeconds = Math.floor(avgDurationMs / 1000);

        // Intent breakdown
        const intentCounts: Record<string, number> = {};
        calls.forEach((call) => {
            if (call.intent?.displayName) {
                intentCounts[call.intent.displayName] = (intentCounts[call.intent.displayName] || 0) + 1;
            }
        });

        const intentBreakdown = Object.entries(intentCounts).map(([intent, count]) => ({
            intent,
            count,
            percentage: (count / calls.length) * 100,
        }));

        // Call volume by hour (just grouping by hour for simplicity)
        const hourCounts: Record<string, number> = {};
        calls.forEach((call) => {
            const hour = new Date(call.startedAt).getHours().toString().padStart(2, '0') + ':00';
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        });

        const callVolumeByHour = Object.entries(hourCounts).map(([hour, calls]) => ({
            hour,
            calls,
        }));

        // Sentiment trend (simplified - by day)
        const sentimentByDay: Record<string, { positive: number; neutral: number; negative: number }> = {};
        calls.forEach((call) => {
            if (call.sentimentOverallScore === null) return;
            const date = new Date(call.startedAt).toISOString().split('T')[0];
            if (!sentimentByDay[date]) {
                sentimentByDay[date] = { positive: 0, neutral: 0, negative: 0 };
            }

            const score = Number(call.sentimentOverallScore);
            if (score >= 0.6) sentimentByDay[date].positive++;
            else if (score >= 0.4) sentimentByDay[date].neutral++;
            else sentimentByDay[date].negative++;
        });

        const sentimentTrend = Object.entries(sentimentByDay).map(([date, counts]) => ({
            date,
            ...counts,
        }));

        return {
            totalCalls: calls.length,
            completedCalls: completedCalls.length,
            abandonedCalls: abandonedCalls.length,
            averageDuration: avgDurationSeconds,
            averageHoldTime: 0, // TODO: Implement if we track hold time
            abandonRate: calls.length > 0 ? (abandonedCalls.length / calls.length) * 100 : 0,
            emergencyFlags: emergencyCalls.length,
            activeEmergencies,
            callVolumeByHour: callVolumeByHour.sort((a, b) => a.hour.localeCompare(b.hour)),
            intentBreakdown,
            sentimentTrend: sentimentTrend.sort((a, b) => a.date.localeCompare(b.date)),
        };
    }

    /**
     * Create a new call session
     */
    async create(data: {
        hospitalId: string;
        direction: string;
        fromNumber: string;
        toNumber: string;
        twilioCallSid: string;
    }): Promise<any> {
        // Look up phone number by Twilio number
        const phoneNumber = await this.prisma.phoneNumber.findUnique({
            where: { twilioPhoneNumber: data.toNumber },
        });

        if (!phoneNumber) {
            throw new Error(`Phone number not found: ${data.toNumber}`);
        }

        return this.prisma.callSession.create({
            data: {
                hospitalId: data.hospitalId,
                phoneNumberId: phoneNumber.id,
                twilioCallSid: data.twilioCallSid,
                direction: data.direction as any,
                status: 'INITIATED',
                startedAt: new Date(),
            },
        });
    }

    /**
     * Update an existing call session
     */
    async update(id: string, data: {
        status?: string;
        duration?: number;
        recordingConsent?: string;
        detectedIntent?: string;
        isEmergency?: boolean;
        tag?: string;
    }): Promise<any> {
        const updateData: any = {};

        if (data.status) {
            updateData.status = data.status;
            // If completed or abandoned, set endedAt
            if (data.status === 'COMPLETED' || data.status === 'ABANDONED' || data.status === 'FAILED') {
                updateData.endedAt = new Date();
            }
        }

        if (data.recordingConsent) {
            updateData.recordingConsent = data.recordingConsent;
        }

        if (data.isEmergency !== undefined) {
            updateData.isEmergency = data.isEmergency;
        }

        if (data.tag) {
            updateData.tag = data.tag;
        }

        // Look up intent by key if provided
        if (data.detectedIntent) {
            const call = await this.prisma.callSession.findUnique({
                where: { id },
                select: { hospitalId: true },
            });

            if (call) {
                const intent = await this.prisma.intent.findFirst({
                    where: {
                        hospitalId: call.hospitalId,
                        key: data.detectedIntent,
                    },
                });

                if (intent) {
                    updateData.intentId = intent.id;
                }
            }
        }

        return this.prisma.callSession.update({
            where: { id },
            data: updateData,
        });
    }

    /**
     * Save transcript segments for a call
     */
    async saveTranscript(callId: string, segments: Array<{
        speaker: string;
        text: string;
        timestamp: Date;
        confidence?: number;
    }>): Promise<any> {
        // Get call start time to calculate offsets
        const call = await this.prisma.callSession.findUnique({
            where: { id: callId },
            select: { startedAt: true },
        });

        if (!call) {
            throw new Error(`Call not found: ${callId}`);
        }

        const callStart = call.startedAt.getTime();

        // Create transcript segments
        const transcriptData = segments.map((segment) => {
            const segmentTime = new Date(segment.timestamp).getTime();
            const startTimeMs = Math.max(0, segmentTime - callStart);
            // Estimate end time as start + 5 seconds or next segment
            const endTimeMs = startTimeMs + 5000;

            return {
                callId,
                speaker: segment.speaker as any,
                text: segment.text,
                startTimeMs,
                endTimeMs,
                confidence: segment.confidence ?? 0.95,
            };
        });

        return this.prisma.transcriptSegment.createMany({
            data: transcriptData,
        });
    }

    /**
     * Create a handoff record for escalation
     */
    async createHandoff(data: {
        callId: string;
        hospitalId: string;
        intentKey: string;
        tag: string;
        summary: string;
        fields: any;
    }): Promise<any> {
        // Create handoff payload
        const payload = {
            intentKey: data.intentKey,
            tag: data.tag,
            summary: data.summary,
            fields: data.fields,
            createdAt: new Date().toISOString(),
        };

        // Create handoff record
        const handoff = await this.prisma.handoff.create({
            data: {
                callId: data.callId,
                payload,
            },
        });

        // Update call with handoff info
        await this.prisma.callSession.update({
            where: { id: data.callId },
            data: {
                tag: data.tag as any,
                handoffTarget: data.intentKey,
                handoffReason: data.summary,
            },
        });

        return handoff;
    }
}
