import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService, CacheKeys, CacheTTL } from '../../cache/cache.service';
import { CreateHospitalDto, UpdateHospitalDto } from './dto/hospital.dto';
import { Logger } from '@wardline/utils';

@Injectable()
export class HospitalsService {
    private readonly logger = new Logger(HospitalsService.name);

    constructor(
        private prisma: PrismaService,
        private cache: CacheService,
    ) {}

    async create(createHospitalDto: CreateHospitalDto): Promise<any> {
        this.logger.info('Creating hospital', { name: createHospitalDto.name });

        // Check if hospital with same name or slug exists
        const existing = await this.prisma.hospital.findFirst({
            where: {
                OR: [
                    { name: createHospitalDto.name },
                    { slug: createHospitalDto.slug },
                ],
            },
        });

        if (existing) {
            throw new ConflictException('Hospital with this name or slug already exists');
        }

        const hospital = await this.prisma.hospital.create({
            data: {
                ...createHospitalDto,
                settings: {
                    create: {
                        // Default settings
                        recordingDefault: 'ON',
                        transcriptRetentionDays: 30,
                        e911Enabled: false,
                    },
                },
            },
            include: {
                settings: true,
            },
        });

        // Invalidate hospitals list cache
        this.cache.delete(CacheKeys.hospitals());

        this.logger.info('Hospital created', { id: hospital.id });
        return hospital;
    }

    async findAll(includeSettings = false): Promise<any[]> {
        const cacheKey = CacheKeys.hospitals();

        return this.cache.getOrSet(
            cacheKey,
            async () => {
                return this.prisma.hospital.findMany({
                    include: {
                        settings: includeSettings,
                        _count: {
                            select: {
                                users: true,
                                phoneNumbers: true,
                                callSessions: true,
                            },
                        },
                    },
                    orderBy: {
                        createdAt: 'desc',
                    },
                });
            },
            {
                ttl: CacheTTL.LONG, // 10 minutes - hospital list rarely changes
                tags: ['hospitals'],
            }
        );
    }

    async findOne(id: string, includeRelations = false): Promise<any> {
        const cacheKey = CacheKeys.hospital(id);

        return this.cache.getOrSet(
            cacheKey,
            async () => {
                const hospital = await this.prisma.hospital.findUnique({
                    where: { id },
                    include: {
                        settings: true,
                        ...(includeRelations && {
                            phoneNumbers: true,
                            users: {
                                include: {
                                    user: {
                                        select: {
                                            id: true,
                                            email: true,
                                            fullName: true,
                                        },
                                    },
                                },
                            },
                        }),
                    },
                });

                if (!hospital) {
                    throw new NotFoundException(`Hospital with ID "${id}" not found`);
                }

                return hospital;
            },
            {
                ttl: CacheTTL.LONG, // 10 minutes
                tags: ['hospitals', `hospital:${id}`],
            }
        );
    }

    async findBySlug(slug: string): Promise<any> {
        // Try to find in cache first by scanning hospital entries
        // For slug lookups, we'll do a direct DB query but cache the result
        const hospital = await this.prisma.hospital.findUnique({
            where: { slug },
            include: {
                settings: true,
            },
        });

        if (!hospital) {
            throw new NotFoundException(`Hospital with slug "${slug}" not found`);
        }

        // Cache by ID for future lookups
        this.cache.set(CacheKeys.hospital(hospital.id), hospital, {
            ttl: CacheTTL.LONG,
            tags: ['hospitals', `hospital:${hospital.id}`],
        });

        return hospital;
    }

    async update(id: string, updateHospitalDto: UpdateHospitalDto): Promise<any> {
        this.logger.info('Updating hospital', { id });

        // Check if hospital exists
        await this.findOne(id);

        // If name is being updated, check for conflicts
        if (updateHospitalDto.name) {
            const existing = await this.prisma.hospital.findFirst({
                where: {
                    name: updateHospitalDto.name,
                    NOT: { id },
                },
            });

            if (existing) {
                throw new ConflictException('Hospital with this name already exists');
            }
        }

        const hospital = await this.prisma.hospital.update({
            where: { id },
            data: updateHospitalDto as any,
            include: {
                settings: true,
            },
        });

        // Invalidate caches
        this.cache.delete(CacheKeys.hospital(id));
        this.cache.delete(CacheKeys.hospitals());

        this.logger.info('Hospital updated', { id });
        return hospital;
    }

    async remove(id: string): Promise<any> {
        this.logger.warn('Deleting hospital', { id });

        // Check if hospital exists
        await this.findOne(id);

        // Soft delete by setting status to SUSPENDED
        const hospital = await this.prisma.hospital.update({
            where: { id },
            data: { status: 'SUSPENDED' },
        });

        // Invalidate all caches for this hospital
        this.cache.invalidateByTag(`hospital:${id}`);
        this.cache.delete(CacheKeys.hospitals());

        this.logger.warn('Hospital suspended (soft delete)', { id });
        return hospital;
    }

    async updateSettings(id: string, settings: any): Promise<any> {
        this.logger.info('Updating hospital settings', { id });

        await this.findOne(id);

        const result = await this.prisma.hospitalSettings.update({
            where: { hospitalId: id },
            data: settings,
        });

        // Invalidate hospital cache
        this.cache.delete(CacheKeys.hospital(id));

        return result;
    }
}
