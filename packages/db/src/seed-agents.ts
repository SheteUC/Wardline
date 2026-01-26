import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedAgentsAndQueues() {
    console.log('🤖 Seeding Multi-Agent Platform data...');

    // Get the first hospital (should exist from main seed)
    const hospital = await prisma.hospital.findFirst();
    
    if (!hospital) {
        console.error('❌ No hospital found. Please run the main seed first: npx ts-node src/seed.ts');
        process.exit(1);
    }

    console.log(`📍 Using hospital: ${hospital.name} (${hospital.id})`);

    // Clean existing agent data
    console.log('🧹 Cleaning existing agent data...');
    await prisma.agentSession.deleteMany();
    await prisma.callAssignment.deleteMany();
    await prisma.callQueue.deleteMany();
    await prisma.agent.deleteMany();

    // Create AI Agents
    console.log('🤖 Creating AI Agents...');
    const aiAgents = await Promise.all([
        prisma.agent.create({
            data: {
                hospitalId: hospital.id,
                type: 'AI',
                name: 'Scheduling Assistant',
                description: 'AI agent specialized in appointment scheduling and rescheduling',
                status: 'ACTIVE',
                aiConfig: {
                    persona: 'Friendly and efficient scheduling assistant',
                    systemPrompt: 'You are a helpful medical scheduling assistant. Help patients schedule, reschedule, or cancel appointments. Always verify patient identity and collect necessary information.',
                    capabilities: ['schedule_appointments', 'reschedule_appointments', 'cancel_appointments', 'check_availability'],
                    escalationRules: [
                        {
                            condition: { type: 'keyword', value: 'emergency', operator: 'contains' },
                            action: { type: 'route_to_queue', target: 'clinical' },
                            priority: 1
                        },
                        {
                            condition: { type: 'keyword', value: 'urgent', operator: 'contains' },
                            action: { type: 'route_to_queue', target: 'clinical' },
                            priority: 2
                        }
                    ],
                    maxInteractions: 15,
                    voiceConfig: {
                        voiceId: 'alloy',
                        speed: 1.0,
                        pitch: 1.0
                    }
                },
            },
        }),
        prisma.agent.create({
            data: {
                hospitalId: hospital.id,
                type: 'AI',
                name: 'Billing Inquiries',
                description: 'AI agent for handling billing questions and payment arrangements',
                status: 'ACTIVE',
                aiConfig: {
                    persona: 'Professional and helpful billing specialist',
                    systemPrompt: 'You are a billing assistant. Help patients understand their bills, set up payment plans, and answer insurance questions. Never provide specific medical advice.',
                    capabilities: ['explain_charges', 'payment_plans', 'insurance_verification', 'send_statements'],
                    escalationRules: [
                        {
                            condition: { type: 'sentiment', value: 'negative', operator: 'equals' },
                            action: { type: 'route_to_queue', target: 'admin' },
                            priority: 1
                        }
                    ],
                    maxInteractions: 20,
                },
            },
        }),
        prisma.agent.create({
            data: {
                hospitalId: hospital.id,
                type: 'AI',
                name: 'General Inquiries',
                description: 'AI agent for general questions and call routing',
                status: 'ACTIVE',
                aiConfig: {
                    persona: 'Warm and welcoming receptionist',
                    systemPrompt: 'You are the first point of contact for callers. Help with general questions, direct callers to the right department, and collect initial information. Be warm and professional.',
                    capabilities: ['answer_questions', 'route_calls', 'collect_info', 'hours_and_locations'],
                    escalationRules: [
                        {
                            condition: { type: 'intent', value: 'medical_advice', operator: 'equals' },
                            action: { type: 'route_to_queue', target: 'clinical' },
                            priority: 1
                        }
                    ],
                    maxInteractions: 10,
                },
            },
        }),
    ]);

    console.log(`✅ Created ${aiAgents.length} AI agents`);

    // Create Human Agents
    console.log('👤 Creating Human Agents...');
    const humanAgents = await Promise.all([
        prisma.agent.create({
            data: {
                hospitalId: hospital.id,
                type: 'HUMAN',
                name: 'Dr. Sarah Johnson',
                description: 'Senior Clinical Staff - Emergency and Triage',
                status: 'ACTIVE',
                humanProfile: {
                    userId: 'user_demo_supervisor',
                    specialization: ['clinical', 'triage', 'emergency'],
                    skills: ['emergency_response', 'patient_assessment', 'medical_triage', 'spanish_speaking'],
                    availability: {
                        timezone: 'America/New_York',
                        schedule: [
                            { dayOfWeek: 1, startTime: '08:00', endTime: '16:00' },
                            { dayOfWeek: 2, startTime: '08:00', endTime: '16:00' },
                            { dayOfWeek: 3, startTime: '08:00', endTime: '16:00' },
                            { dayOfWeek: 4, startTime: '08:00', endTime: '16:00' },
                            { dayOfWeek: 5, startTime: '08:00', endTime: '16:00' },
                        ],
                        breaks: [
                            { startTime: '12:00', endTime: '13:00', type: 'lunch' }
                        ]
                    },
                    maxConcurrentCalls: 3,
                    contactInfo: {
                        phone: '+1-555-0101',
                        email: 'sarah.johnson@stmarys.hospital'
                    },
                    notificationPreferences: {
                        inApp: true,
                        sms: true,
                        email: false
                    }
                },
            },
        }),
        prisma.agent.create({
            data: {
                hospitalId: hospital.id,
                type: 'HUMAN',
                name: 'Michael Chen',
                description: 'General Administration Staff',
                status: 'ACTIVE',
                humanProfile: {
                    userId: 'user_demo_agent',
                    specialization: ['admin', 'scheduling', 'general'],
                    skills: ['customer_service', 'appointment_management', 'data_entry', 'mandarin_speaking'],
                    availability: {
                        timezone: 'America/New_York',
                        schedule: [
                            { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
                            { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
                            { dayOfWeek: 3, startTime: '09:00', endTime: '17:00' },
                            { dayOfWeek: 4, startTime: '09:00', endTime: '17:00' },
                            { dayOfWeek: 5, startTime: '09:00', endTime: '17:00' },
                        ],
                    },
                    maxConcurrentCalls: 5,
                    contactInfo: {
                        phone: '+1-555-0102',
                        email: 'michael.chen@stmarys.hospital'
                    },
                    notificationPreferences: {
                        inApp: true,
                        sms: false,
                        email: true
                    }
                },
            },
        }),
        prisma.agent.create({
            data: {
                hospitalId: hospital.id,
                type: 'HUMAN',
                name: 'Emily Rodriguez',
                description: 'On-Call Representative - After Hours',
                status: 'ACTIVE',
                humanProfile: {
                    userId: 'user_demo_oncall',
                    specialization: ['oncall', 'urgent', 'afterhours'],
                    skills: ['emergency_protocols', 'paging_system', 'triage_screening'],
                    availability: {
                        timezone: 'America/New_York',
                        schedule: [
                            { dayOfWeek: 1, startTime: '17:00', endTime: '23:00' },
                            { dayOfWeek: 2, startTime: '17:00', endTime: '23:00' },
                            { dayOfWeek: 3, startTime: '17:00', endTime: '23:00' },
                            { dayOfWeek: 4, startTime: '17:00', endTime: '23:00' },
                            { dayOfWeek: 5, startTime: '17:00', endTime: '23:00' },
                            { dayOfWeek: 6, startTime: '08:00', endTime: '20:00' },
                            { dayOfWeek: 0, startTime: '08:00', endTime: '20:00' },
                        ],
                    },
                    maxConcurrentCalls: 2,
                    contactInfo: {
                        phone: '+1-555-0103',
                        email: 'emily.rodriguez@stmarys.hospital'
                    },
                    notificationPreferences: {
                        inApp: true,
                        sms: true,
                        email: true
                    }
                },
            },
        }),
        prisma.agent.create({
            data: {
                hospitalId: hospital.id,
                type: 'HUMAN',
                name: 'James Wilson',
                description: 'Billing Specialist',
                status: 'ACTIVE',
                humanProfile: {
                    userId: 'user_demo_billing',
                    specialization: ['billing', 'insurance', 'payments'],
                    skills: ['insurance_claims', 'payment_processing', 'financial_counseling'],
                    availability: {
                        timezone: 'America/New_York',
                        schedule: [
                            { dayOfWeek: 1, startTime: '08:00', endTime: '16:00' },
                            { dayOfWeek: 2, startTime: '08:00', endTime: '16:00' },
                            { dayOfWeek: 3, startTime: '08:00', endTime: '16:00' },
                            { dayOfWeek: 4, startTime: '08:00', endTime: '16:00' },
                            { dayOfWeek: 5, startTime: '08:00', endTime: '12:00' },
                        ],
                    },
                    maxConcurrentCalls: 4,
                    contactInfo: {
                        phone: '+1-555-0104',
                        email: 'james.wilson@stmarys.hospital'
                    },
                    notificationPreferences: {
                        inApp: true,
                        sms: false,
                        email: true
                    }
                },
            },
        }),
    ]);

    console.log(`✅ Created ${humanAgents.length} Human agents`);

    // Create Call Queues
    console.log('📋 Creating Call Queues...');
    const queues = await Promise.all([
        prisma.callQueue.create({
            data: {
                hospitalId: hospital.id,
                name: 'Clinical Staff Queue',
                specialization: 'clinical',
                priority: 1,
                maxWaitTime: 60, // 1 minute max wait for clinical
            },
        }),
        prisma.callQueue.create({
            data: {
                hospitalId: hospital.id,
                name: 'General Administration',
                specialization: 'admin',
                priority: 2,
                maxWaitTime: 180, // 3 minutes max wait
            },
        }),
        prisma.callQueue.create({
            data: {
                hospitalId: hospital.id,
                name: 'On-Call Representatives',
                specialization: 'oncall',
                priority: 1,
                maxWaitTime: 90, // 1.5 minutes max wait
            },
        }),
        prisma.callQueue.create({
            data: {
                hospitalId: hospital.id,
                name: 'Billing & Insurance',
                specialization: 'billing',
                priority: 3,
                maxWaitTime: 300, // 5 minutes max wait
            },
        }),
        prisma.callQueue.create({
            data: {
                hospitalId: hospital.id,
                name: 'Scheduling Queue',
                specialization: 'scheduling',
                priority: 2,
                maxWaitTime: 240, // 4 minutes max wait
            },
        }),
    ]);

    console.log(`✅ Created ${queues.length} Call Queues`);

    // Create some Agent Sessions (some online, some offline)
    console.log('🔌 Creating Agent Sessions...');
    const sessions = await Promise.all([
        // Dr. Sarah Johnson - Online
        prisma.agentSession.create({
            data: {
                agentId: humanAgents[0].id,
                status: 'ONLINE',
                startedAt: new Date(),
                totalCallsHandled: 5,
            },
        }),
        // Michael Chen - Online
        prisma.agentSession.create({
            data: {
                agentId: humanAgents[1].id,
                status: 'ONLINE',
                startedAt: new Date(),
                totalCallsHandled: 12,
            },
        }),
        // Emily Rodriguez - Break
        prisma.agentSession.create({
            data: {
                agentId: humanAgents[2].id,
                status: 'BREAK',
                startedAt: new Date(Date.now() - 3600000), // 1 hour ago
                totalCallsHandled: 3,
            },
        }),
        // James Wilson - Offline
        prisma.agentSession.create({
            data: {
                agentId: humanAgents[3].id,
                status: 'OFFLINE',
                startedAt: new Date(Date.now() - 86400000), // 1 day ago
                endedAt: new Date(Date.now() - 57600000), // ended 8 hours later
                totalCallsHandled: 8,
            },
        }),
    ]);

    console.log(`✅ Created ${sessions.length} Agent Sessions`);

    // Summary
    console.log('\n📊 Seed Summary:');
    console.log(`   Hospital: ${hospital.name}`);
    console.log(`   AI Agents: ${aiAgents.length}`);
    console.log(`   Human Agents: ${humanAgents.length}`);
    console.log(`   Call Queues: ${queues.length}`);
    console.log(`   Agent Sessions: ${sessions.length}`);
    
    console.log('\n✅ Multi-Agent Platform seed completed successfully!');
    console.log('\n🔗 Hospital ID for API testing:', hospital.id);
}

seedAgentsAndQueues()
    .catch((e) => {
        console.error('❌ Seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
