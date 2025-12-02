import { 
    PrismaClient, 
    UserRole, 
    CallStatus, 
    CallDirection, 
    RecordingConsent, 
    SentimentLabel, 
    Speaker, 
    WorkflowStatus, 
    CallTag, 
    WorkflowVersionStatus,
    RefillStatus,
    VerificationStatus,
    EligibilityStatus,
    EventType,
    EventStatus,
    RegistrationStatus,
    AppointmentStatus
} from '@prisma/client';
import { addDays, addHours, subDays, subHours, subMinutes } from 'date-fns';

const prisma = new PrismaClient();

/**
 * TEST CREDENTIALS SETUP
 * =====================
 * 
 * This seed creates 3 test users for different dashboards:
 * 
 * 1. PATIENT USER - Access to /patient/* routes
 *    Email: patient@wardline.test
 *    Clerk User ID: user_test_patient_001
 *    Role: patient (set in Clerk metadata)
 * 
 * 2. CALL CENTER USER - Access to /dashboard/* and /admin/call-center/* routes
 *    Email: callcenter@wardline.test
 *    Clerk User ID: user_test_callcenter_001
 *    Role: admin (set in Clerk metadata)
 * 
 * 3. SYSTEM ADMIN USER - Access to /admin/system/* routes
 *    Email: sysadmin@wardline.test
 *    Clerk User ID: user_test_sysadmin_001
 *    Role: system_admin (set in Clerk metadata)
 * 
 * TWILIO PHONE NUMBER: (513) 951-1583
 */

// ============================================================================
// Test User Configuration
// ============================================================================

const TEST_USERS = {
    patient: {
        clerkUserId: 'user_test_patient_001',
        email: 'patient@wardline.test',
        fullName: 'Sarah Johnson',
        role: 'patient' as const,
    },
    callCenter: {
        clerkUserId: 'user_test_callcenter_001',
        email: 'callcenter@wardline.test',
        fullName: 'Mike Chen',
        role: UserRole.ADMIN,
    },
    systemAdmin: {
        clerkUserId: 'user_test_sysadmin_001',
        email: 'sysadmin@wardline.test',
        fullName: 'Alex Rivera',
        role: UserRole.OWNER,
    },
};

// Your Twilio phone number
const TWILIO_PHONE_NUMBER = '+15139511583'; // (513) 951-1583
const TWILIO_PHONE_SID = 'PN60c54756686ce5abc5f93629f3f62c0a'; // Replace with actual SID from Twilio console

async function main() {
    console.log('🧪 Starting comprehensive test data seed...\n');

    // Clean existing data
    console.log('🧹 Cleaning existing data...');
    await cleanDatabase();

    // Create Hospital
    console.log('\n🏥 Creating hospital...');
    const hospital = await createHospital();

    // Create Test Users
    console.log('\n👥 Creating test users...');
    const users = await createTestUsers(hospital.id);

    // Create Departments
    console.log('\n🏢 Creating departments...');
    const departments = await createDepartments(hospital.id);

    // Create Intents
    console.log('\n🎯 Creating intents...');
    const intents = await createIntents(hospital.id);

    // Create Phone Number with your Twilio number
    console.log('\n📞 Creating phone number...');
    const phoneNumber = await createPhoneNumber(hospital.id);

    // Create Workflows
    console.log('\n🔄 Creating workflows...');
    const workflow = await createWorkflows(hospital.id, users.systemAdmin.id);

    // Link phone number to workflow
    await prisma.phoneNumber.update({
        where: { id: phoneNumber.id },
        data: { workflowId: workflow.id },
    });

    // Create Patients
    console.log('\n🩺 Creating patients...');
    const patients = await createPatients(hospital.id);

    // Create Insurance Plans
    console.log('\n🛡️ Creating insurance plans...');
    const insurancePlans = await createInsurancePlans(hospital.id);

    // Create Insurance Verifications for patients
    console.log('\n✅ Creating insurance verifications...');
    await createInsuranceVerifications(hospital.id, insurancePlans, patients);

    // Create Call Sessions with rich data
    console.log('\n📞 Creating call sessions...');
    await createCallSessions(hospital.id, phoneNumber.id, intents, patients);

    // Create Appointments
    console.log('\n📅 Creating appointments...');
    await createAppointments(hospital.id);

    // Create Prescription Refills
    console.log('\n💊 Creating prescription refills...');
    await createPrescriptionRefills(hospital.id, patients);

    // Create Marketing Events
    console.log('\n📣 Creating marketing events...');
    await createMarketingEvents(hospital.id, patients);

    // Create Directory Inquiries
    console.log('\n📖 Creating directory inquiries...');
    await createDirectoryInquiries(hospital.id, departments);

    // Print Summary
    printSummary(hospital, users, phoneNumber);
}

