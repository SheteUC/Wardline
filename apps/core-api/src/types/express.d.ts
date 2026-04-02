import type { AuthenticatedUser } from '../auth/authenticated-user.types';

declare global {
    namespace Express {
        interface Request {
            user?: AuthenticatedUser;
            clerkPayload?: Record<string, unknown>;
        }
    }
}

export {};
