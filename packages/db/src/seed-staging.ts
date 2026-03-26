import {
    buildPracticeSetupRuntimeGraph,
    GENERATED_PRACTICE_WORKFLOW_DESCRIPTION,
    GENERATED_PRACTICE_WORKFLOW_NAME,
    prisma,
    UserRole,
} from './index';

const STAGING_BUSINESS_NAME = process.env.STAGING_BUSINESS_NAME || 'Wardline Family Medicine Staging';
const STAGING_BUSINESS_SLUG = process.env.STAGING_BUSINESS_SLUG || 'wardline-family-medicine-staging';
const STAGING_PHONE_NUMBER = process.env.STAGING_PHONE_NUMBER || '+15551239999';
const STAGING_TWILIO_SID = process.env.STAGING_TWILIO_SID || 'PN_STAGING_0001';
const STAGING_CLERK_USER_ID = process.env.STAGING_CLERK_USER_ID || 'user_staging_owner';
const STAGING_USER_EMAIL = process.env.STAGING_USER_EMAIL || 'staging.owner@wardline.local';
const STAGING_USER_NAME = process.env.STAGING_USER_NAME || 'Staging Owner';

const DEFAULT_INTEGRATION_BASE_URL =
    process.env.STAGING_INTEGRATION_BASE_URL || process.env.ATHENAHEALTH_BASE_URL || '';

const FAMILY_MEDICINE_HOURS = [
    { dayOfWeek: 0, isClosed: true, startTime: null, endTime: null },
    { dayOfWeek: 1, isClosed: false, startTime: '08:00', endTime: '17:00' },
    { dayOfWeek: 2, isClosed: false, startTime: '08:00', endTime: '17:00' },
    { dayOfWeek: 3, isClosed: false, startTime: '08:00', endTime: '17:00' },
    { dayOfWeek: 4, isClosed: false, startTime: '08:00', endTime: '17:00' },
    { dayOfWeek: 5, isClosed: false, startTime: '08:00', endTime: '17:00' },
    { dayOfWeek: 6, isClosed: true, startTime: null, endTime: null },
];

const STAGING_PRACTICE_SETUP = {
    enabledActions: ['appointment-request', 'refill-request', 'insurance-check', 'billing-request'] as const,
    afterHoursPolicy: {
        mode: 'urgent_voicemail' as const,
        greeting:
            'After hours, capture urgent messages, reassure the caller, and promise next-business-day staff follow-up.',
        sendUrgentToVoicemail: true,
    },
    refillPolicy: {
        liveEnabled: true,
        intakeNotes: 'Collect medication name, pharmacy, and caller date of birth before creating a refill request.',
        fallbackSummary: 'Create a refill follow-up when live refill execution is unavailable.',
    },
    billingPolicy: {
        liveEnabled: true,
        intakeNotes: 'Capture the billing topic and any account reference before creating a billing request.',
        fallbackSummary: 'Create a billing follow-up when live billing support is unavailable.',
    },
    insurancePolicy: {
        liveEnabled: true,
        intakeNotes: 'Answer insurance acceptance and basic eligibility questions when supported by the connected system.',
        fallbackSummary: 'Create an insurance follow-up when live eligibility verification is unavailable.',
    },
    knowledgeConfig: {
        faqSummary:
            'Wardline Family Medicine offers routine appointments, refill support, insurance checks, and billing help.',
        commonQuestions: ['Office hours', 'Appointments', 'Refill requests', 'Insurance acceptance'],
    },
    escalationConfig: {
        urgentCallbackWindowMinutes: 30,
        escalationMessage:
            'Escalate emergencies immediately. Capture urgent after-hours messages and create priority staff follow-ups.',
        notifyStaffImmediately: true,
    },
};

function envOrDefault(key: string, fallback: string) {
    return process.env[key] || fallback;
}