async function cleanDatabase() {
    // Delete in correct order to respect foreign keys
    await prisma.eventRegistration.deleteMany();
    await prisma.marketingEvent.deleteMany();
    await prisma.insuranceVerification.deleteMany();
    await prisma.insuranceInquiry.deleteMany();
    await prisma.insurancePlan.deleteMany();
    await prisma.prescriptionRefill.deleteMany();
    await prisma.directoryInquiry.deleteMany();
    await prisma.department.deleteMany();
    await prisma.appointment.deleteMany();
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
    await prisma.auditLog.deleteMany();
    await prisma.usageRecord.deleteMany();
    await prisma.stripeSubscription.deleteMany();
    await prisma.schedulingIntegration.deleteMany();
    await prisma.hospital.deleteMany();
}

async function createHospital() {
    const hospital = await prisma.hospital.create({
        data: {
            name: 'Wardline Test Medical Center',
            slug: 'wardline-test',
            timeZone: 'America/New_York',
            status: 'ACTIVE',
        },
    });

    await prisma.hospitalSettings.create({
        data: {
            hospitalId: hospital.id,
            recordingDefault: 'ON',
            transcriptRetentionDays: 30,
            e911Enabled: true,
        },
    });

    return hospital;
}

async function createTestUsers(hospitalId: string) {
    // Create Patient User (stored in DB but patient role is in Clerk metadata)
    const patientUser = await prisma.user.create({
        data: {
            clerkUserId: TEST_USERS.patient.clerkUserId,
            email: TEST_USERS.patient.email,
            fullName: TEST_USERS.patient.fullName,
        },
    });

    // Create Call Center User
    const callCenterUser = await prisma.user.create({
        data: {
            clerkUserId: TEST_USERS.callCenter.clerkUserId,
            email: TEST_USERS.callCenter.email,
            fullName: TEST_USERS.callCenter.fullName,
        },
    });

    // Assign call center user to hospital
    await prisma.hospitalUser.create({
        data: {
            hospitalId,
            userId: callCenterUser.id,
            role: TEST_USERS.callCenter.role,
        },
    });

    // Create System Admin User
    const systemAdminUser = await prisma.user.create({
        data: {
            clerkUserId: TEST_USERS.systemAdmin.clerkUserId,
            email: TEST_USERS.systemAdmin.email,
            fullName: TEST_USERS.systemAdmin.fullName,
        },
    });

    // Assign system admin to hospital as owner
    await prisma.hospitalUser.create({
        data: {
            hospitalId,
            userId: systemAdminUser.id,
            role: TEST_USERS.systemAdmin.role,
        },
    });

    return {
        patient: patientUser,
        callCenter: callCenterUser,
        systemAdmin: systemAdminUser,
    };
}

