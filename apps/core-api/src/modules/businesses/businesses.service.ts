import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService, CacheTTL } from '../../cache/cache.service';
import { Logger } from '@wardline/utils';

const CacheKeys = {
    businesses: () => 'businesses:list',
    business: (id: string) => `businesses:${id}`,
};

@Injectable()
export class BusinessesService {
    private readonly logger = new Logger(BusinessesService.name);

    constructor(
        private prisma: PrismaService,
        private cache: CacheService,
    ) {}

    async create(dto: { name: string; slug: string; timeZone?: string }): Promise<any> {
        this.logger.info('Creating business', { name: dto.name });

        const existing = await this.prisma.business.findFirst({
            where: { OR: [{ name: dto.name }, { slug: dto.slug }] },
        });

        if (existing) {
            throw new ConflictException('Business with this name or slug already exists');
        }

        const business = await this.prisma.business.create({
            data: {
                ...dto,
                settings: {
                    create: {
                        recordingDefault: 'ON',
                        transcriptRetentionDays: 30,
                        outOfScopeKeywords: [],
                        emergencyKeywords: [],
                    },
                },
            },
            include: { settings: true },
        });

        await this.cache.delete(CacheKeys.businesses());
        this.logger.info('Business created', { id: business.id });
        return business;
    }

    async findAll(includeSettings = false): Promise<any[]> {
        const cacheKey = `${CacheKeys.businesses()}:${includeSettings}`;

        return this.cache.getOrSet(
            cacheKey,
            async () =>
                this.prisma.business.findMany({
                    include: {
                        settings: includeSettings,
                        _count: {
                            select: { users: true, phoneNumbers: true, callSessions: true, agents: true },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                }),
            { ttl: CacheTTL.LONG, tags: ['businesses'] },
        );
    }

    async findOne(id: string, includeRelations = false): Promise<any> {
        return this.cache.getOrSet(
            CacheKeys.business(id),
            async () => {
                const business = await this.prisma.business.findUnique({
                    where: { id },
                    include: {
                        settings: true,
                        ...(includeRelations && { phoneNumbers: true, agents: true }),
                    },
                });
                if (!business) throw new NotFoundException(`Business "${id}" not found`);
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

        await this.cache.delete(CacheKeys.business(id));
        await this.cache.delete(CacheKeys.businesses());
        return business;
    }

    async updateSettings(id: string, settings: Partial<{
        recordingDefault: string;
        transcriptRetentionDays: number;
        outOfScopeKeywords: string[];
        emergencyKeywords: string[];
    }>): Promise<any> {
        await this.findOne(id);
        const result = await this.prisma.businessSettings.update({
            where: { businessId: id },
            data: settings as any,
        });
        await this.cache.delete(CacheKeys.business(id));
        return result;
    }

    async suspend(id: string): Promise<any> {
        await this.findOne(id);
        const business = await this.prisma.business.update({
            where: { id },
            data: { status: 'SUSPENDED' },
        });
        await this.cache.invalidateByTag(`business:${id}`);
        await this.cache.delete(CacheKeys.businesses());
        return business;
    }
}
