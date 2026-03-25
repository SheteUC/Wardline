import { prisma, UserRole } from './index';
import { seedAgentsForBusiness } from './seed-agents';

const DEFAULT_MOCK_BASE_URL = process.env.MOCK_INTEGRATION_BASE_URL || 'http://127.0.0.1:4010';
const DEFAULT_CREDENTIAL_REF = process.env.MOCK_CREDENTIALS_REF || 'MOCK_ATHENAHEALTH_TOKEN';
const DEFAULT_BUSINESS_NAME = process.env.SMOKE_BUSINESS_NAME || 'Smoke Family Medicine';
const DEFAULT_BUSINESS_SLUG = process.env.SMOKE_BUSINESS_SLUG || 'smoke-family-medicine';
const DEFAULT_PHONE_NUMBER = process.env.SMOKE_PHONE_NUMBER || '+15551230001';
const DEFAULT_TWILIO_SID = process.env.SMOKE_TWILIO_SID || 'PN_SMOKE_0001';
const DEFAULT_CLERK_USER_ID = process.env.SMOKE_CLERK_USER_ID || 'user_smoke_owner';
const DEFAULT_USER_EMAIL = process.env.SMOKE_USER_EMAIL || 'smoke.owner@wardline.local';
const DEFAULT_USER_NAME = process.env.SMOKE_USER_NAME || 'Smoke Owner';

const ALWAYS_OPEN_HOURS = Array.from({ length: 7 }, (_, index) => ({
    dayOfWeek: index,
    isClosed: false,
    startTime: '00:00',
    endTime: '23:59',
}));

async function ensureOwnerUser() {
    return prisma.user.upsert({
        where: { clerkUserId: DEFAULT_CLERK_USER_ID },
        update: {
            email: DEFAULT_USER_EMAIL,
            fullName: DEFAULT_USER_NAME,
        },
        create: {
            clerkUserId: DEFAULT_CLERK_USER_ID,
            email: DEFAULT_USER_EMAIL,
            fullName: DEFAULT_USER_NAME,
        },
    });
}

async function ensureBusiness() {
    return prisma.business.upsert({
        where: { slug: DEFAULT_BUSINESS_SLUG },
        update: {
            name: DEFAULT_BUSINESS_NAME,
            timeZone: 'America/New_York',
            status: 'ACTIVE',
        },
        create: {
            name: DEFAULT_BUSINESS_NAME,
            slug: DEFAULT_BUSINESS_SLUG,
            timeZone: 'America/New_York',
            status: 'ACTIVE',
        },
    });
}

function buildIntegrationSettings(category: 'SCHEDULING' | 'EHR_REFILL' | 'BILLING' | 'INSURANCE') {
    const base = {
        baseUrl: DEFAULT_MOCK_BASE_URL,
        healthPath: '/scenario/success/metadata',
        timeoutMs: 3500,
        practiceId: 'smoke-practice',
        departmentId: 'family-medicine',
        endpoints: {
            health: '/scenario/success/metadata',
            appointmentRequest: '/scenario/success/appointments/request',
            refillRequest: '/scenario/success/medication-refills',
            insuranceCheck: '/scenario/success/coverage/check',
            billingRequest: '/scenario/success/billing/cases',
        },
    };

    switch (category) {
        case 'SCHEDULING':
            return {
                ...base,
                endpoints: {
                    ...base.endpoints,
                    appointmentRequest: '/scenario/success/appointments/request',
                },
            };
        case 'EHR_REFILL':
            return {
                ...base,
                endpoints: {
                    ...base.endpoints,
                    refillRequest: '/scenario/success/medication-refills',
                },
            };
        case 'INSURANCE':
            return {
                ...base,
                endpoints: {
                    ...base.endpoints,
                    insuranceCheck: '/scenario/success/coverage/check',
                },
            };
        case 'BILLING':
            return {
                ...base,
                endpoints: {
                    ...base.endpoints,
                    billingRequest: '/scenario/success/billing/cases',
                },
            };
        default:
            return base;
    }
}

function createSmokeWorkflowGraph() {
    return {
        nodes: [
            {
                id: 'start',
                type: 'start',
                position: { x: 0, y: 0 },
                config: { label: 'Start' },
            },
            {
                id: 'capture-follow-up',
                type: 'integration',
                position: { x: 220, y: 0 },
                config: {
                    label: 'Manual Follow-up',
                    mode: 'runtime_action',
                    runtimeAction: 'manual-follow-up',
                    integrationCategory: 'MANUAL',
                    requiresConfirmation: false,
                    fallbackBehavior: 'create_follow_up',
                    prompt: 'Capture a smoke-test staff follow-up request.',
                },
            },
            {
                id: 'end',
                type: 'end',
                position: { x: 440, y: 0 },
                config: {
                    endType: 'hangup',
                    closingMessage: 'Your request has been captured.',
                },
            },
        ],
        edges: [
            { id: 'edge-start-follow-up', fromNodeId: 'start', toNodeId: 'capture-follow-up' },
            { id: 'edge-follow-up-end', fromNodeId: 'capture-follow-up', toNodeId: 'end' },
        ],
    };
}

