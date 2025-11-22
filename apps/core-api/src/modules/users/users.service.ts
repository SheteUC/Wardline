import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Logger } from '@wardline/utils';
import { UserRole } from '@wardline/types';

@Injectable()
export class UsersService {
    private readonly logger = new Logger(UsersService.name);

    constructor(private prisma: PrismaService) { }

    async findOrCreateByClerkId(clerkUserId: string, email: string, fullName?: string): Promise<any> {
        let user = await this.prisma.user.findUnique({
            where: { clerkUserId },
        });

        if (!user) {
            user = await this.prisma.user.create({
                data: {
                    clerkUserId,
                    email,
                    fullName,
                },
            });
            this.logger.info('User created', { userId: user.id, clerkUserId });
        }

        return user;
    }

    async findAll(): Promise<any[]> {
        return this.prisma.user.findMany({
            include: {
                hospitals: {
                    include: {
                        hospital: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                            },
                        },
                    },
                },
            },
        });
    }

    async findOne(id: string): Promise<any> {
        const user = await this.prisma.user.findUnique({
            where: { id },
            include: {
                hospitals: {
                    include: {
                        hospital: true,
                    },
                },
            },
        });

        if (!user) {
            throw new NotFoundException(`User with ID "${id}" not found`);
        }

        return user;
    }

    async addUserToHospital(userId: string, hospitalId: string, role: UserRole): Promise<any> {
        this.logger.info('Adding user to hospital', { userId, hospitalId, role });

        return this.prisma.hospitalUser.create({
            data: {
                userId,
                hospitalId,
                role: role as any,
            },
            include: {
                user: true,
                hospital: true,
            },
        });
    }

    async updateUserRole(userId: string, hospitalId: string, role: UserRole): Promise<any> {
        this.logger.info('Updating user role', { userId, hospitalId, role });

        return this.prisma.hospitalUser.update({
            where: {
                hospitalId_userId: {
                    hospitalId,
                    userId,
                },
            },
            data: { role: role as any },
        });
    }

    async removeUserFromHospital(userId: string, hospitalId: string): Promise<any> {
        this.logger.warn('Removing user from hospital', { userId, hospitalId });

        return this.prisma.hospitalUser.delete({
            where: {
                hospitalId_userId: {
                    hospitalId,
                    userId,
                },
            },
        });
    }

    async getUsersByHospital(hospitalId: string): Promise<any[]> {
        return this.prisma.hospitalUser.findMany({
            where: { hospitalId },
            include: {
                user: true,
            },
        });
    }
}