async function createDepartments(hospitalId: string) {
    const departments = await Promise.all([
        prisma.department.create({
            data: {
                hospitalId,
                name: 'Emergency Department',
                description: '24/7 emergency medical services',
                serviceTypes: ['Emergency Care', 'Trauma', 'Urgent Care'],
                phoneNumber: '+15139511584',
                extension: '1001',
                location: 'Building A, Ground Floor',
                hoursOfOperation: { open: '00:00', close: '23:59', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
                isActive: true,
            },
        }),
        prisma.department.create({
            data: {
                hospitalId,
                name: 'Radiology',
                description: 'Diagnostic imaging services',
                serviceTypes: ['X-Ray', 'MRI', 'CT Scan', 'Ultrasound'],
                phoneNumber: '+15139511585',
                extension: '2001',
                location: 'Building B, 2nd Floor',
                hoursOfOperation: { open: '07:00', close: '19:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
                isActive: true,
            },
        }),
        prisma.department.create({
            data: {
                hospitalId,
                name: 'Cardiology',
                description: 'Heart and cardiovascular care',
                serviceTypes: ['ECG', 'Stress Test', 'Echo', 'Consultation'],
                phoneNumber: '+15139511586',
                extension: '3001',
                location: 'Building C, 3rd Floor',
                hoursOfOperation: { open: '08:00', close: '17:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
                isActive: true,
            },
        }),
        prisma.department.create({
            data: {
                hospitalId,
                name: 'Primary Care',
                description: 'General medicine and wellness',
                serviceTypes: ['Annual Physical', 'Sick Visit', 'Preventive Care', 'Immunizations'],
                phoneNumber: '+15139511587',
                extension: '4001',
                location: 'Building A, 1st Floor',
                hoursOfOperation: { open: '08:00', close: '18:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
                isActive: true,
            },
        }),
        prisma.department.create({
            data: {
                hospitalId,
                name: 'Pharmacy',
                description: 'Prescription services and medication counseling',
                serviceTypes: ['Prescription Refill', 'Medication Counseling', 'Immunizations'],
                phoneNumber: '+15139511588',
                extension: '5001',
                location: 'Building A, Ground Floor',
                hoursOfOperation: { open: '07:00', close: '21:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] },
                isActive: true,
            },
        }),
        prisma.department.create({
            data: {
                hospitalId,
                name: 'Billing & Insurance',
                description: 'Financial services and insurance verification',
                serviceTypes: ['Billing Questions', 'Insurance Verification', 'Payment Plans'],
                phoneNumber: '+15139511589',
                extension: '6001',
                location: 'Building D, 1st Floor',
                hoursOfOperation: { open: '08:00', close: '17:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
                isActive: true,
            },
        }),
    ]);

    return departments;
}

async function createIntents(hospitalId: string) {
    return await Promise.all([
        prisma.intent.create({
            data: {
                hospitalId,
                key: 'scheduling',
                displayName: 'Appointment Scheduling',
                description: 'Patient wants to schedule, reschedule, or cancel an appointment',
                enabled: true,
                requiredFields: [
                    { key: 'preferredDate', label: 'Preferred Date', type: 'date', required: true },
                    { key: 'reason', label: 'Reason for Visit', type: 'text', required: true },
                    { key: 'provider', label: 'Preferred Provider', type: 'text', required: false },
                ],
                routingRules: [
                    { condition: 'urgent', target: 'same_day_queue' },
                    { condition: 'new_patient', target: 'new_patient_queue' },
                ],
            },
        }),
        prisma.intent.create({
            data: {
                hospitalId,
                key: 'billing',
                displayName: 'Billing Question',
                description: 'Patient has billing or payment questions',
                enabled: true,
                requiredFields: [
                    { key: 'accountNumber', label: 'Account Number', type: 'text', required: false },
                ],
                routingRules: [],
            },
        }),
        prisma.intent.create({
            data: {
                hospitalId,
                key: 'refill',
                displayName: 'Prescription Refill',
                description: 'Patient needs a prescription refill',
                enabled: true,
                requiredFields: [
                    { key: 'medication', label: 'Medication Name', type: 'text', required: true },
                    { key: 'pharmacy', label: 'Pharmacy Name', type: 'text', required: false },
                ],
                routingRules: [],
            },
        }),
        prisma.intent.create({
            data: {
                hospitalId,
                key: 'clinical-triage',
                displayName: 'Clinical Triage',
                description: 'Patient has symptoms or health concerns',
                enabled: true,
                requiredFields: [
                    { key: 'symptoms', label: 'Symptoms', type: 'text', required: true },
                    { key: 'duration', label: 'Duration', type: 'text', required: true },
                ],
                routingRules: [
                    { condition: 'emergency_keywords', target: 'emergency_transfer' },
                ],
            },
        }),
        prisma.intent.create({
            data: {
                hospitalId,
                key: 'insurance',
                displayName: 'Insurance Verification',
                description: 'Patient wants to verify insurance coverage',
                enabled: true,
                requiredFields: [
                    { key: 'insuranceProvider', label: 'Insurance Provider', type: 'text', required: true },
                ],
                routingRules: [],
            },
        }),
        prisma.intent.create({
            data: {
                hospitalId,
                key: 'records',
                displayName: 'Medical Records Request',
                description: 'Patient wants to request medical records',
                enabled: true,
                requiredFields: [],
                routingRules: [],
            },
        }),
    ]);
}

async function createPhoneNumber(hospitalId: string) {
    return await prisma.phoneNumber.create({
        data: {
            hospitalId,
            twilioPhoneNumber: TWILIO_PHONE_NUMBER,
            twilioSid: TWILIO_PHONE_SID,
            label: 'Main Line - Voice AI',
        },
    });
}

async function createWorkflows(hospitalId: string, createdByUserId: string) {
    const workflow = await prisma.workflow.create({
        data: {
            hospitalId,
            name: 'Main Voice AI Triage',
            description: 'Primary call routing workflow with emergency screening and intent detection',
            status: WorkflowStatus.PUBLISHED,
        },
    });

    await prisma.workflowVersion.create({
        data: {
            workflowId: workflow.id,
            versionNumber: 1,
            status: WorkflowVersionStatus.PUBLISHED,
            createdByUserId,
            approvedByUserId: createdByUserId,
            publishedAt: new Date(),
            graphJson: {
                nodes: [
                    { id: 'start', type: 'start', config: {} },
                    { 
                        id: 'greeting', 
                        type: 'voice-prompt', 
                        config: { 
                            message: 'Thank you for calling Wardline Test Medical Center. If this is a medical emergency, please hang up and call 911.' 
                        } 
                    },
                    { 
                        id: 'emergency-screen', 
                        type: 'emergency-screen', 
                        config: { 
                            keywords: ['chest pain', 'stroke', 'bleeding', 'unconscious', 'not breathing'] 
                        } 
                    },
                    { id: 'intent-detect', type: 'intent-detect', config: {} },
                    { id: 'route-scheduling', type: 'route', config: { target: 'scheduling_queue' } },
                    { id: 'route-billing', type: 'route', config: { target: 'billing_queue' } },
                    { id: 'route-clinical', type: 'route', config: { target: 'clinical_queue' } },
                    { id: 'end', type: 'end', config: {} },
                ],
                edges: [
                    { id: 'e1', fromNodeId: 'start', toNodeId: 'greeting' },
                    { id: 'e2', fromNodeId: 'greeting', toNodeId: 'emergency-screen' },
                    { id: 'e3', fromNodeId: 'emergency-screen', toNodeId: 'intent-detect', condition: 'not_emergency' },
                    { id: 'e4', fromNodeId: 'intent-detect', toNodeId: 'route-scheduling', condition: 'intent:scheduling' },
                    { id: 'e5', fromNodeId: 'intent-detect', toNodeId: 'route-billing', condition: 'intent:billing' },
                    { id: 'e6', fromNodeId: 'intent-detect', toNodeId: 'route-clinical', condition: 'intent:clinical' },
                ],
            },
        },
    });

    return workflow;
}

async function createPatients(hospitalId: string) {
    return await Promise.all([
        // Test patient linked to the patient user
        prisma.patient.create({
            data: {
                hospitalId,
                externalId: 'MRN-TEST-001',
                name: 'Sarah Johnson',
                dob: new Date('1985-03-15'),
                primaryPhone: '+15551234567',
            },
        }),
        prisma.patient.create({
            data: {
                hospitalId,
                externalId: 'MRN-TEST-002',
                name: 'Michael Rodriguez',
                dob: new Date('1972-07-22'),
                primaryPhone: '+15559875678',
            },
        }),
        prisma.patient.create({
            data: {
                hospitalId,
                externalId: 'MRN-TEST-003',
                name: 'Emily Chen',
                dob: new Date('1990-11-08'),
                primaryPhone: '+15559870012',
            },
        }),
        prisma.patient.create({
            data: {
                hospitalId,
                externalId: 'MRN-TEST-004',
                name: 'Robert Davis',
                dob: new Date('1965-01-30'),
                primaryPhone: '+15559873456',
            },
        }),
        prisma.patient.create({
            data: {
                hospitalId,
                externalId: 'MRN-TEST-005',
                name: 'Jennifer Wilson',
                dob: new Date('1988-09-12'),
                primaryPhone: '+15559877890',
            },
        }),
    ]);
}

async function createInsurancePlans(hospitalId: string) {
    return await Promise.all([
        prisma.insurancePlan.create({
            data: {
                hospitalId,
                planName: 'Blue Cross Premium PPO',
                carrierId: 'BCBS-001',
                carrierName: 'Blue Cross Blue Shield',
                planType: 'PPO',
                isAccepted: true,
                effectiveDate: new Date('2024-01-01'),
            },
        }),
        prisma.insurancePlan.create({
            data: {
                hospitalId,
                planName: 'Aetna Choice POS II',
                carrierId: 'AETNA-001',
                carrierName: 'Aetna',
                planType: 'POS',
                isAccepted: true,
                effectiveDate: new Date('2024-01-01'),
            },
        }),
        prisma.insurancePlan.create({
            data: {
                hospitalId,
                planName: 'United Healthcare Gold',
                carrierId: 'UHC-001',
                carrierName: 'United Healthcare',
                planType: 'HMO',
                isAccepted: true,
                effectiveDate: new Date('2024-01-01'),
            },
        }),
        prisma.insurancePlan.create({
            data: {
                hospitalId,
                planName: 'Medicare Part B',
                carrierId: 'MEDICARE-001',
                carrierName: 'Medicare',
                planType: 'Medicare',
                isAccepted: true,
                effectiveDate: new Date('2024-01-01'),
            },
        }),
        prisma.insurancePlan.create({
            data: {
                hospitalId,
                planName: 'Ohio Medicaid',
                carrierId: 'MEDICAID-OH',
                carrierName: 'Ohio Medicaid',
                planType: 'Medicaid',
                isAccepted: true,
                effectiveDate: new Date('2024-01-01'),
            },
        }),
    ]);
}

async function createInsuranceVerifications(
    hospitalId: string, 
    insurancePlans: any[], 
    patients: any[]
) {
    const verifications = [];
    
    for (let i = 0; i < patients.length; i++) {
        const plan = insurancePlans[i % insurancePlans.length];
        verifications.push(
            prisma.insuranceVerification.create({
                data: {
                    hospitalId,
                    insurancePlanId: plan.id,
                    patientId: patients[i].id,
                    patientName: patients[i].name,
                    memberNumber: `MEM${String(i + 1).padStart(9, '0')}`,
                    groupNumber: `GRP${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`,
                    verificationDate: subDays(new Date(), Math.floor(Math.random() * 30)),
                    eligibilityStatus: EligibilityStatus.ELIGIBLE,
                    authorizationRequired: Math.random() > 0.7,
                    copay: 25 + Math.floor(Math.random() * 50),
                    deductible: 1000 + Math.floor(Math.random() * 2000),
                    deductibleMet: Math.floor(Math.random() * 1000),
                },
            })
        );
    }

    return await Promise.all(verifications);
}

async function createCallSessions(
    hospitalId: string, 
    phoneNumberId: string, 
    intents: any[], 
    patients: any[]
) {
    const callData = [];

    // Recent calls (last few hours)
    const recentCallScenarios = [
        {
            patient: patients[0],
            intent: intents.find((i: any) => i.key === 'scheduling'),
            status: CallStatus.COMPLETED,
            duration: 252,
            sentiment: 0.85,
            sentimentLabel: SentimentLabel.POSITIVE,
            tag: CallTag.SCHEDULING,
            emergency: false,
            minutesAgo: 2,
        },
        {
            patient: null,
            intent: intents.find((i: any) => i.key === 'clinical-triage'),
            status: CallStatus.ONGOING,
            duration: 90,
            sentiment: 0.35,
            sentimentLabel: SentimentLabel.NEGATIVE,
            tag: CallTag.CLINICAL_ESCALATION,
            emergency: true,
            minutesAgo: 0, // Currently active
        },
        {
            patient: patients[1],
            intent: intents.find((i: any) => i.key === 'billing'),
            status: CallStatus.COMPLETED,
            duration: 165,
            sentiment: 0.60,
            sentimentLabel: SentimentLabel.NEUTRAL,
            tag: CallTag.BILLING_INSURANCE,
            emergency: false,
            minutesAgo: 12,
        },
        {
            patient: patients[2],
            intent: intents.find((i: any) => i.key === 'refill'),
            status: CallStatus.COMPLETED,
            duration: 320,
            sentiment: 0.72,
            sentimentLabel: SentimentLabel.POSITIVE,
            tag: CallTag.REFILL_PRIOR_AUTH,
            emergency: false,
            minutesAgo: 45,
        },
        {
            patient: patients[3],
            intent: null,
            status: CallStatus.ABANDONED,
            duration: 35,
            sentiment: null,
            sentimentLabel: null,
            tag: null,
            emergency: false,
            minutesAgo: 18,
        },
    ];

    for (const scenario of recentCallScenarios) {
        callData.push(scenario);
    }

    // Historical calls (last 7 days)
    const tags = [CallTag.SCHEDULING, CallTag.BILLING_INSURANCE, CallTag.REFILL_PRIOR_AUTH, CallTag.CLINICAL_ESCALATION, CallTag.RECORDS_FORMS];
    const statuses = [CallStatus.COMPLETED, CallStatus.COMPLETED, CallStatus.COMPLETED, CallStatus.ABANDONED];
    const sentiments = [SentimentLabel.POSITIVE, SentimentLabel.NEUTRAL, SentimentLabel.NEGATIVE];

    for (let i = 0; i < 100; i++) {
        const randomPatient = patients[Math.floor(Math.random() * patients.length)];
        const randomIntent = intents[Math.floor(Math.random() * intents.length)];
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
        const randomSentiment = sentiments[Math.floor(Math.random() * sentiments.length)];
        const randomTag = tags[Math.floor(Math.random() * tags.length)];
        const hoursAgo = Math.floor(Math.random() * 168);
        const duration = randomStatus === CallStatus.COMPLETED ? Math.floor(Math.random() * 600) + 30 : Math.floor(Math.random() * 60);
        const sentimentScore = randomStatus === CallStatus.COMPLETED ? Math.random() * 0.8 + 0.2 : null;

        callData.push({
            patient: Math.random() > 0.3 ? randomPatient : null,
            intent: Math.random() > 0.2 ? randomIntent : null,
            status: randomStatus,
            duration,
            sentiment: sentimentScore,
            sentimentLabel: randomStatus === CallStatus.COMPLETED ? randomSentiment : null,
            tag: randomStatus === CallStatus.COMPLETED ? randomTag : null,
            emergency: Math.random() > 0.95,
            hoursAgo,
        });
    }

    for (const [index, data] of callData.entries()) {
        const startedAt = data.minutesAgo !== undefined 
            ? subMinutes(new Date(), data.minutesAgo)
            : subHours(new Date(), data.hoursAgo!);

        const call = await prisma.callSession.create({
            data: {
                hospitalId,
                phoneNumberId,
                twilioCallSid: `CA_test_${index.toString().padStart(5, '0')}_${Date.now()}`,
                direction: CallDirection.INBOUND,
                status: data.status,
                recordingConsent: RecordingConsent.IMPLICIT,
                intentId: data.intent?.id,
                tag: data.tag,
                patientId: data.patient?.id,
                isEmergency: data.emergency,
                startedAt,
                endedAt: data.status !== CallStatus.ONGOING && data.status !== CallStatus.ABANDONED 
                    ? new Date(startedAt.getTime() + data.duration * 1000) 
                    : data.status === CallStatus.ABANDONED 
                    ? new Date(startedAt.getTime() + data.duration * 1000)
                    : null,
                sentimentOverallScore: data.sentiment,
                aiConfidence: data.status === CallStatus.COMPLETED ? 0.85 + Math.random() * 0.1 : null,
            },
        });

        // Add transcript for recent completed calls
        if (data.status === CallStatus.COMPLETED && index < 15) {
            await createTranscript(call.id, data);
        }

        // Add sentiment snapshots
        if (data.sentimentLabel && data.sentiment) {
            await prisma.sentimentSnapshot.create({
                data: {
                    callId: call.id,
                    offsetMs: 2000 + Math.floor(Math.random() * 5000),
                    score: data.sentiment,
                    label: data.sentimentLabel,
                },
            });
        }
    }
}

async function createTranscript(callId: string, data: any) {
    const transcripts = [
        {
            speaker: Speaker.SYSTEM,
            text: 'Thank you for calling Wardline Test Medical Center. If this is a medical emergency, please hang up and call 911. How may I help you today?',
            startTimeMs: 0,
            endTimeMs: 6000,
        },
        {
            speaker: Speaker.CALLER,
            text: data.intent?.displayName 
                ? `Hi, I need help with ${data.intent.displayName.toLowerCase()}.`
                : 'Hi, I need some help please.',
            startTimeMs: 6500,
            endTimeMs: 9000,
        },
        {
            speaker: Speaker.SYSTEM,
            text: 'I\'d be happy to help you with that. Let me get some information from you.',
            startTimeMs: 9500,
            endTimeMs: 13000,
        },
        {
            speaker: Speaker.CALLER,
            text: data.patient?.name ? `My name is ${data.patient.name}.` : 'Sure, go ahead.',
            startTimeMs: 13500,
            endTimeMs: 15500,
        },
        {
            speaker: Speaker.SYSTEM,
            text: 'Thank you. I\'ve found your information. Let me assist you further.',
            startTimeMs: 16000,
            endTimeMs: 20000,
        },
    ];

    await prisma.transcriptSegment.createMany({
        data: transcripts.map((t) => ({
            callId,
            speaker: t.speaker,
            text: t.text,
            startTimeMs: t.startTimeMs,
            endTimeMs: t.endTimeMs,
            confidence: 0.92 + Math.random() * 0.06,
        })),
    });
}

async function createAppointments(hospitalId: string) {
    const appointments = [];
    const providers = ['Dr. Emily Chen', 'Dr. James Wilson', 'Dr. Maria Garcia', 'Dr. Robert Smith'];
    const serviceTypes = ['Annual Physical', 'Follow-up Visit', 'Consultation', 'Wellness Check', 'Lab Work'];
    const statuses = [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED];

    // Future appointments
    for (let i = 0; i < 15; i++) {
        const daysAhead = Math.floor(Math.random() * 30) + 1;
        const hour = 8 + Math.floor(Math.random() * 9);
        
        appointments.push({
            hospitalId,
            provider: 'manual',
            patientName: ['Sarah Johnson', 'Michael Rodriguez', 'Emily Chen', 'Robert Davis', 'Jennifer Wilson'][Math.floor(Math.random() * 5)],
            patientPhone: `+1555${String(Math.floor(Math.random() * 10000000)).padStart(7, '0')}`,
            patientEmail: `patient${i}@example.com`,
            providerName: providers[Math.floor(Math.random() * providers.length)],
            serviceType: serviceTypes[Math.floor(Math.random() * serviceTypes.length)],
            scheduledAt: addDays(addHours(new Date().setHours(hour, 0, 0, 0), 0), daysAhead),
            duration: [15, 30, 45, 60][Math.floor(Math.random() * 4)],
            status: statuses[Math.floor(Math.random() * 2)], // Only scheduled or confirmed for future
        });
    }

    // Past appointments
    for (let i = 0; i < 25; i++) {
        const daysAgo = Math.floor(Math.random() * 30) + 1;
        const hour = 8 + Math.floor(Math.random() * 9);
        
        appointments.push({
            hospitalId,
            provider: 'manual',
            patientName: ['Sarah Johnson', 'Michael Rodriguez', 'Emily Chen', 'Robert Davis', 'Jennifer Wilson'][Math.floor(Math.random() * 5)],
            patientPhone: `+1555${String(Math.floor(Math.random() * 10000000)).padStart(7, '0')}`,
            patientEmail: `patient${i + 15}@example.com`,
            providerName: providers[Math.floor(Math.random() * providers.length)],
            serviceType: serviceTypes[Math.floor(Math.random() * serviceTypes.length)],
            scheduledAt: subDays(new Date().setHours(hour, 0, 0, 0), daysAgo),
            duration: [15, 30, 45, 60][Math.floor(Math.random() * 4)],
            status: AppointmentStatus.COMPLETED,
        });
    }

    await prisma.appointment.createMany({ data: appointments });
}

async function createPrescriptionRefills(hospitalId: string, patients: any[]) {
    const medications = [
        'Lisinopril 10mg',
        'Metformin 500mg',
        'Atorvastatin 20mg',
        'Omeprazole 20mg',
        'Amlodipine 5mg',
        'Levothyroxine 50mcg',
        'Gabapentin 300mg',
        'Sertraline 50mg',
    ];
    const pharmacies = ['CVS Pharmacy', 'Walgreens', 'Kroger Pharmacy', 'Rite Aid', 'Walmart Pharmacy'];
    const prescribers = ['Dr. Chen', 'Dr. Wilson', 'Dr. Garcia', 'Dr. Smith'];
    const statuses = [RefillStatus.PENDING, RefillStatus.APPROVED, RefillStatus.COMPLETED, RefillStatus.REJECTED];

    const refills = [];
    for (let i = 0; i < 30; i++) {
        const patient = patients[Math.floor(Math.random() * patients.length)];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        
        refills.push({
            hospitalId,
            patientId: patient.id,
            patientName: patient.name,
            patientPhone: patient.primaryPhone || '+15551234567',
            patientDOB: patient.dob,
            medicationName: medications[Math.floor(Math.random() * medications.length)],
            prescriberName: prescribers[Math.floor(Math.random() * prescribers.length)],
            pharmacyName: pharmacies[Math.floor(Math.random() * pharmacies.length)],
            pharmacyPhone: `+1513${String(Math.floor(Math.random() * 10000000)).padStart(7, '0')}`,
            status,
            verificationStatus: status === RefillStatus.APPROVED || status === RefillStatus.COMPLETED 
                ? VerificationStatus.VERIFIED 
                : VerificationStatus.UNVERIFIED,
            isNewPatient: Math.random() > 0.9,
            createdAt: subDays(new Date(), Math.floor(Math.random() * 14)),
            rejectionReason: status === RefillStatus.REJECTED ? 'Requires provider review before refill' : null,
        });
    }

    await prisma.prescriptionRefill.createMany({ data: refills });
}

async function createMarketingEvents(hospitalId: string, patients: any[]) {
    const events = [
        {
            title: 'Heart Health Seminar',
            description: 'Join us for an informative session on cardiovascular health, prevention strategies, and lifestyle modifications for a healthy heart.',
            eventType: EventType.SEMINAR,
            specialty: 'Cardiology',
            presenter: 'Dr. James Wilson',
            location: 'Community Health Center',
            isVirtual: false,
            scheduledAt: addDays(new Date(), 7),
            duration: 90,
            capacity: 50,
            status: EventStatus.UPCOMING,
        },
        {
            title: 'Diabetes Management Workshop',
            description: 'Interactive workshop covering blood sugar monitoring, nutrition, exercise, and medication management for diabetes patients.',
            eventType: EventType.WORKSHOP,
            specialty: 'Endocrinology',
            presenter: 'Dr. Maria Garcia',
            location: null,
            isVirtual: true,
            virtualLink: 'https://zoom.us/j/example',
            scheduledAt: addDays(new Date(), 14),
            duration: 120,
            capacity: 100,
            status: EventStatus.UPCOMING,
        },
        {
            title: 'Free Blood Pressure Screening',
            description: 'Get your blood pressure checked for free and speak with our healthcare professionals about maintaining healthy levels.',
            eventType: EventType.SCREENING,
            specialty: null,
            presenter: null,
            location: 'Hospital Main Lobby',
            isVirtual: false,
            scheduledAt: addDays(new Date(), 3),
            duration: 180,
            capacity: null,
            status: EventStatus.UPCOMING,
        },
        {
            title: 'Annual Health Fair',
            description: 'Our biggest community event featuring health screenings, wellness resources, educational booths, and family activities.',
            eventType: EventType.HEALTH_FAIR,
            specialty: null,
            presenter: null,
            location: 'Community Park Pavilion',
            isVirtual: false,
            scheduledAt: addDays(new Date(), 21),
            duration: 360,
            capacity: 500,
            status: EventStatus.UPCOMING,
        },
        {
            title: 'Nutrition & Healthy Eating Class',
            description: 'Learn practical tips for meal planning, reading nutrition labels, and making healthier food choices.',
            eventType: EventType.CLASS,
            specialty: 'Nutrition',
            presenter: 'Sarah Miller, RD',
            location: 'Conference Room B',
            isVirtual: false,
            scheduledAt: subDays(new Date(), 7),
            duration: 60,
            capacity: 25,
            status: EventStatus.COMPLETED,
        },
    ];

    for (const eventData of events) {
        const event = await prisma.marketingEvent.create({
            data: {
                hospitalId,
                ...eventData,
                registrationDeadline: subDays(eventData.scheduledAt, 1),
            },
        });

        // Add some registrations for each event
        const numRegistrations = Math.floor(Math.random() * 10) + 3;
        for (let i = 0; i < numRegistrations; i++) {
            const patient = patients[Math.floor(Math.random() * patients.length)];
            await prisma.eventRegistration.create({
                data: {
                    eventId: event.id,
                    patientId: Math.random() > 0.5 ? patient.id : null,
                    attendeeName: patient.name || `Attendee ${i + 1}`,
                    attendeePhone: patient.primaryPhone || `+1555${String(Math.floor(Math.random() * 10000000)).padStart(7, '0')}`,
                    attendeeEmail: `attendee${i}@example.com`,
                    status: eventData.status === EventStatus.COMPLETED 
                        ? (Math.random() > 0.2 ? RegistrationStatus.REGISTERED : RegistrationStatus.NO_SHOW)
                        : RegistrationStatus.REGISTERED,
                    attended: eventData.status === EventStatus.COMPLETED ? Math.random() > 0.2 : null,
                    becamePatient: eventData.status === EventStatus.COMPLETED && Math.random() > 0.7,
                },
            });
        }
    }
}

async function createDirectoryInquiries(hospitalId: string, departments: any[]) {
    const inquiries = [];
    const serviceTypes = ['X-Ray', 'Blood Work', 'Cardiology Consultation', 'Physical Therapy', 'Pharmacy'];

    for (let i = 0; i < 20; i++) {
        const department = departments[Math.floor(Math.random() * departments.length)];
        inquiries.push({
            hospitalId,
            departmentId: Math.random() > 0.3 ? department.id : null,
            serviceType: serviceTypes[Math.floor(Math.random() * serviceTypes.length)],
            patientName: Math.random() > 0.5 ? ['John Smith', 'Jane Doe', 'Mike Johnson'][Math.floor(Math.random() * 3)] : null,
            patientPhone: Math.random() > 0.5 ? `+1555${String(Math.floor(Math.random() * 10000000)).padStart(7, '0')}` : null,
            resolved: Math.random() > 0.3,
            notes: Math.random() > 0.7 ? 'Caller was transferred to the appropriate department.' : null,
            createdAt: subDays(new Date(), Math.floor(Math.random() * 14)),
        });
    }

    await prisma.directoryInquiry.createMany({ data: inquiries });
}

function printSummary(hospital: any, users: any, phoneNumber: any) {
    console.log('\n' + '='.repeat(70));
    console.log('🎉 TEST DATA SEEDED SUCCESSFULLY!');
    console.log('='.repeat(70));
    
    console.log('\n📊 Database Summary:');
    console.log(`   Hospital: ${hospital.name}`);
    console.log(`   Hospital ID: ${hospital.id}`);
    
    console.log('\n📞 Twilio Phone Number Configured:');
    console.log(`   Number: ${phoneNumber.twilioPhoneNumber} (${phoneNumber.label})`);
    console.log(`   SID: ${phoneNumber.twilioSid}`);
    
    console.log('\n' + '-'.repeat(70));
    console.log('🔐 TEST CREDENTIALS');
    console.log('-'.repeat(70));
    
    console.log('\n1️⃣  PATIENT DASHBOARD (/patient)');
    console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Email:         ${TEST_USERS.patient.email}`);
    console.log(`   Clerk User ID: ${TEST_USERS.patient.clerkUserId}`);
    console.log(`   Full Name:     ${TEST_USERS.patient.fullName}`);
    console.log('   Clerk Metadata Role: patient');
    
    console.log('\n2️⃣  CALL CENTER DASHBOARD (/dashboard, /admin/call-center)');
    console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Email:         ${TEST_USERS.callCenter.email}`);
    console.log(`   Clerk User ID: ${TEST_USERS.callCenter.clerkUserId}`);
    console.log(`   Full Name:     ${TEST_USERS.callCenter.fullName}`);
    console.log('   Clerk Metadata Role: admin');
    
    console.log('\n3️⃣  SYSTEM ADMIN DASHBOARD (/admin/system)');
    console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Email:         ${TEST_USERS.systemAdmin.email}`);
    console.log(`   Clerk User ID: ${TEST_USERS.systemAdmin.clerkUserId}`);
    console.log(`   Full Name:     ${TEST_USERS.systemAdmin.fullName}`);
    console.log('   Clerk Metadata Role: system_admin');
    
    console.log('\n' + '-'.repeat(70));
    console.log('⚙️  CLERK SETUP INSTRUCTIONS');
    console.log('-'.repeat(70));
    console.log(`
1. Go to your Clerk Dashboard (https://dashboard.clerk.com)

2. For each test user, create a new user with the email above, then:
   - Go to the user's profile
   - Click on "Metadata"
   - Add this to "Public metadata":
     {
       "role": "<role_from_above>"
     }

3. After creating users, get their Clerk User IDs and update:
   - Update the clerkUserId values in this seed file
   - Re-run the seed: pnpm db:seed:test

OR use Clerk's test mode to sign in with these emails directly.
`);

    console.log('-'.repeat(70));
    console.log('📞 TWILIO VOICE ORCHESTRATION SETUP');
    console.log('-'.repeat(70));
    console.log(`
1. Configure your Twilio phone number (513) 951-1583:
   - Go to Twilio Console → Phone Numbers → Active Numbers
   - Click on +1 513-951-1583
   - Under "Voice & Fax" → "A CALL COMES IN":
     - Set to Webhook
     - URL: https://<your-voice-orchestrator-url>/voice/incoming
     - HTTP Method: POST
   
2. Set Status Callback URL:
   - URL: https://<your-voice-orchestrator-url>/voice/status
   - HTTP Method: POST

3. For local testing, use ngrok:
   - Run: ngrok http 3002
   - Use the ngrok URL in Twilio
`);

    console.log('-'.repeat(70));
    console.log('🚀 NEXT STEPS');
    console.log('-'.repeat(70));
    console.log(`
1. Set hospital ID in browser:
   localStorage.setItem('selectedHospitalId', '${hospital.id}')

2. Start the apps:
   pnpm dev

3. Test voice orchestration:
   Call (513) 951-1583 from your phone!

4. Access dashboards:
   - Patient Portal: http://localhost:3000/patient
   - Call Center: http://localhost:3000/dashboard
   - System Admin: http://localhost:3000/admin/system
`);
    
    console.log('='.repeat(70) + '\n');
}

main()
    .catch((e) => {
        console.error('❌ Error seeding database:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

