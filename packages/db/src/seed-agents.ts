import { prisma } from './index';
import { AGENT_CATALOG } from './agent-catalog';

/**
 * Seed the 5 starter agents for a given business.
 * Call this during new-business onboarding.
 */
export async function seedAgentsForBusiness(businessId: string): Promise<void> {
    for (const catalog of AGENT_CATALOG) {
        const existing = await prisma.agent.findFirst({
            where: { businessId, catalogId: catalog.catalogId },
        });

        if (!existing) {
            await prisma.agent.create({
                data: {
                    businessId,
                    catalogId: catalog.catalogId,
                    name: catalog.name,
                    description: catalog.description,
                    status: 'ACTIVE',
                    nodeGraph: catalog.defaultNodeGraph as any,
                    toolConfig: {},
                    agentConfig: {
                        scopeBoundary: catalog.scopeBoundary,
                        icon: catalog.icon,
                        color: catalog.color,
                        tags: catalog.tags,
                        toolConfigSchema: catalog.toolConfigSchema,
                    },
                },
            });
        }
    }
}

/**
 * Standalone seed script — seeds agents for every business found.
 */
async function main() {
    console.log('Seeding clinic starter agents...');

    const businesses = await prisma.business.findMany({ select: { id: true, name: true } });

    if (businesses.length === 0) {
        console.log('No businesses found. Create a business first.');
        return;
    }

    for (const business of businesses) {
        console.log(`  Seeding agents for: ${business.name}`);
        await seedAgentsForBusiness(business.id);
    }

    console.log(`Done. Seeded ${AGENT_CATALOG.length} agents per business.`);
}

if (require.main === module) {
    main()
        .catch(console.error)
        .finally(() => prisma.$disconnect());
}
