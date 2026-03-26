import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService, CacheTTL } from '../../cache/cache.service';
import { Logger } from '@wardline/utils';
import { WorkflowsService } from '../workflows/workflows.service';
import { DEFAULT_OPERATING_HOURS, normalizeOperatingHours } from './business-hours';
import { normalizePracticeSetup } from './practice-config';

const CacheKeys = {
    businesses: (userId?: string) => `businesses:list:${userId ?? 'all'}`,
    business: (id: string) => `businesses:${id}`,
    runtimeConfig: (id: string) => `businesses:${id}:runtime-config`,
    phoneLookup: (normalizedPhone: string) => `businesses:by-phone:${normalizedPhone}`,
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
        const practiceSetup = normalizePracticeSetup();

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
                            enabledActions: practiceSetup.enabledActions,
                            afterHoursPolicy: practiceSetup.afterHoursPolicy as any,
                            refillPolicy: practiceSetup.refillPolicy as any,
                            billingPolicy: practiceSetup.billingPolicy as any,
                            insurancePolicy: practiceSetup.insurancePolicy as any,
                            knowledgeConfig: practiceSetup.knowledgeConfig as any,
                            escalationConfig: practiceSetup.escalationConfig as any,
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
        await this.workflowsService.syncPracticeSetupWorkflow(business.id, creatorUserId);
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
                    business.settings = this.normalizeBusinessSettingsRecord(business.settings);
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
        if (business.settings) {
            business.settings = this.normalizeBusinessSettingsRecord(business.settings);
        }
        await this.cache.set(CacheKeys.business(business.id), business, {
            ttl: CacheTTL.LONG,
            tags: ['businesses', `business:${business.id}`],
        });
        return business;
    }

    async findByPhone(phoneNumber: string): Promise<any> {
        const normalized = phoneNumber.replace(/\D/g, '');
        const cacheKey = CacheKeys.phoneLookup(normalized.slice(-10) || normalized);

        return this.cache.getOrSet(
            cacheKey,
            async () => {
                const last10 = normalized.slice(-10);
                const candidates = Array.from(
                    new Set(
                        [
                            phoneNumber.trim(),
                            normalized,
                            last10,
                            last10 ? `+1${last10}` : null,
                            last10 ? `1${last10}` : null,
                        ].filter((value): value is string => Boolean(value)),
                    ),
                );

                const phoneNumbers = await this.prisma.phoneNumber.findMany({
                    where: {
                        OR: candidates.flatMap((candidate) => [
                            { twilioPhoneNumber: candidate },
                            { twilioPhoneNumber: { endsWith: candidate } },
                        ]),
                    },
                    include: {
                        business: {
                            include: {
                                settings: true,
                                phoneNumbers: true,
                            },
                        },
                    },
                    take: 10,
                });

                const match = phoneNumbers.find((entry) => {
                    const candidate = entry.twilioPhoneNumber.replace(/\D/g, '');
                    return candidate.endsWith(last10 || normalized) || normalized.endsWith(candidate);
                }) ?? phoneNumbers[0];

                if (!match) throw new NotFoundException(`Business with phone "${phoneNumber}" not found`);
                if (match.business.settings) {
                    match.business.settings = this.normalizeBusinessSettingsRecord(match.business.settings);
                }

                this.logger.debug('Resolved business by phone', {
                    phone: normalized.slice(-4),
                    businessId: match.business.id,
                });

                return match.business;
            },
            { ttl: CacheTTL.MEDIUM, tags: ['businesses'] },
        );
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
        await this.workflowsService.syncPracticeSetupWorkflow(id);
        return business;
    }

    async updateSettings(id: string, settings: Partial<{
        recordingDefault: string;
        transcriptRetentionDays: number;
        operatingHours: unknown;
        enabledActions: unknown;
        afterHoursPolicy: unknown;
        refillPolicy: unknown;
        billingPolicy: unknown;
        insurancePolicy: unknown;
        knowledgeConfig: unknown;
        escalationConfig: unknown;
        outOfScopeKeywords: string[];
        emergencyKeywords: string[];
    }>): Promise<any> {
        const business = await this.findOne(id);
        const currentSettings = business.settings ?? this.getDefaultBusinessSettings();
        const nextPracticeSetup = normalizePracticeSetup({
            enabledActions:
                settings.enabledActions !== undefined ? settings.enabledActions : currentSettings.enabledActions,
            afterHoursPolicy:
                settings.afterHoursPolicy !== undefined ? settings.afterHoursPolicy : currentSettings.afterHoursPolicy,
            refillPolicy: settings.refillPolicy !== undefined ? settings.refillPolicy : currentSettings.refillPolicy,
            billingPolicy:
                settings.billingPolicy !== undefined ? settings.billingPolicy : currentSettings.billingPolicy,
            insurancePolicy:
                settings.insurancePolicy !== undefined ? settings.insurancePolicy : currentSettings.insurancePolicy,
            knowledgeConfig:
                settings.knowledgeConfig !== undefined ? settings.knowledgeConfig : currentSettings.knowledgeConfig,
            escalationConfig:
                settings.escalationConfig !== undefined
                    ? settings.escalationConfig
                    : currentSettings.escalationConfig,
        });
        const normalizedSettings = {
            ...settings,
            ...(settings.operatingHours !== undefined
                ? { operatingHours: normalizeOperatingHours(settings.operatingHours) as any }
                : {}),
            enabledActions: nextPracticeSetup.enabledActions,
            afterHoursPolicy: nextPracticeSetup.afterHoursPolicy as any,
            refillPolicy: nextPracticeSetup.refillPolicy as any,
            billingPolicy: nextPracticeSetup.billingPolicy as any,
            insurancePolicy: nextPracticeSetup.insurancePolicy as any,
            knowledgeConfig: nextPracticeSetup.knowledgeConfig as any,
            escalationConfig: nextPracticeSetup.escalationConfig as any,
        };
        const result = await this.prisma.businessSettings.update({
            where: { businessId: id },
            data: normalizedSettings as any,
        });
        await this.workflowsService.syncPracticeSetupWorkflow(id);
        Object.assign(result, this.normalizeBusinessSettingsRecord(result));
        await this.cache.delete(`${CacheKeys.business(id)}:true`);
        await this.cache.delete(`${CacheKeys.business(id)}:false`);
        await this.cache.delete(CacheKeys.runtimeConfig(id));
        return result;
    }

    async getRuntimeConfig(id: string): Promise<any> {
        const startedAt = Date.now();
        const runtimeConfig = await this.cache.getOrSet(
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
                const normalizedSettings = business.settings
                    ? this.normalizeBusinessSettingsRecord(business.settings)
                    : this.getDefaultBusinessSettings();

                return {
                    business: {
                        id: business.id,
                        name: business.name,
                        slug: business.slug,
                        timeZone: business.timeZone,
                        status: business.status,
                    },
                    settings: normalizedSettings,
                    phoneNumbers: business.phoneNumbers,
                    integrations: business.integrations,
                    connectedIntegrationCategories: business.integrations
                        .filter((integration) => integration.status === 'CONNECTED')
                        .map((integration) => integration.category),
                    activeWorkflow,
                };
            },
            {
                ttl: CacheTTL.MEDIUM,
                tags: ['businesses', `business:${id}`, 'runtime-config'],
            },
        );
        this.logger.debug('Loaded runtime config', {
            businessId: id,
            durationMs: Date.now() - startedAt,
        });
        return runtimeConfig;
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

    private getDefaultBusinessSettings() {
        const practiceSetup = normalizePracticeSetup();

        return {
            recordingDefault: 'ON',
            transcriptRetentionDays: 30,
            operatingHours: DEFAULT_OPERATING_HOURS,
            enabledActions: practiceSetup.enabledActions,
            afterHoursPolicy: practiceSetup.afterHoursPolicy,
            refillPolicy: practiceSetup.refillPolicy,
            billingPolicy: practiceSetup.billingPolicy,
            insurancePolicy: practiceSetup.insurancePolicy,
            knowledgeConfig: practiceSetup.knowledgeConfig,
            escalationConfig: practiceSetup.escalationConfig,
            outOfScopeKeywords: [] as string[],
            emergencyKeywords: [] as string[],
        };
    }

    private normalizeBusinessSettingsRecord(settings: any) {
        const practiceSetup = normalizePracticeSetup(settings);

        return {
            ...settings,
            operatingHours: normalizeOperatingHours(settings.operatingHours) as any,
            enabledActions: practiceSetup.enabledActions,
            afterHoursPolicy: practiceSetup.afterHoursPolicy,
            refillPolicy: practiceSetup.refillPolicy,
            billingPolicy: practiceSetup.billingPolicy,
            insurancePolicy: practiceSetup.insurancePolicy,
            knowledgeConfig: practiceSetup.knowledgeConfig,
            escalationConfig: practiceSetup.escalationConfig,
        };
    }
}
