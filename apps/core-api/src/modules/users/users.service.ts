import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Logger } from '@wardline/utils';
import { UserRole } from '@wardline/types';

@Injectable()
export class UsersService {
    private readonly logger = new Logger(UsersService.name);

    constructor(private prisma: PrismaService) { }

    async findOrCreateByClerkId(clerkUserId: string, email: string, fullName?: string): Promise<any> {
        const user = await this.prisma.user.upsert({
            where: { clerkUserId },
            update: {
                email,
                fullName,
            },
            create: {
                clerkUserId,
                email,
                fullName,
            },
        });

        this.logger.info('User synced from Clerk', { userId: user.id, clerkUserId });
        return user;
    }

    async findAll(): Promise<any[]> {
        return this.prisma.user.findMany({
            include: {
                businesses: {
                    include: {
                        business: {
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
                businesses: {
                    include: {
                        business: true,
                    },
                },
            },
        });

        if (!user) {
            throw new NotFoundException(`User with ID "${id}" not found`);
        }

        return user;
    }

    async addUserToBusiness(userId: string, businessId: string, role: UserRole): Promise<any> {
        this.logger.info('Adding user to business', { userId, businessId, role });

        return this.prisma.businessUser.create({
            data: {
                userId,
                businessId,
                role: role as any,
            },
            include: {
                user: true,
                business: true,
            },
        });
    }

    async updateUserRole(userId: string, businessId: string, role: UserRole): Promise<any> {
        this.logger.info('Updating user role', { userId, businessId, role });

        return this.prisma.businessUser.update({
            where: {
                businessId_userId: {
                    businessId,
                    userId,
                },
            },
            data: { role: role as any },
        });
    }

    async removeUserFromBusiness(userId: string, businessId: string): Promise<any> {
        this.logger.warn('Removing user from business', { userId, businessId });

        return this.prisma.businessUser.delete({
            where: {
                businessId_userId: {
                    businessId,
                    userId,
                },
            },
        });
    }

    async getUsersByBusiness(businessId: string): Promise<any[]> {
        return this.prisma.businessUser.findMany({
            where: { businessId },
            include: {
                user: true,
            },
        });
    }
}
