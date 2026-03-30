import {
    buildPracticeSetupRuntimeGraph,
    GENERATED_PRACTICE_WORKFLOW_DESCRIPTION,
    GENERATED_PRACTICE_WORKFLOW_NAME,
    prisma,
    UserRole,
} from './index';

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

const SMOKE_PRACTICE_SETUP = {
    enabledActions: ['appointment-request', 'refill-request', 'insurance-check', 'billing-request'] as const,
    afterHoursPolicy: {
        mode: 'urgent_voicemail' as const,
        greeting:
            'The office is currently closed, but I can take a message for the staff and they will follow up on the next business day.',
        sendUrgentToVoicemail: true,
    },
    refillPolicy: {
        liveEnabled: true,
        intakeNotes: 'Collect medication name, pharmacy, and caller date of birth before submitting refill requests.',
        fallbackSummary: 'Create a refill follow-up for staff if live refill automation is unavailable.',
    },
    billingPolicy: {
        liveEnabled: true,
        intakeNotes: 'Capture the billing topic and account reference before creating a billing follow-up.',
        fallbackSummary: 'Create a billing follow-up if live billing support is unavailable.',
    },
    insurancePolicy: {
        liveEnabled: true,
        intakeNotes: 'Answer acceptance and basic eligibility questions when the connected payer workflow supports it.',
        fallbackSummary: 'Create an insurance follow-up if live verification is unavailable.',
    },
    knowledgeConfig: {
        faqSummary:
            'Smoke Family Medicine handles routine appointments, refill requests, insurance checks, and billing questions.',
        commonQuestions: ['Office hours', 'Prescription refills', 'Insurance acceptance', 'Billing support'],
    },
    escalationConfig: {
        urgentCallbackWindowMinutes: 30,
        escalationMessage:
            'Escalate emergencies immediately. Capture urgent after-hours messages and create priority follow-up tasks.',
        notifyStaffImmediately: true,
    },
};

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

async function ensurePhoneNumberLine(input: {
    businessId: string;
    workflowId: string;
    twilioPhoneNumber: string;
    twilioSid: string;
    label: string;
}) {
    const [existingByPhone, existingBySid] = await Promise.all([
        prisma.phoneNumber.findUnique({
            where: { twilioPhoneNumber: input.twilioPhoneNumber },
        }),
        prisma.phoneNumber.findUnique({
            where: { twilioSid: input.twilioSid },
        }),
    ]);

    if (existingByPhone && existingBySid && existingByPhone.id !== existingBySid.id) {
        const legacySid = `${input.twilioSid}__legacy_${existingBySid.id.slice(0, 8)}`;
        console.warn(
            `Reconciling smoke phone record conflict between ${input.twilioPhoneNumber} and ${input.twilioSid}; preserving the current phone number record and retiring the stale SID on ${existingBySid.id}.`,
        );
        await prisma.phoneNumber.update({
            where: { id: existingBySid.id },
            data: {
                twilioSid: legacySid,
                label: existingBySid.label.startsWith('Legacy ') ? existingBySid.label : `Legacy ${existingBySid.label}`,
            },
        });
        return prisma.phoneNumber.update({
            where: { id: existingByPhone.id },
            data: {
                businessId: input.businessId,
                workflowId: input.workflowId,
                twilioSid: input.twilioSid,
                label: input.label,
            },
        });
    }

    if (existingByPhone) {
        return prisma.phoneNumber.update({
            where: { id: existingByPhone.id },
            data: {
                businessId: input.businessId,
                workflowId: input.workflowId,
                twilioSid: input.twilioSid,
                label: input.label,
            },
        });
    }

    if (existingBySid) {
        return prisma.phoneNumber.update({
            where: { id: existingBySid.id },
            data: {
                businessId: input.businessId,
                workflowId: input.workflowId,
                twilioPhoneNumber: input.twilioPhoneNumber,
                label: input.label,
            },
        });
    }

    return prisma.phoneNumber.create({
        data: {
            businessId: input.businessId,
            workflowId: input.workflowId,
            twilioPhoneNumber: input.twilioPhoneNumber,
            twilioSid: input.twilioSid,
            label: input.label,
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
            enabledActions: [...SMOKE_PRACTICE_SETUP.enabledActions],
            afterHoursPolicy: SMOKE_PRACTICE_SETUP.afterHoursPolicy as any,
            refillPolicy: SMOKE_PRACTICE_SETUP.refillPolicy as any,
            billingPolicy: SMOKE_PRACTICE_SETUP.billingPolicy as any,
            insurancePolicy: SMOKE_PRACTICE_SETUP.insurancePolicy as any,
            knowledgeConfig: SMOKE_PRACTICE_SETUP.knowledgeConfig as any,
            escalationConfig: SMOKE_PRACTICE_SETUP.escalationConfig as any,
            emergencyKeywords: ['chest pain', "can't breathe", 'stroke'],
            outOfScopeKeywords: ['legal advice', 'diagnosis'],
        },
        create: {
            businessId: business.id,
            recordingDefault: 'ASK',
            transcriptRetentionDays: 7,
            operatingHours: ALWAYS_OPEN_HOURS as any,
            enabledActions: [...SMOKE_PRACTICE_SETUP.enabledActions],
            afterHoursPolicy: SMOKE_PRACTICE_SETUP.afterHoursPolicy as any,
            refillPolicy: SMOKE_PRACTICE_SETUP.refillPolicy as any,
            billingPolicy: SMOKE_PRACTICE_SETUP.billingPolicy as any,
            insurancePolicy: SMOKE_PRACTICE_SETUP.insurancePolicy as any,
            knowledgeConfig: SMOKE_PRACTICE_SETUP.knowledgeConfig as any,
            escalationConfig: SMOKE_PRACTICE_SETUP.escalationConfig as any,
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

    const graphJson = buildPracticeSetupRuntimeGraph({
        businessId: business.id,
        businessName: business.name,
        timeZone: business.timeZone,
        enabledActions: [...SMOKE_PRACTICE_SETUP.enabledActions],
        afterHoursPolicy: SMOKE_PRACTICE_SETUP.afterHoursPolicy,
        refillPolicy: SMOKE_PRACTICE_SETUP.refillPolicy,
        billingPolicy: SMOKE_PRACTICE_SETUP.billingPolicy,
        insurancePolicy: SMOKE_PRACTICE_SETUP.insurancePolicy,
        knowledgeConfig: SMOKE_PRACTICE_SETUP.knowledgeConfig,
        escalationConfig: SMOKE_PRACTICE_SETUP.escalationConfig,
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

    await ensurePhoneNumberLine({
        businessId: business.id,
        workflowId: workflow.id,
        twilioPhoneNumber: DEFAULT_PHONE_NUMBER,
        twilioSid: DEFAULT_TWILIO_SID,
        label: 'Smoke Main Line',
    });

    console.log('Smoke fixture ready.');
    console.log(`Business: ${business.name} (${business.id})`);
    console.log(`Owner Clerk user: ${owner.clerkUserId}`);
    console.log(`Phone number: ${DEFAULT_PHONE_NUMBER}`);
    console.log(`Mock integration base URL: ${DEFAULT_MOCK_BASE_URL}`);
    console.log(`Credential env ref: ${DEFAULT_CREDENTIAL_REF}`);
    console.log(`Generated runtime workflow: ${GENERATED_PRACTICE_WORKFLOW_NAME}`);
  }

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
