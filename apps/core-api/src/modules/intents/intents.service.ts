import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class IntentsService {
    constructor(private prisma: PrismaService) { }

    async create(hospitalId: string, data: any): Promise<any> {
        return this.prisma.intent.create({
            data: {
                ...data,
                hospitalId,
            },
        });
    }

    async findAllByHospital(hospitalId: string): Promise<any[]> {
        return this.prisma.intent.findMany({
            where: { hospitalId },
            orderBy: { displayName: 'asc' },
        });
    }

    async findOne(id: string): Promise<any> {
        const intent = await this.prisma.intent.findUnique({ where: { id } });
        if (!intent) throw new NotFoundException(`Intent with ID "${id}" not found`);
        return intent;
    }

    async update(id: string, data: any): Promise<any> {
        await this.findOne(id);
        return this.prisma.intent.update({ where: { id }, data });
    }

    async remove(id: string): Promise<any> {
        await this.findOne(id);
        return this.prisma.intent.delete({ where: { id } });
    }
}
