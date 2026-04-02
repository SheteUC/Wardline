import type { Prisma } from '@wardline/db';

/** User row as attached by AuthGuard (membership rows scoped select). */
export type AuthenticatedUser = Prisma.UserGetPayload<{
    include: {
        businesses: {
            select: {
                businessId: true;
                role: true;
                createdAt: true;
            };
        };
    };
}>;