function buildIntegrationSettings(category: 'SCHEDULING' | 'EHR_REFILL' | 'BILLING' | 'INSURANCE') {
    const baseUrl = envOrDefault(`STAGING_${category}_BASE_URL`, DEFAULT_INTEGRATION_BASE_URL);
    const endpoints = {
        health: envOrDefault(`STAGING_${category}_HEALTH_PATH`, '/metadata'),
        appointmentRequest: envOrDefault('STAGING_SCHEDULING_APPOINTMENT_PATH', '/appointments/request'),
        refillRequest: envOrDefault('STAGING_EHR_REFILL_PATH', '/medication-refills'),
        insuranceCheck: envOrDefault('STAGING_INSURANCE_CHECK_PATH', '/coverage/check'),
        billingRequest: envOrDefault('STAGING_BILLING_REQUEST_PATH', '/billing/cases'),
    };

    return {
        baseUrl,
        healthPath: endpoints.health,
        timeoutMs: Number(process.env.STAGING_CONNECTOR_TIMEOUT_MS || 3500),
        practiceId: process.env.STAGING_PRACTICE_ID || 'family-medicine-staging',
        departmentId: process.env.STAGING_DEPARTMENT_ID || 'primary-care',
        endpoints,
    };
}

const DEFAULT_STAGING_CREDENTIALS_REF =
    process.env.MOCK_CREDENTIALS_REF || 'MOCK_ATHENAHEALTH_TOKEN';

function credentialsRefFor(category: 'SCHEDULING' | 'EHR_REFILL' | 'BILLING' | 'INSURANCE') {
    switch (category) {
        case 'SCHEDULING':
            return process.env.STAGING_SCHEDULING_CREDENTIALS_REF || DEFAULT_STAGING_CREDENTIALS_REF;
        case 'EHR_REFILL':
            return process.env.STAGING_EHR_REFILL_CREDENTIALS_REF || DEFAULT_STAGING_CREDENTIALS_REF;
        case 'INSURANCE':
            return process.env.STAGING_INSURANCE_CREDENTIALS_REF || DEFAULT_STAGING_CREDENTIALS_REF;
        case 'BILLING':
            return process.env.STAGING_BILLING_CREDENTIALS_REF || DEFAULT_STAGING_CREDENTIALS_REF;
    }
}

async function ensureOwnerUser() {
    return prisma.user.upsert({
        where: { clerkUserId: STAGING_CLERK_USER_ID },
        update: {
            email: STAGING_USER_EMAIL,
            fullName: STAGING_USER_NAME,
        },
        create: {
            clerkUserId: STAGING_CLERK_USER_ID,
            email: STAGING_USER_EMAIL,
            fullName: STAGING_USER_NAME,
        },
    });
}

async function ensureBusiness() {
    return prisma.business.upsert({
        where: { slug: STAGING_BUSINESS_SLUG },
        update: {
            name: STAGING_BUSINESS_NAME,
            timeZone: 'America/New_York',
            status: 'ACTIVE',
        },
        create: {
            name: STAGING_BUSINESS_NAME,
            slug: STAGING_BUSINESS_SLUG,
            timeZone: 'America/New_York',
            status: 'ACTIVE',
        },
    });
}

