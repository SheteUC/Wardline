import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CallsService {
    constructor(private prisma: PrismaService) { }

    async findAllByHospital(hospitalId: string, filters?: any): Promise<any[]> {
        return this.prisma.callSession.findMany({
            where: {
                hospitalId,
                ...filters,
            },
            include: {
                phoneNumber: true,
                intent: true,
                patient: {
                    select: { id: true, externalId: true, name: true },
                },
            },
            orderBy: { startedAt: 'desc' },
            take: 100,
        });
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
            },
        });

        return {
            totalCalls: calls.length,
            emergencyCalls: calls.filter((c) => c.isEmergency).length,
            byTag: calls.reduce((acc, call) => {
                if (!call.tag) return acc;
                acc[call.tag] = (acc[call.tag] || 0) + 1;
                return acc;
            }, {} as Record<string, number>),
            avgSentiment:
                calls.reduce((sum, c) => sum + Number(c.sentimentOverallScore || 0), 0) / calls.length,
        };
    }
}
