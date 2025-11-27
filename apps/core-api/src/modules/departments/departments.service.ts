import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
    CreateDepartmentDto,
    UpdateDepartmentDto,
    CreateDirectoryInquiryDto,
    UpdateDirectoryInquiryDto,
} from './dto/department.dto';
import { Logger } from '@wardline/utils';

@Injectable()
export class DepartmentsService {
    private readonly logger = new Logger(DepartmentsService.name);

    constructor(private prisma: PrismaService) { }

    // Department CRUD operations
    async createDepartment(createDepartmentDto: CreateDepartmentDto) {
        this.logger.info('Creating department', { name: createDepartmentDto.name });

        const department = await this.prisma.department.create({
            data: createDepartmentDto,
        });

        this.logger.info('Department created', { id: department.id });
        return department;
    }

    async findAllDepartments(hospitalId: string, includeInactive = false) {
        return this.prisma.department.findMany({
            where: {
                hospitalId,
                ...(includeInactive ? {} : { isActive: true }),
            },
            orderBy: { name: 'asc' },
        });
    }

    async findDepartmentById(id: string) {
        const department = await this.prisma.department.findUnique({
            where: { id },
            include: {
                _count: {
                    select: { directoryInquiries: true },
                },
            },
        });

        if (!department) {
            throw new NotFoundException(`Department with ID "${id}" not found`);
        }

        return department;
    }

    async findDepartmentsByServiceType(hospitalId: string, serviceType: string) {
        return this.prisma.department.findMany({
            where: {
                hospitalId,
                isActive: true,
                serviceTypes: { has: serviceType },
            },
            orderBy: { name: 'asc' },
        });
    }

    async searchDepartments(hospitalId: string, query: string) {
        return this.prisma.department.findMany({
            where: {
                hospitalId,
                isActive: true,
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { description: { contains: query, mode: 'insensitive' } },
                    { serviceTypes: { hasSome: [query] } },
                ],
            },
            orderBy: { name: 'asc' },
        });
    }

    async updateDepartment(id: string, updateDepartmentDto: UpdateDepartmentDto) {
        this.logger.info('Updating department', { id });

        await this.findDepartmentById(id);

        const department = await this.prisma.department.update({
            where: { id },
            data: updateDepartmentDto,
        });

        this.logger.info('Department updated', { id });
        return department;
    }

    async deleteDepartment(id: string) {
        this.logger.warn('Soft deleting department', { id });

        await this.findDepartmentById(id);

        const department = await this.prisma.department.update({
            where: { id },
            data: { isActive: false },
        });

        this.logger.warn('Department deactivated', { id });
        return department;
    }

    // Directory Inquiry operations
    async createDirectoryInquiry(createDirectoryInquiryDto: CreateDirectoryInquiryDto) {
        this.logger.info('Creating directory inquiry', { serviceType: createDirectoryInquiryDto.serviceType });

        // Auto-route to department if service type matches
        let departmentId = createDirectoryInquiryDto.departmentId;
        if (!departmentId && createDirectoryInquiryDto.serviceType) {
            const departments = await this.findDepartmentsByServiceType(
                createDirectoryInquiryDto.hospitalId,
                createDirectoryInquiryDto.serviceType
            );
            if (departments.length === 1) {
                departmentId = departments[0].id;
            }
        }

        const inquiry = await this.prisma.directoryInquiry.create({
            data: {
                ...createDirectoryInquiryDto,
                departmentId,
            },
            include: {
                department: true,
            },
        });

        this.logger.info('Directory inquiry created', { id: inquiry.id });
        return inquiry;
    }

    async findAllDirectoryInquiries(
        hospitalId: string,
        options?: {
            resolved?: boolean;
            departmentId?: string;
            limit?: number;
            offset?: number;
        }
    ) {
        const { resolved, departmentId, limit = 50, offset = 0 } = options || {};

        const [data, total] = await Promise.all([
            this.prisma.directoryInquiry.findMany({
                where: {
                    hospitalId,
                    ...(resolved !== undefined ? { resolved } : {}),
                    ...(departmentId ? { departmentId } : {}),
                },
                include: {
                    department: true,
                    call: {
                        select: { id: true, twilioCallSid: true, startedAt: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset,
            }),
            this.prisma.directoryInquiry.count({
                where: {
                    hospitalId,
                    ...(resolved !== undefined ? { resolved } : {}),
                    ...(departmentId ? { departmentId } : {}),
                },
            }),
        ]);

        return { data, total, limit, offset };
    }

    async updateDirectoryInquiry(id: string, updateDirectoryInquiryDto: UpdateDirectoryInquiryDto) {
        this.logger.info('Updating directory inquiry', { id });

        const inquiry = await this.prisma.directoryInquiry.update({
            where: { id },
            data: updateDirectoryInquiryDto,
            include: {
                department: true,
            },
        });

        this.logger.info('Directory inquiry updated', { id });
        return inquiry;
    }

    // Analytics
    async getDirectoryStats(hospitalId: string, startDate?: Date, endDate?: Date) {
        const dateFilter = {
            ...(startDate && endDate
                ? { createdAt: { gte: startDate, lte: endDate } }
                : {}),
        };

        const [totalInquiries, resolvedCount, byServiceType, byDepartment] = await Promise.all([
            this.prisma.directoryInquiry.count({
                where: { hospitalId, ...dateFilter },
            }),
            this.prisma.directoryInquiry.count({
                where: { hospitalId, resolved: true, ...dateFilter },
            }),
            this.prisma.directoryInquiry.groupBy({
                by: ['serviceType'],
                where: { hospitalId, ...dateFilter },
                _count: { serviceType: true },
                orderBy: { _count: { serviceType: 'desc' } },
            }),
            this.prisma.directoryInquiry.groupBy({
                by: ['departmentId'],
                where: { hospitalId, ...dateFilter },
                _count: { departmentId: true },
            }),
        ]);

        return {
            totalInquiries,
            resolvedCount,
            unresolvedCount: totalInquiries - resolvedCount,
            resolutionRate: totalInquiries > 0 ? (resolvedCount / totalInquiries) * 100 : 0,
            byServiceType: byServiceType.map((s) => ({
                serviceType: s.serviceType,
                count: s._count.serviceType,
            })),
            byDepartment,
        };
    }
}

