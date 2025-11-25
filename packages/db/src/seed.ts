import { PrismaClient, UserRole, CallStatus, CallDirection, RecordingConsent, SentimentLabel, Speaker, WorkflowStatus, CallTag, WorkflowVersionStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting database seed...');

    // Clean existing data (be careful in production!)
    console.log('🧹 Cleaning existing data...');
    await prisma.transcriptSegment.deleteMany();
    await prisma.sentimentSnapshot.deleteMany();
    await prisma.handoff.deleteMany();
    await prisma.callSession.deleteMany();
    await prisma.patient.deleteMany();
    await prisma.workflowVersion.deleteMany();
    await prisma.workflow.deleteMany();
    await prisma.intent.deleteMany();
    await prisma.phoneNumber.deleteMany();
    await prisma.hospitalUser.deleteMany();
    await prisma.user.deleteMany();
    await prisma.hospitalSettings.deleteMany();
    await prisma.hospital.deleteMany();

    // Create Hospital
    console.log('🏥 Creating hospital...');
    const hospital = await prisma.hospital.create({
        data: {
            name: 'St. Mary\'s Regional Hospital',
            slug: 'st-marys',
            timeZone: 'America/New_York',
            status: 'ACTIVE',
        },
    });

    // Create Hospital Settings
    await prisma.hospitalSettings.create({
        data: {
            hospitalId: hospital.id,
            recordingDefault: 'ON',
            transcriptRetentionDays: 30,
            e911Enabled: true,
        },
    });

    // Create Users
    console.log('👥 Creating users...');
    const users = await Promise.all([
        prisma.user.create({
            data: {
                clerkUserId: 'user_demo_owner',
                email: 'jane.doe@stmarys.org',
                fullName: 'Jane Doe',
            },
        }),
        prisma.user.create({
            data: {
                clerkUserId: 'user_demo_admin',
                email: 'robert.chen@stmarys.org',
                fullName: 'Dr. Robert Chen',
            },
        }),
        prisma.user.create({
            data: {
                clerkUserId: 'user_demo_supervisor',
                email: 'sarah.miller@stmarys.org',
                fullName: 'Sarah Miller',
            },
        }),
    ]);

    // Assign users to hospital
    await Promise.all([
        prisma.hospitalUser.create({
            data: { hospitalId: hospital.id, userId: users[0].id, role: UserRole.OWNER },
        }),
        prisma.hospitalUser.create({
            data: { hospitalId: hospital.id, userId: users[1].id, role: UserRole.ADMIN },
        }),
        prisma.hospitalUser.create({
            data: { hospitalId: hospital.id, userId: users[2].id, role: UserRole.SUPERVISOR },
        }),
    ]);

    // Create Intents
    console.log('🎯 Creating intents...');
    const intents = await Promise.all([
        prisma.intent.create({
            data: {
                hospitalId: hospital.id,
                key: 'scheduling',
                displayName: 'Appointment Scheduling',
                description: 'Patient wants to schedule an appointment',
                enabled: true,
                requiredFields: [
                    { key: 'preferredDate', label: 'Preferred Date', type: 'date', required: true },
                    { key: 'reason', label: 'Reason for Visit', type: 'text', required: true },
                ],
                routingRules: [],
            },
        }),
        prisma.intent.create({
            data: {
                hospitalId: hospital.id,
                key: 'billing',
                displayName: 'Billing Question',
                description: 'Patient has billing or insurance questions',
                enabled: true,
                requiredFields: [],
                routingRules: [],
            },
        }),
        prisma.intent.create({
            data: {
                hospitalId: hospital.id,
                key: 'refill',
                displayName: 'Prescription Refill',
                description: 'Patient needs a prescription refill',
                enabled: true,
                requiredFields: [
                    { key: 'medication', label: 'Medication Name', type: 'text', required: true },
                ],
                routingRules: [],
            },
        }),
        prisma.intent.create({
            data: {
                hospitalId: hospital.id,
                key: 'clinical-triage',
                displayName: 'Clinical Triage',
                description: 'Patient has symptoms or health concerns',
                enabled: true,
                requiredFields: [],
                routingRules: [],
            },
        }),
    ]);

    // Create Phone Number
    console.log('📞 Creating phone number...');
    const phoneNumber = await prisma.phoneNumber.create({
        data: {
            hospitalId: hospital.id,
            twilioPhoneNumber: '+15551234567',
            twilioSid: 'PN_demo_12345',
            label: 'Main Line',
        },
    });

    // Create Workflows
    console.log('🔄 Creating workflows...');
    const workflow = await prisma.workflow.create({
        data: {
            hospitalId: hospital.id,
            name: 'General Triage Flow',
            description: 'Main call routing workflow for patient inquiries',
            status: WorkflowStatus.PUBLISHED,
        },
    });

    await prisma.workflowVersion.create({
        data: {
            workflowId: workflow.id,
            versionNumber: 1,
            status: WorkflowVersionStatus.PUBLISHED,
            createdByUserId: users[0].id,
            approvedByUserId: users[1].id,
            publishedAt: new Date(),
            graphJson: {
                nodes: [
                    { id: 'start', type: 'start', config: {} },
                    { id: 'greeting', type: 'voice-prompt', config: { message: 'Welcome to St. Mary\'s' } },
                    { id: 'intent', type: 'intent-detect', config: {} },
                    { id: 'route', type: 'route', config: {} },
                ],
                edges: [
                    { id: 'e1', fromNodeId: 'start', toNodeId: 'greeting' },
                    { id: 'e2', fromNodeId: 'greeting', toNodeId: 'intent' },
                    { id: 'e3', fromNodeId: 'intent', toNodeId: 'route' },
                ],
            },
        },
    });

    // Create Patients
    console.log('🩺 Creating patients...');
    const patients = await Promise.all([
        prisma.patient.create({
            data: {
                hospitalId: hospital.id,
                externalId: 'MRN-001234',
                name: 'Sarah Johnson',
                dob: new Date('1985-03-15'),
                primaryPhone: '+15559871234',
            },
        }),
        prisma.patient.create({
            data: {
                hospitalId: hospital.id,
                externalId: 'MRN-005678',
                name: 'Michael Rodriguez',
                dob: new Date('1972-07-22'),
                primaryPhone: '+15559875678',
            },
        }),
        prisma.patient.create({
            data: {
                hospitalId: hospital.id,
                externalId: 'MRN-009012',
                name: 'Emily Chen',
                dob: new Date('1990-11-08'),
                primaryPhone: '+15559870012',
            },
        }),
    ]);

    // Create Call Sessions with varied data
    console.log('📞 Creating call sessions...');
    const callData = [
        {
            patient: patients[0],
            intent: intents[0],
            status: CallStatus.COMPLETED,
            duration: 252, // 4:12
            sentiment: 0.85,
            sentimentLabel: SentimentLabel.POSITIVE,
            tag: CallTag.SCHEDULING,
            emergency: false,
            startedAt: new Date(Date.now() - 2 * 60 * 1000), // 2 min ago
        },
        {
            patient: null,
            intent: intents[3],
            status: CallStatus.COMPLETED,
            duration: 90, // 1:30
            sentiment: 0.35,
            sentimentLabel: SentimentLabel.NEGATIVE,
            tag: CallTag.CLINICAL_ESCALATION,
            emergency: true,
            startedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
        },
        {
            patient: patients[1],
            intent: intents[1],
            status: CallStatus.COMPLETED,
            duration: 165, // 2:45
            sentiment: 0.60,
            sentimentLabel: SentimentLabel.NEUTRAL,
            tag: CallTag.BILLING_INSURANCE,
            emergency: false,
            startedAt: new Date(Date.now() - 12 * 60 * 1000), // 12 min ago
        },
        {
            patient: patients[2],
            intent: null,
            status: CallStatus.ABANDONED,
            duration: 0,
            sentiment: null,
            sentimentLabel: null,
            tag: null,
            emergency: false,
            startedAt: new Date(Date.now() - 18 * 60 * 1000), // 18 min ago
        },
        {
            patient: patients[0],
            intent: intents[2],
            status: CallStatus.COMPLETED,
            duration: 320, // 5:20
            sentiment: 0.72,
            sentimentLabel: SentimentLabel.NEUTRAL,
            tag: CallTag.REFILL_PRIOR_AUTH,
            emergency: false,
            startedAt: new Date(Date.now() - 45 * 60 * 1000), // 45 min ago
        },
    ];

    // Add more historical calls
    for (let i = 0; i < 50; i++) {
        const randomPatient = patients[Math.floor(Math.random() * patients.length)];
        const randomIntent = intents[Math.floor(Math.random() * intents.length)];
        const statuses = [CallStatus.COMPLETED, CallStatus.COMPLETED, CallStatus.COMPLETED, CallStatus.ABANDONED];
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
        const sentiments = [SentimentLabel.POSITIVE, SentimentLabel.NEUTRAL, SentimentLabel.NEGATIVE];
        const randomSentiment = sentiments[Math.floor(Math.random() * sentiments.length)];
        const tags = [CallTag.SCHEDULING, CallTag.BILLING_INSURANCE, CallTag.REFILL_PRIOR_AUTH, CallTag.CLINICAL_ESCALATION];
        const randomTag = tags[Math.floor(Math.random() * tags.length)];

        const hoursAgo = Math.floor(Math.random() * 168); // Random time in last week
        const duration = randomStatus === CallStatus.COMPLETED ? Math.floor(Math.random() * 600) + 30 : 0;
        const sentimentScore = randomStatus === CallStatus.COMPLETED ? Math.random() * 0.8 + 0.2 : null;

        callData.push({
            patient: Math.random() > 0.3 ? randomPatient : null,
            intent: Math.random() > 0.2 ? randomIntent : null,
            status: randomStatus,
            duration,
            sentiment: sentimentScore,
            sentimentLabel: randomStatus === CallStatus.COMPLETED ? randomSentiment : null,
            tag: randomStatus === CallStatus.COMPLETED ? randomTag : null,
            emergency: Math.random() > 0.9,
            startedAt: new Date(Date.now() - hoursAgo * 60 * 60 * 1000),
        });
    }

    for (const [index, data] of callData.entries()) {
        const call = await prisma.callSession.create({
            data: {
                hospitalId: hospital.id,
                phoneNumberId: phoneNumber.id,
                twilioCallSid: `CA_demo_${index.toString().padStart(5, '0')}`,
                direction: CallDirection.INBOUND,
                status: data.status,
                recordingConsent: RecordingConsent.IMPLICIT,
                intentId: data.intent?.id,
                tag: data.tag,
                patientId: data.patient?.id,
                isEmergency: data.emergency,
                startedAt: data.startedAt,
                endedAt: data.status !== CallStatus.ABANDONED ? new Date(data.startedAt.getTime() + data.duration * 1000) : null,
                sentimentOverallScore: data.sentiment,
                aiConfidence: 0.92,
            },
        });

        // Add transcript for completed calls
        if (data.status === CallStatus.COMPLETED && index < 10) {
            await prisma.transcriptSegment.createMany({
                data: [
                    {
                        callId: call.id,
                        speaker: Speaker.SYSTEM,
                        text: 'Welcome to St. Mary\'s Regional Hospital. How may I help you today?',
                        startTimeMs: 0,
                        endTimeMs: 3000,
                        confidence: 0.98,
                    },
                    {
                        callId: call.id,
                        speaker: Speaker.CALLER,
                        text: data.intent?.displayName || 'I need help',
                        startTimeMs: 3500,
                        endTimeMs: 5000,
                        confidence: 0.95,
                    },
                ],
            });

            // Add sentiment snapshots
            if (data.sentimentLabel) {
                await prisma.sentimentSnapshot.create({
                    data: {
                        callId: call.id,
                        offsetMs: 2000,
                        score: data.sentiment || 0.5,
                        label: data.sentimentLabel,
                    },
                });
            }
        }
    }

    console.log('✅ Database seeded successfully!');
    console.log('\n📊 Summary:');
    console.log(`   Hospital: ${hospital.name}`);
    console.log(`   Hospital ID: ${hospital.id}`);
    console.log(`   Users: ${users.length}`);
    console.log(`   Intents: ${intents.length}`);
    console.log(`   Patients: ${patients.length}`);
    console.log(`   Calls: ${callData.length}`);
    console.log(`   Workflows: 1`);
    console.log('\n💡 Save the Hospital ID above - you\'ll need it for the frontend!');
    console.log(`   Set in browser console: localStorage.setItem('selectedHospitalId', '${hospital.id}')`);
}

main()
    .catch((e) => {
        console.error('❌ Error seeding database:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
