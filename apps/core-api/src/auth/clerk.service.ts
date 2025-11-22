import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClerkClient } from '@clerk/clerk-sdk-node';
import { Logger } from '@wardline/utils';

export interface ClerkUser {
    id: string;
    emailAddresses: Array<{ emailAddress: string }>;
    firstName: string | null;
    lastName: string | null;
}

@Injectable()
export class ClerkService {
    private readonly logger = new Logger(ClerkService.name);
    private clerkClient;

    constructor(private configService: ConfigService) {
        const secretKey = this.configService.get<string>('CLERK_SECRET_KEY');
        if (!secretKey) {
            throw new Error('CLERK_SECRET_KEY is not defined in environment variables');
        }
        this.clerkClient = createClerkClient({ secretKey });
    }

    /**
     * Verify a Clerk JWT token
     * @param token JWT token from Authorization header
     * @returns Decoded token payload with user information
     */
    async verifyToken(token: string): Promise<any> {
        try {
            // Clerk's verifyToken returns the decoded JWT
            const decoded = await this.clerkClient.verifyToken(token);
            return decoded;
        } catch (error) {
            this.logger.error('Token verification failed', error);
            throw new UnauthorizedException('Invalid or expired token');
        }
    }

    /**
     * Get user information from Clerk
     * @param clerkUserId Clerk user ID
     * @returns User information from Clerk
     */
    async getClerkUser(clerkUserId: string): Promise<ClerkUser> {
        try {
            const user = await this.clerkClient.users.getUser(clerkUserId);
            return user as ClerkUser;
        } catch (error) {
            this.logger.error('Failed to fetch Clerk user', { clerkUserId, error });
            throw new UnauthorizedException('User not found in Clerk');
        }
    }
}
