import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type PrismaClient as PrismaClientInstance } from '@wardline/db';
import { Logger } from '@wardline/utils';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PrismaService.name);
    declare readonly business: PrismaClientInstance['business'];
    declare readonly businessSettings: PrismaClientInstance['businessSettings'];
    declare readonly businessIntegration: PrismaClientInstance['businessIntegration'];
    declare readonly user: PrismaClientInstance['user'];
    declare readonly businessUser: PrismaClientInstance['businessUser'];
    declare readonly phoneNumber: PrismaClientInstance['phoneNumber'];
    declare readonly workflow: PrismaClientInstance['workflow'];
    declare readonly workflowVersion: PrismaClientInstance['workflowVersion'];
    declare readonly agent: PrismaClientInstance['agent'];
    declare readonly callSession: PrismaClientInstance['callSession'];
    declare readonly transcriptSegment: PrismaClientInstance['transcriptSegment'];
    declare readonly voicemailRecord: PrismaClientInstance['voicemailRecord'];
    declare readonly auditLog: PrismaClientInstance['auditLog'];

    constructor() {
        const adapter = new PrismaPg({
            connectionString: process.env.DATABASE_URL ?? '',
        });
        super({
            adapter,
            log: [
                { level: 'query', emit: 'event' },
                { level: 'error', emit: 'event' },
                { level: 'warn', emit: 'event' },
            ],
        });

        // Log queries in development
        if (process.env.NODE_ENV === 'development') {
            this.$on('query' as never, (e: any) => {
                this.logger.debug(`Query: ${e.query}`, { duration: e.duration });
            });
        }

        // Log errors
        this.$on('error' as never, (e: any) => {
            this.logger.error('Prisma error', e);
        });
    }

    async onModuleInit() {
        try {
            await this.$connect();
            this.logger.info('✅ Database connection established');
        } catch (error) {
            this.logger.error('❌ Database connection failed', error);
            throw error;
        }
    }

    async onModuleDestroy() {
        await this.$disconnect();
        this.logger.info('Database connection closed');
    }

    /**
     * Clean database (for tests)
     */
    async cleanDatabase() {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('Cannot clean database in production');
        }

        const models = Reflect.ownKeys(this).filter(
            (key) => key[0] !== '_' && key !== 'constructor',
        );

        return Promise.all(
            models.map((modelKey) => {
                const model = this[modelKey as keyof this];
                if (typeof model === 'object' && model !== null && 'deleteMany' in model) {
                    return (model as any).deleteMany();
                }
            }),
        );
    }
}