async function main() {
    console.log('Creating staging validation fixture...');

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
            operatingHours: FAMILY_MEDICINE_HOURS as any,
            enabledActions: [...STAGING_PRACTICE_SETUP.enabledActions],
            afterHoursPolicy: STAGING_PRACTICE_SETUP.afterHoursPolicy as any,
            refillPolicy: STAGING_PRACTICE_SETUP.refillPolicy as any,
            billingPolicy: STAGING_PRACTICE_SETUP.billingPolicy as any,
            insurancePolicy: STAGING_PRACTICE_SETUP.insurancePolicy as any,
            knowledgeConfig: STAGING_PRACTICE_SETUP.knowledgeConfig as any,
            escalationConfig: STAGING_PRACTICE_SETUP.escalationConfig as any,
            emergencyKeywords: ['chest pain', "can't breathe", 'stroke'],
            outOfScopeKeywords: ['legal advice', 'diagnosis'],
        },
        create: {
            businessId: business.id,
            recordingDefault: 'ASK',
            transcriptRetentionDays: 7,
            operatingHours: FAMILY_MEDICINE_HOURS as any,
            enabledActions: [...STAGING_PRACTICE_SETUP.enabledActions],
            afterHoursPolicy: STAGING_PRACTICE_SETUP.afterHoursPolicy as any,
            refillPolicy: STAGING_PRACTICE_SETUP.refillPolicy as any,
            billingPolicy: STAGING_PRACTICE_SETUP.billingPolicy as any,
            insurancePolicy: STAGING_PRACTICE_SETUP.insurancePolicy as any,
            knowledgeConfig: STAGING_PRACTICE_SETUP.knowledgeConfig as any,
            escalationConfig: STAGING_PRACTICE_SETUP.escalationConfig as any,
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
                credentialsRef: credentialsRefFor(category),
                settings: buildIntegrationSettings(category) as any,
                capabilities: {} as any,
                lastHealthCheckAt: null,
            },
            create: {
                businessId: business.id,
                category,
                vendor: 'athenahealth',
                status: 'DISCONNECTED',
                credentialsRef: credentialsRefFor(category),
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

    const graphJson = buildPracticeSetupRuntimeGraph({
        businessId: business.id,
        businessName: business.name,
        timeZone: business.timeZone,
        enabledActions: [...STAGING_PRACTICE_SETUP.enabledActions],
        afterHoursPolicy: STAGING_PRACTICE_SETUP.afterHoursPolicy,
        refillPolicy: STAGING_PRACTICE_SETUP.refillPolicy,
        billingPolicy: STAGING_PRACTICE_SETUP.billingPolicy,
        insurancePolicy: STAGING_PRACTICE_SETUP.insurancePolicy,
        knowledgeConfig: STAGING_PRACTICE_SETUP.knowledgeConfig,
        escalationConfig: STAGING_PRACTICE_SETUP.escalationConfig,
        emergencyKeywords: ['chest pain', "can't breathe", 'stroke'],
        outOfScopeKeywords: ['legal advice', 'diagnosis'],
        connectedCategories: ['KNOWLEDGE'],
    });

    let workflow = await prisma.workflow.findFirst({
        where: {
            businessId: business.id,
            name: GENERATED_PRACTICE_WORKFLOW_NAME,
        },
    });

    if (!workflow) {
        workflow = await prisma.workflow.create({
            data: {
                businessId: business.id,
                name: GENERATED_PRACTICE_WORKFLOW_NAME,
                description: GENERATED_PRACTICE_WORKFLOW_DESCRIPTION,
                status: 'PUBLISHED',
            },
        });
    } else {
        workflow = await prisma.workflow.update({
            where: { id: workflow.id },
            data: {
                status: 'PUBLISHED',
                description: GENERATED_PRACTICE_WORKFLOW_DESCRIPTION,
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
            graphJson: graphJson as any,
            createdByUserId: owner.id,
            approvedByUserId: owner.id,
            status: 'PUBLISHED',
            publishedAt: new Date(),
        },
    });

    await prisma.phoneNumber.upsert({
        where: { twilioPhoneNumber: STAGING_PHONE_NUMBER },
        update: {
            businessId: business.id,
            workflowId: workflow.id,
            twilioSid: STAGING_TWILIO_SID,
            label: 'Staging Main Line',
        },
        create: {
            businessId: business.id,
            workflowId: workflow.id,
            twilioPhoneNumber: STAGING_PHONE_NUMBER,
            twilioSid: STAGING_TWILIO_SID,
            label: 'Staging Main Line',
        },
    });

    console.log('Staging fixture ready.');
    console.log(`Business: ${business.name} (${business.id})`);
    console.log(`Owner Clerk user: ${owner.clerkUserId}`);
    console.log(`Phone number: ${STAGING_PHONE_NUMBER}`);
    console.log(`Generated runtime workflow: ${GENERATED_PRACTICE_WORKFLOW_NAME}`);
    console.log('Next steps:');
    console.log('1. Open /dashboard/settings and confirm the Practice Setup readiness checklist is populated.');
    console.log('2. Run integration health checks from /dashboard/integration-failures.');
    console.log('3. Validate one Gather and one streaming call flow.');
    console.log('4. Confirm live success and fallback paths for each runtime action category.');
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
