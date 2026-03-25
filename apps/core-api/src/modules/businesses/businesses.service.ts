import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService, CacheTTL } from '../../cache/cache.service';
import { Logger } from '@wardline/utils';
import { WorkflowsService } from '../workflows/workflows.service';
import { DEFAULT_OPERATING_HOURS, normalizeOperatingHours } from './business-hours';

const CacheKeys = {
    businesses: (userId?: string) => `businesses:list:${userId ?? 'all'}`,
    business: (id: string) => `businesses:${id}`,
    runtimeConfig: (id: string) => `businesses:${id}:runtime-config`,
};

@Injectable()
export class BusinessesService {
    private readonly logger = new Logger(BusinessesService.name);

    constructor(
        private prisma: PrismaService,
        private cache: CacheService,
        private workflowsService: WorkflowsService,
    ) {}

    async create(dto: { name: string; slug: string; timeZone?: string }, creatorUserId?: string): Promise<any> {
        this.logger.info('Creating business', { name: dto.name });

        const existing = await this.prisma.business.findFirst({
            where: { OR: [{ name: dto.name }, { slug: dto.slug }] },
        });

        if (existing) {
            throw new ConflictException('Business with this name or slug already exists');
        }

        const business = await this.prisma.$transaction(async (tx) => {
            const createdBusiness = await tx.business.create({
                data: {
                    ...dto,
                    settings: {
                        create: {
                            recordingDefault: 'ON',
                            transcriptRetentionDays: 30,
                            operatingHours: DEFAULT_OPERATING_HOURS as any,
                            outOfScopeKeywords: [],
                            emergencyKeywords: [],
                        },
                    },
                    ...(creatorUserId
                        ? {
                            users: {
                                create: {
                                    userId: creatorUserId,
                                    role: 'OWNER',
                                },
                            },
                        }
                        : {}),
                },
                include: { settings: true },
            });

            return createdBusiness;
        });

        await this.cache.invalidateByTag('businesses');
        if (creatorUserId) {
            await this.cache.invalidateByTag(`user:${creatorUserId}:businesses`);
        }
        this.logger.info('Business created', { id: business.id });
        return business;
    }

