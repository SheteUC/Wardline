import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuditService', () => {
    let service: AuditService;
    let prisma: PrismaService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuditService,
                {
                    provide: PrismaService,
                    useValue: {
                        auditLog: {
                            create: jest.fn(),
                            createMany: jest.fn(),
                            findMany: jest.fn(),
                        },
                    },
                },
            ],
        }).compile();

        service = module.get<AuditService>(AuditService);
        prisma = module.get<PrismaService>(PrismaService);
    });

    describe('logAction', () => {
        it('should create an audit log entry', async () => {
            const params = {
                hospitalId: 'hospital-123',
                userId: 'user-123',
                action: 'CREATE',
                entityType: 'user',
                entityId: 'entity-123',
                metadata: { test: 'data' },
            };

            (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

            await service.logAction(params);

            expect(prisma.auditLog.create).toHaveBeenCalledWith({
                data: params,
            });
        });

        it('should not throw when audit log creation fails', async () => {
            const params = {
                hospitalId: 'hospital-123',
                action: 'CREATE',
                entityType: 'user',
            };

            (prisma.auditLog.create as jest.Mock).mockRejectedValue(new Error('DB error'));

            await expect(service.logAction(params)).resolves.not.toThrow();
        });
    });

    describe('logBatch', () => {
        it('should create multiple audit log entries', async () => {
            const entries = [
                {
                    hospitalId: 'hospital-123',
                    action: 'CREATE',
                    entityType: 'user',
                },
                {
                    hospitalId: 'hospital-123',
                    action: 'UPDATE',
                    entityType: 'workflow',
                },
            ];

            (prisma.auditLog.createMany as jest.Mock).mockResolvedValue({});

            await service.logBatch(entries);

            expect(prisma.auditLog.createMany).toHaveBeenCalledWith({
                data: expect.arrayContaining([
                    expect.objectContaining({ action: 'CREATE' }),
                    expect.objectContaining({ action: 'UPDATE' }),
                ]),
            });
        });
    });

    describe('getAuditLogs', () => {
        it('should query audit logs with filters', async () => {
            const mockLogs = [{ id: '1', action: 'CREATE' }];
            (prisma.auditLog.findMany as jest.Mock).mockResolvedValue(mockLogs);

            const result = await service.getAuditLogs('hospital-123', {
                userId: 'user-123',
                entityType: 'workflow',
                limit: 50,
            });

            expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
                where: {
                    hospitalId: 'hospital-123',
                    userId: 'user-123',
                    entityType: 'workflow',
                },
                orderBy: { createdAt: 'desc' },
                take: 50,
                skip: 0,
            });
            expect(result).toEqual(mockLogs);
        });

        it('should handle date range filters', async () => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-12-31');

            (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);

            await service.getAuditLogs('hospital-123', { startDate, endDate });

            expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
                where: {
                    hospitalId: 'hospital-123',
                    createdAt: {
                        gte: startDate,
                        lte: endDate,
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: 100,
                skip: 0,
            });
        });
    });
});
