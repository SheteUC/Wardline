import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateHospitalDto, UpdateHospitalDto } from './dto/hospital.dto';
import { Logger } from '@wardline/utils';

@Injectable()
export class HospitalsService {
    private readonly logger = new Logger(HospitalsService.name);

    constructor(private prisma: PrismaService) { }

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

        this.logger.info('Hospital created', { id: hospital.id });
        return hospital;
    }

    async findAll(includeSettings = false): Promise<any[]> {
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
    }

    async findOne(id: string, includeRelations = false): Promise<any> {
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
    }

    async findBySlug(slug: string): Promise<any> {
        const hospital = await this.prisma.hospital.findUnique({
            where: { slug },
            include: {
                settings: true,
            },
        });

        if (!hospital) {
            throw new NotFoundException(`Hospital with slug "${slug}" not found`);
        }

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

        this.logger.warn('Hospital suspended (soft delete)', { id });
        return hospital;
    }

    async updateSettings(id: string, settings: any): Promise<any> {
        this.logger.info('Updating hospital settings', { id });

        await this.findOne(id);

        return this.prisma.hospitalSettings.update({
            where: { hospitalId: id },
            data: settings,
        });
    }
}