async function main() {
    console.log('Creating Business-native smoke fixture...');

    const owner = await ensureOwnerUser();
    const business = await ensureBusiness();

    await prisma.businessUser.upsert({
        where: {
            businessId_userId: {
                businessId: business.id,
                userId: owner.id,
            },
        },
        update: {
            role: UserRole.OWNER,
        },
        create: {
            businessId: business.id,
            userId: owner.id,
            role: UserRole.OWNER,
        },
    });

    await prisma.businessSettings.upsert({
        where: { businessId: business.id },
        update: {
            recordingDefault: 'ASK',
            transcriptRetentionDays: 7,
            operatingHours: ALWAYS_OPEN_HOURS as any,
            emergencyKeywords: ['chest pain', "can't breathe", 'stroke'],
            outOfScopeKeywords: ['legal advice', 'diagnosis'],
        },
        create: {
            businessId: business.id,
            recordingDefault: 'ASK',
            transcriptRetentionDays: 7,
            operatingHours: ALWAYS_OPEN_HOURS as any,
            emergencyKeywords: ['chest pain', "can't breathe", 'stroke'],
            outOfScopeKeywords: ['legal advice', 'diagnosis'],
        },
    });

    for (const category of ['SCHEDULING', 'EHR_REFILL', 'BILLING', 'INSURANCE'] as const) {
        await prisma.businessIntegration.upsert({
            where: {
                businessId_category: {
                    businessId: business.id,
                    category,
                },
            },
            update: {
                vendor: 'athenahealth',
                status: 'DISCONNECTED',
                credentialsRef: DEFAULT_CREDENTIAL_REF,
                settings: buildIntegrationSettings(category) as any,
                capabilities: {} as any,
                lastHealthCheckAt: null,
            },
            create: {
                businessId: business.id,
                category,
                vendor: 'athenahealth',
                status: 'DISCONNECTED',
                credentialsRef: DEFAULT_CREDENTIAL_REF,
                settings: buildIntegrationSettings(category) as any,
                capabilities: {} as any,
            },
        });
    }

    await prisma.businessIntegration.upsert({
        where: {
            businessId_category: {
                businessId: business.id,
                category: 'KNOWLEDGE',
            },
        },
        update: {
            vendor: 'wardline',
            status: 'CONNECTED',
            credentialsRef: null,
            settings: {
                source: 'wardline',
                category: 'KNOWLEDGE',
                enabled: true,
            } as any,
            capabilities: {
                vendor: 'wardline',
                category: 'KNOWLEDGE',
                liveExecution: true,
                canAnswerFaq: true,
                healthChecked: true,
            } as any,
            lastHealthCheckAt: new Date(),
        },
        create: {
            businessId: business.id,
            category: 'KNOWLEDGE',
            vendor: 'wardline',
            status: 'CONNECTED',
            settings: {
                source: 'wardline',
                category: 'KNOWLEDGE',
                enabled: true,
            } as any,
            capabilities: {
                vendor: 'wardline',
                category: 'KNOWLEDGE',
                liveExecution: true,
                canAnswerFaq: true,
                healthChecked: true,
            } as any,
            lastHealthCheckAt: new Date(),
        },
    });

    let workflow = await prisma.workflow.findFirst({
        where: {
            businessId: business.id,
            name: 'Smoke Runtime Flow',
        },
    });

    if (!workflow) {
        workflow = await prisma.workflow.create({
            data: {
                businessId: business.id,
                name: 'Smoke Runtime Flow',
                description: 'Business-native smoke workflow for local and CI validation.',
                status: 'PUBLISHED',
            },
        });
    } else {
        workflow = await prisma.workflow.update({
            where: { id: workflow.id },
            data: {
                status: 'PUBLISHED',
                description: 'Business-native smoke workflow for local and CI validation.',
            },
        });
    }

    await prisma.workflowVersion.deleteMany({
        where: { workflowId: workflow.id },
    });

    await prisma.workflowVersion.create({
        data: {
            workflowId: workflow.id,
            versionNumber: 1,
            graphJson: createSmokeWorkflowGraph() as any,
            createdByUserId: owner.id,
            approvedByUserId: owner.id,
            status: 'PUBLISHED',
            publishedAt: new Date(),
        },
    });

    await prisma.phoneNumber.upsert({
        where: { twilioPhoneNumber: DEFAULT_PHONE_NUMBER },
        update: {
            businessId: business.id,
            workflowId: workflow.id,
            twilioSid: DEFAULT_TWILIO_SID,
            label: 'Smoke Main Line',
        },
        create: {
            businessId: business.id,
            workflowId: workflow.id,
            twilioPhoneNumber: DEFAULT_PHONE_NUMBER,
            twilioSid: DEFAULT_TWILIO_SID,
            label: 'Smoke Main Line',
        },
    });

    await seedAgentsForBusiness(business.id);

    console.log('Smoke fixture ready.');
    console.log(`Business: ${business.name} (${business.id})`);
    console.log(`Owner Clerk user: ${owner.clerkUserId}`);
    console.log(`Phone number: ${DEFAULT_PHONE_NUMBER}`);
    console.log(`Mock integration base URL: ${DEFAULT_MOCK_BASE_URL}`);
    console.log(`Credential env ref: ${DEFAULT_CREDENTIAL_REF}`);
  }

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
