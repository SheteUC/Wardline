import { PrismaClient, UserRole, AgentType, AgentStatus, AgentSessionStatus } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Voice AI Test Data Seeder
 * 
 * Creates test data for 4 voice AI testing scenarios:
 * 1. Appointment Scheduling - Patient books an appointment
 * 2. Prescription Refill - Patient requests medication refill  
 * 3. Insurance Verification - Patient checks if insurance is accepted
 * 4. Department Routing - Patient needs to reach specific department
 * 
 * IMPORTANT: This uses YOUR Twilio phone number: +15139511583
 */

async function main() {
    console.log('🌱 Starting Voice AI Test Data Seed...');
    console.log('');

    // =========================================================================
    // STEP 1: Create Hospital with YOUR Twilio Phone Number
    // =========================================================================
    console.log('🏥 Creating Wardline Medical Center...');
    
    // Check if hospital already exists
    let hospital = await prisma.hospital.findFirst({
        where: { slug: 'wardline-medical' }
    });

    if (!hospital) {
        hospital = await prisma.hospital.create({
            data: {
                name: 'Wardline Medical Center',
                slug: 'wardline-medical',
                timeZone: 'America/New_York',
                status: 'ACTIVE',
            },
        });
        console.log(`   ✅ Created hospital: ${hospital.name}`);
    } else {
        console.log(`   ℹ️  Hospital already exists: ${hospital.name}`);
    }

    // Create Hospital Settings
    const existingSettings = await prisma.hospitalSettings.findUnique({
        where: { hospitalId: hospital.id }
    });
    
    if (!existingSettings) {
        await prisma.hospitalSettings.create({
            data: {
                hospitalId: hospital.id,
                recordingDefault: 'ON',
                transcriptRetentionDays: 30,
                e911Enabled: true,
            },
        });
    }

    // =========================================================================
    // STEP 2: Create Phone Number (YOUR ACTUAL TWILIO NUMBER)
    // =========================================================================
    console.log('📞 Creating phone number mapping...');
    
    let phoneNumber = await prisma.phoneNumber.findFirst({
        where: { twilioPhoneNumber: '+15139511583' }
    });

    if (!phoneNumber) {
        phoneNumber = await prisma.phoneNumber.create({
            data: {
                hospitalId: hospital.id,
                twilioPhoneNumber: '+15139511583',  // YOUR ACTUAL TWILIO NUMBER
                twilioSid: 'PN_wardline_main',
                label: 'Main Line',
            },
        });
        console.log(`   ✅ Created phone number: +15139511583`);
    } else {
        console.log(`   ℹ️  Phone number already exists: +15139511583`);
    }

    // =========================================================================
    // STEP 3: Create Departments (for Department Routing scenario)
    // =========================================================================
    console.log('🏢 Creating departments...');
    
    const departmentData = [
        {
            name: 'Radiology',
            description: 'X-Ray, MRI, CT Scan, and other imaging services',
            serviceTypes: ['X-Ray', 'MRI', 'CT Scan', 'Ultrasound', 'Mammography'],
            phoneNumber: '+15139511584',
            extension: '2001',
            location: 'Building A, 2nd Floor',
            hoursOfOperation: { weekdays: '7:00 AM - 6:00 PM', weekends: '8:00 AM - 2:00 PM' },
        },
        {
            name: 'Billing & Insurance',
            description: 'Payment processing, insurance claims, and financial assistance',
            serviceTypes: ['Billing Questions', 'Insurance Claims', 'Payment Plans', 'Financial Assistance'],
            phoneNumber: '+15139511585',
            extension: '3001',
            location: 'Building B, 1st Floor',
            hoursOfOperation: { weekdays: '8:00 AM - 5:00 PM', weekends: 'Closed' },
        },
        {
            name: 'Pharmacy',
            description: 'Prescription services, medication consultation',
            serviceTypes: ['Prescriptions', 'Refills', 'Medication Consultation', 'Immunizations'],
            phoneNumber: '+15139511586',
            extension: '4001',
            location: 'Building A, 1st Floor',
            hoursOfOperation: { weekdays: '8:00 AM - 8:00 PM', weekends: '9:00 AM - 5:00 PM' },
        },
        {
            name: 'Primary Care',
            description: 'General health check-ups, preventive care, chronic disease management',
            serviceTypes: ['Annual Physical', 'Sick Visit', 'Follow-up', 'Preventive Care'],
            phoneNumber: '+15139511587',
            extension: '5001',
            location: 'Building C, 1st Floor',
            hoursOfOperation: { weekdays: '8:00 AM - 5:00 PM', weekends: 'Closed' },
        },
        {
            name: 'Cardiology',
            description: 'Heart health specialists',
            serviceTypes: ['EKG', 'Echocardiogram', 'Stress Test', 'Heart Consultation'],
            phoneNumber: '+15139511588',
            extension: '6001',
            location: 'Building A, 3rd Floor',
            hoursOfOperation: { weekdays: '8:00 AM - 5:00 PM', weekends: 'Closed' },
        },
        {
            name: 'Medical Records',
            description: 'Patient records requests and releases',
            serviceTypes: ['Record Requests', 'Record Releases', 'Medical History'],
            phoneNumber: '+15139511589',
            extension: '7001',
            location: 'Building B, 2nd Floor',
            hoursOfOperation: { weekdays: '9:00 AM - 4:00 PM', weekends: 'Closed' },
        },
    ];

    for (const dept of departmentData) {
        const existing = await prisma.department.findFirst({
            where: { hospitalId: hospital.id, name: dept.name }
        });
        
        if (!existing) {
            await prisma.department.create({
                data: {
                    hospitalId: hospital.id,
                    ...dept,
                },
            });
            console.log(`   ✅ Created department: ${dept.name}`);
        }
    }

    // =========================================================================
    // STEP 4: Create Insurance Plans (for Insurance Verification scenario)
    // =========================================================================
    console.log('💳 Creating insurance plans...');
    
    const insurancePlans = [
        { planName: 'Blue Cross Blue Shield PPO', carrierId: 'BCBS001', carrierName: 'Blue Cross Blue Shield', planType: 'PPO', isAccepted: true },
        { planName: 'Blue Cross Blue Shield HMO', carrierId: 'BCBS002', carrierName: 'Blue Cross Blue Shield', planType: 'HMO', isAccepted: true },
        { planName: 'Aetna PPO', carrierId: 'AETNA001', carrierName: 'Aetna', planType: 'PPO', isAccepted: true },
        { planName: 'Aetna HMO', carrierId: 'AETNA002', carrierName: 'Aetna', planType: 'HMO', isAccepted: true },
        { planName: 'UnitedHealthcare Choice Plus', carrierId: 'UHC001', carrierName: 'UnitedHealthcare', planType: 'PPO', isAccepted: true },
        { planName: 'Cigna Open Access Plus', carrierId: 'CIGNA001', carrierName: 'Cigna', planType: 'PPO', isAccepted: true },
        { planName: 'Humana Gold Plus', carrierId: 'HUMANA001', carrierName: 'Humana', planType: 'HMO', isAccepted: true },
        { planName: 'Kaiser Permanente', carrierId: 'KAISER001', carrierName: 'Kaiser Permanente', planType: 'HMO', isAccepted: false },  // NOT ACCEPTED
        { planName: 'Medicare Part A', carrierId: 'MEDICARE001', carrierName: 'Medicare', planType: 'Government', isAccepted: true },
        { planName: 'Medicare Part B', carrierId: 'MEDICARE002', carrierName: 'Medicare', planType: 'Government', isAccepted: true },
        { planName: 'Medicaid', carrierId: 'MEDICAID001', carrierName: 'Medicaid', planType: 'Government', isAccepted: true },
        { planName: 'Tricare Prime', carrierId: 'TRICARE001', carrierName: 'Tricare', planType: 'Government', isAccepted: true },
    ];

    for (const plan of insurancePlans) {
        const existing = await prisma.insurancePlan.findFirst({
            where: { hospitalId: hospital.id, carrierId: plan.carrierId }
        });
        
        if (!existing) {
            await prisma.insurancePlan.create({
                data: {
                    hospitalId: hospital.id,
                    ...plan,
                },
            });
            console.log(`   ✅ Created insurance plan: ${plan.planName} (${plan.isAccepted ? 'Accepted' : 'NOT Accepted'})`);
        }
    }

    // =========================================================================
    // STEP 5: Create Intents (for AI understanding)
    // =========================================================================
    console.log('🎯 Creating intents...');
    
    const intentData = [
        {
            key: 'scheduling',
            displayName: 'Appointment Scheduling',
            description: 'Patient wants to schedule, reschedule, or cancel an appointment',
            requiredFields: [
                { key: 'patientName', label: 'Patient Name', type: 'text', required: true },
                { key: 'patientDOB', label: 'Date of Birth', type: 'date', required: true },
                { key: 'preferredDate', label: 'Preferred Date', type: 'date', required: true },
                { key: 'reason', label: 'Reason for Visit', type: 'text', required: true },
            ],
        },
        {
            key: 'refill',
            displayName: 'Prescription Refill',
            description: 'Patient needs a medication refill',
            requiredFields: [
                { key: 'patientName', label: 'Patient Name', type: 'text', required: true },
                { key: 'patientDOB', label: 'Date of Birth', type: 'date', required: true },
                { key: 'medication', label: 'Medication Name', type: 'text', required: true },
                { key: 'pharmacy', label: 'Pharmacy Name', type: 'text', required: true },
            ],
        },
        {
            key: 'insurance',
            displayName: 'Insurance Inquiry',
            description: 'Patient wants to verify if their insurance is accepted',
            requiredFields: [
                { key: 'insuranceCarrier', label: 'Insurance Carrier', type: 'text', required: true },
            ],
        },
        {
            key: 'billing',
            displayName: 'Billing Question',
            description: 'Patient has questions about their bill or payment',
            requiredFields: [],
        },
        {
            key: 'department',
            displayName: 'Department Routing',
            description: 'Patient needs to be connected to a specific department',
            requiredFields: [
                { key: 'department', label: 'Department Name', type: 'text', required: true },
            ],
        },
        {
            key: 'clinical-triage',
            displayName: 'Clinical Triage',
            description: 'Patient has symptoms or health concerns requiring clinical assessment',
            requiredFields: [],
        },
    ];

    for (const intent of intentData) {
        const existing = await prisma.intent.findFirst({
            where: { hospitalId: hospital.id, key: intent.key }
        });
        
        if (!existing) {
            await prisma.intent.create({
                data: {
                    hospitalId: hospital.id,
                    key: intent.key,
                    displayName: intent.displayName,
                    description: intent.description,
                    enabled: true,
                    requiredFields: intent.requiredFields,
                    routingRules: [],
                },
            });
            console.log(`   ✅ Created intent: ${intent.displayName}`);
        }
    }

    // =========================================================================
    // STEP 6: Create Test Patients (for scenarios)
    // =========================================================================
    console.log('🩺 Creating test patients...');
    
    const patientData = [
        { externalId: 'MRN-TEST-001', name: 'John Smith', dob: new Date('1980-05-15'), primaryPhone: '+15139138031' },  // Your phone number
        { externalId: 'MRN-TEST-002', name: 'Sarah Johnson', dob: new Date('1975-08-22'), primaryPhone: '+15551234567' },
        { externalId: 'MRN-TEST-003', name: 'Michael Chen', dob: new Date('1990-03-10'), primaryPhone: '+15559876543' },
        { externalId: 'MRN-TEST-004', name: 'Emily Davis', dob: new Date('1985-12-01'), primaryPhone: '+15553456789' },
    ];

    for (const patient of patientData) {
        const existing = await prisma.patient.findFirst({
            where: { hospitalId: hospital.id, externalId: patient.externalId }
        });
        
        if (!existing) {
            await prisma.patient.create({
                data: {
                    hospitalId: hospital.id,
                    ...patient,
                },
            });
            console.log(`   ✅ Created patient: ${patient.name}`);
        }
    }

    // =========================================================================
    // STEP 7: Create AI Agents
    // =========================================================================
    console.log('🤖 Creating AI agents...');
    
    const aiAgentData = [
        {
            type: AgentType.AI,
            name: 'Scheduling Assistant',
            description: 'AI agent specialized in appointment scheduling',
            aiConfig: {
                persona: 'Friendly and efficient scheduling assistant',
                systemPrompt: 'You are a helpful scheduling assistant at Wardline Medical Center. Help patients book, reschedule, or cancel appointments.',
                capabilities: ['schedule_appointments', 'reschedule_appointments', 'cancel_appointments'],
                escalationRules: [
                    { condition: { type: 'keyword', value: 'urgent', operator: 'contains' }, action: { type: 'route_to_queue', target: 'clinical' }, priority: 1 }
                ],
                maxInteractions: 10,
            },
        },
        {
            type: AgentType.AI,
            name: 'Prescription Assistant',
            description: 'AI agent for prescription refill requests',
            aiConfig: {
                persona: 'Helpful pharmacy assistant',
                systemPrompt: 'You are a pharmacy assistant at Wardline Medical Center. Help patients with prescription refill requests.',
                capabilities: ['prescription_refills', 'pharmacy_info'],
                escalationRules: [
                    { condition: { type: 'keyword', value: 'controlled substance', operator: 'contains' }, action: { type: 'route_to_queue', target: 'clinical' }, priority: 1 }
                ],
                maxInteractions: 8,
            },
        },
        {
            type: AgentType.AI,
            name: 'Insurance Verifier',
            description: 'AI agent for insurance verification',
            aiConfig: {
                persona: 'Knowledgeable insurance specialist',
                systemPrompt: 'You are an insurance specialist at Wardline Medical Center. Help patients verify if their insurance is accepted.',
                capabilities: ['verify_insurance', 'billing_info'],
                escalationRules: [],
                maxInteractions: 5,
            },
        },
    ];

    for (const agent of aiAgentData) {
        const existing = await prisma.agent.findFirst({
            where: { hospitalId: hospital.id, name: agent.name }
        });
        
        if (!existing) {
            await prisma.agent.create({
                data: {
                    hospitalId: hospital.id,
                    type: agent.type,
                    name: agent.name,
                    description: agent.description,
                    status: AgentStatus.ACTIVE,
                    aiConfig: agent.aiConfig,
                },
            });
            console.log(`   ✅ Created AI agent: ${agent.name}`);
        }
    }

    // =========================================================================
    // STEP 8: Create Human Agents
    // =========================================================================
    console.log('👤 Creating human agents...');
    
    // First create users
    const userEmails = [
        { email: 'nurse.johnson@wardline.com', name: 'Nurse Sarah Johnson', role: UserRole.AGENT },
        { email: 'dr.chen@wardline.com', name: 'Dr. Robert Chen', role: UserRole.ADMIN },
        { email: 'billing.smith@wardline.com', name: 'Jennifer Smith', role: UserRole.AGENT },
    ];

    for (const userData of userEmails) {
        let user = await prisma.user.findFirst({ where: { email: userData.email } });
        
        if (!user) {
            user = await prisma.user.create({
                data: {
                    clerkUserId: `clerk_${userData.email.replace('@', '_')}`,
                    email: userData.email,
                    fullName: userData.name,
                },
            });
            
            // Link to hospital
            await prisma.hospitalUser.create({
                data: { hospitalId: hospital.id, userId: user.id, role: userData.role },
            });
        }

        // Create human agent
        const existingAgent = await prisma.agent.findFirst({
            where: { hospitalId: hospital.id, name: userData.name }
        });

        if (!existingAgent) {
            const agent = await prisma.agent.create({
                data: {
                    hospitalId: hospital.id,
                    type: AgentType.HUMAN,
                    name: userData.name,
                    description: `Human agent - ${userData.role}`,
                    status: AgentStatus.ACTIVE,
                    humanProfile: {
                        userId: user.id,
                        specialization: userData.role === UserRole.ADMIN ? ['clinical', 'triage'] : ['billing', 'general'],
                        skills: ['customer_service', 'medical_knowledge'],
                        availability: {
                            timezone: 'America/New_York',
                            schedule: [
                                { dayOfWeek: 1, startTime: '08:00', endTime: '17:00' },
                                { dayOfWeek: 2, startTime: '08:00', endTime: '17:00' },
                                { dayOfWeek: 3, startTime: '08:00', endTime: '17:00' },
                                { dayOfWeek: 4, startTime: '08:00', endTime: '17:00' },
                                { dayOfWeek: 5, startTime: '08:00', endTime: '17:00' },
                            ],
                        },
                        maxConcurrentCalls: 3,
                        contactInfo: { phone: '+15551234567' },
                        notificationPreferences: { inApp: true, sms: true, email: false },
                    },
                },
            });

            // Create online session for testing
            await prisma.agentSession.create({
                data: {
                    agentId: agent.id,
                    status: AgentSessionStatus.ONLINE,
                },
            });

            console.log(`   ✅ Created human agent: ${userData.name} (ONLINE)`);
        }
    }

    // =========================================================================
    // STEP 9: Create Call Queues
    // =========================================================================
    console.log('📋 Creating call queues...');
    
    const queueData = [
        { name: 'Scheduling Queue', specialization: 'scheduling', priority: 1, maxWaitTime: 120 },
        { name: 'Clinical Queue', specialization: 'clinical', priority: 2, maxWaitTime: 60 },
        { name: 'Billing Queue', specialization: 'billing', priority: 1, maxWaitTime: 180 },
        { name: 'General Queue', specialization: 'general', priority: 0, maxWaitTime: 300 },
    ];

    for (const queue of queueData) {
        const existing = await prisma.callQueue.findFirst({
            where: { hospitalId: hospital.id, name: queue.name }
        });
        
        if (!existing) {
            await prisma.callQueue.create({
                data: {
                    hospitalId: hospital.id,
                    ...queue,
                },
            });
            console.log(`   ✅ Created queue: ${queue.name}`);
        }
    }

    // =========================================================================
    // SUMMARY
    // =========================================================================
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✅ Voice AI Test Data Seeded Successfully!');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('📊 Summary:');
    console.log(`   Hospital ID: ${hospital.id}`);
    console.log(`   Hospital Name: ${hospital.name}`);
    console.log(`   Phone Number: +15139511583 (YOUR TWILIO NUMBER)`);
    console.log('');
    console.log('🧪 Test Scenarios:');
    console.log('');
    console.log('   1. APPOINTMENT SCHEDULING');
    console.log('      Say: "I need to schedule an appointment"');
    console.log('      AI will collect: name, DOB, preferred date, reason');
    console.log('');
    console.log('   2. PRESCRIPTION REFILL');
    console.log('      Say: "I need a refill for my medication"');
    console.log('      AI will collect: name, DOB, medication, pharmacy');
    console.log('');
    console.log('   3. INSURANCE VERIFICATION');
    console.log('      Say: "Do you accept Blue Cross insurance?"');
    console.log('      AI will check database and respond (ACCEPTED)');
    console.log('      Try: "Do you accept Kaiser?" (NOT ACCEPTED)');
    console.log('');
    console.log('   4. DEPARTMENT ROUTING');
    console.log('      Say: "I need to speak to radiology"');
    console.log('      AI will provide department info and offer transfer');
    console.log('');
    console.log('💡 To set hospital in frontend:');
    console.log(`   localStorage.setItem('selectedHospitalId', '${hospital.id}')`);
    console.log('');
    console.log('🔄 Restart the Voice Orchestrator to pick up new data!');
    console.log('═══════════════════════════════════════════════════════════════');
}

main()
    .catch((e) => {
        console.error('❌ Error seeding database:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
