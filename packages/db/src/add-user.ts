import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const clerkUserId = 'user_35qV9zkWZ5SzYVHwayboKYrI59c';
    const hospitalId = '36137e31-e984-4a63-b85e-c4d04346c492';

    console.log('🔧 Adding your Clerk user to the database...');

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
        where: { clerkUserId },
    });

    if (existingUser) {
        console.log('✅ User already exists:', existingUser.email);

        // Check if they're assigned to the hospital
        const hospitalUser = await prisma.hospitalUser.findUnique({
            where: {
                hospitalId_userId: {
                    hospitalId,
                    userId: existingUser.id,
                },
            },
        });

        if (!hospitalUser) {
            await prisma.hospitalUser.create({
                data: {
                    hospitalId,
                    userId: existingUser.id,
                    role: UserRole.OWNER,
                },
            });
            console.log('✅ Assigned user to hospital as OWNER');
        } else {
            console.log('✅ User already assigned to hospital');
        }
    } else {
        // Create new user
        const user = await prisma.user.create({
            data: {
                clerkUserId,
                email: 'your-email@example.com', // Will be updated by Clerk webhook
                fullName: null,
            },
        });

        console.log('✅ Created user:', user.id);

        // Assign to hospital
        await prisma.hospitalUser.create({
            data: {
                hospitalId,
                userId: user.id,
                role: UserRole.OWNER,
            },
        });

        console.log('✅ Assigned user to hospital as OWNER');
    }

    console.log('\n🎉 Success! You can now use the app with your Clerk account.');
    console.log('   Hospital ID:', hospitalId);
}

main()
    .catch((e) => {
        console.error('❌ Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