    async findAll(includeSettings = false, userId?: string, businessIds?: string[]): Promise<any[]> {
        if (businessIds && businessIds.length === 0) {
            return [];
        }

        const cacheKey = `${CacheKeys.businesses(userId)}:${includeSettings}`;

        return this.cache.getOrSet(
            cacheKey,
            async () =>
                this.prisma.business.findMany({
                    ...(businessIds
                        ? {
                            where: {
                                id: { in: businessIds },
                            },
                        }
                        : userId
                        ? {
                            where: {
                                users: {
                                    some: { userId },
                                },
                            },
                        }
                        : {}),
                    include: {
                        settings: includeSettings,
                        _count: {
                            select: { users: true, phoneNumbers: true, callSessions: true, agents: true },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                }),
            {
                ttl: CacheTTL.LONG,
                tags: ['businesses', ...(userId ? [`user:${userId}:businesses`] : [])],
            },
        );
    }

    async findOne(id: string, includeRelations = false): Promise<any> {
        return this.cache.getOrSet(
            `${CacheKeys.business(id)}:${includeRelations}`,
            async () => {
                const business = await this.prisma.business.findUnique({
                    where: { id },
                    include: {
                        settings: true,
                        ...(includeRelations && { phoneNumbers: true, agents: true }),
                    },
                });
                if (!business) throw new NotFoundException(`Business "${id}" not found`);
                if (business.settings) {
                    business.settings.operatingHours = normalizeOperatingHours(business.settings.operatingHours) as any;
                }
                return business;
            },
            { ttl: CacheTTL.LONG, tags: ['businesses', `business:${id}`] },
        );
    }

    async findBySlug(slug: string): Promise<any> {
        const business = await this.prisma.business.findUnique({
            where: { slug },
            include: { settings: true },
        });
        if (!business) throw new NotFoundException(`Business with slug "${slug}" not found`);
        await this.cache.set(CacheKeys.business(business.id), business, {
            ttl: CacheTTL.LONG,
            tags: ['businesses', `business:${business.id}`],
        });
        return business;
    }

    async findByPhone(phoneNumber: string): Promise<any> {
        const normalized = phoneNumber.replace(/\D/g, '');
        const phoneNumbers = await this.prisma.phoneNumber.findMany({
            include: {
                business: {
                    include: {
                        settings: true,
                        phoneNumbers: true,
                    },
                },
            },
        });

        const match = phoneNumbers.find((entry) => {
            const candidate = entry.twilioPhoneNumber.replace(/\D/g, '');
            return candidate.endsWith(normalized) || normalized.endsWith(candidate);
        });

        if (!match) throw new NotFoundException(`Business with phone "${phoneNumber}" not found`);
        if (match.business.settings) {
            match.business.settings.operatingHours = normalizeOperatingHours(match.business.settings.operatingHours) as any;
        }
        return match.business;
    }

    async update(id: string, dto: Partial<{ name: string; slug: string; timeZone: string }>): Promise<any> {
        await this.findOne(id);

        if (dto.name) {
            const existing = await this.prisma.business.findFirst({
                where: { name: dto.name, NOT: { id } },
            });
            if (existing) throw new ConflictException('Business with this name already exists');
        }

        const business = await this.prisma.business.update({
            where: { id },
            data: dto as any,
            include: { settings: true },
        });

        await this.cache.delete(`${CacheKeys.business(id)}:true`);
        await this.cache.delete(`${CacheKeys.business(id)}:false`);
        await this.cache.invalidateByTag('businesses');
        await this.cache.delete(CacheKeys.runtimeConfig(id));
        return business;
    }

    async updateSettings(id: string, settings: Partial<{
        recordingDefault: string;
        transcriptRetentionDays: number;
        operatingHours: unknown;
        outOfScopeKeywords: string[];
        emergencyKeywords: string[];
    }>): Promise<any> {
        await this.findOne(id);
        const normalizedSettings = {
            ...settings,
            ...(settings.operatingHours !== undefined
                ? { operatingHours: normalizeOperatingHours(settings.operatingHours) as any }
                : {}),
        };
        const result = await this.prisma.businessSettings.update({
            where: { businessId: id },
            data: normalizedSettings as any,
        });
        result.operatingHours = normalizeOperatingHours(result.operatingHours) as any;
        await this.cache.delete(`${CacheKeys.business(id)}:true`);
        await this.cache.delete(`${CacheKeys.business(id)}:false`);
        await this.cache.delete(CacheKeys.runtimeConfig(id));
        return result;
    }

    async getRuntimeConfig(id: string): Promise<any> {
        return this.cache.getOrSet(
            CacheKeys.runtimeConfig(id),
            async () => {
                const business = await this.prisma.business.findUnique({
                    where: { id },
                    include: {
                        settings: true,
                        phoneNumbers: {
                            select: {
                                id: true,
                                label: true,
                                twilioPhoneNumber: true,
                            },
                        },
                        integrations: {
                            select: {
                                id: true,
                                category: true,
                                vendor: true,
                                status: true,
                                capabilities: true,
                                lastHealthCheckAt: true,
                            },
                            orderBy: { category: 'asc' },
                        },
                    },
                });
                if (!business) throw new NotFoundException(`Business "${id}" not found`);

                const activeWorkflow = await this.workflowsService.getActiveWorkflow(id);
                const operatingHours = normalizeOperatingHours(business.settings?.operatingHours);

                return {
                    business: {
                        id: business.id,
                        name: business.name,
                        slug: business.slug,
                        timeZone: business.timeZone,
                        status: business.status,
                    },
                    settings: business.settings
                        ? {
                            ...business.settings,
                            operatingHours,
                        }
                        : {
                            recordingDefault: 'ON',
                            transcriptRetentionDays: 30,
                            operatingHours,
                            outOfScopeKeywords: [],
                            emergencyKeywords: [],
                        },
                    phoneNumbers: business.phoneNumbers,
                    integrations: business.integrations,
                    connectedIntegrationCategories: business.integrations
                        .filter((integration) => integration.status === 'CONNECTED')
                        .map((integration) => integration.category),
                    activeWorkflow,
                };
            },
            { ttl: CacheTTL.MEDIUM, tags: ['businesses', `business:${id}`, 'runtime-config'] },
        );
    }

    async suspend(id: string): Promise<any> {
        await this.findOne(id);
        const business = await this.prisma.business.update({
            where: { id },
            data: { status: 'SUSPENDED' },
        });
        await this.cache.invalidateByTag(`business:${id}`);
        await this.cache.invalidateByTag('businesses');
        await this.cache.delete(CacheKeys.runtimeConfig(id));
        return business;
    }
}
