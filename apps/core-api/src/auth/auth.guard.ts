import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClerkService } from './clerk.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import { Logger } from '@wardline/utils';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthGuard implements CanActivate {
    private readonly logger = new Logger(AuthGuard.name);

    constructor(
        private clerkService: ClerkService,
        private prisma: PrismaService,
        private reflector: Reflector,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // Check if route is marked as public
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (isPublic) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const token = this.extractTokenFromHeader(request);

        if (!token) {
            throw new UnauthorizedException('No token provided');
        }

        try {
            // Verify the token with Clerk
            const payload = await this.clerkService.verifyToken(token);
            const clerkUserId = payload.sub;

            if (!clerkUserId) {
                throw new UnauthorizedException('Invalid token payload');
            }

            // Find or fetch the user from database
            const user = await this.prisma.user.findUnique({
                where: { clerkUserId },
                include: {
                    hospitals: {
                        include: {
                            hospital: true,
                        },
                    },
                },
            });

            if (!user) {
                this.logger.warn('User not found in database for Clerk user', { clerkUserId });
                throw new UnauthorizedException('User not found');
            }

            // Attach user to request
            request.user = user;
            request.clerkPayload = payload;

            return true;
        } catch (error) {
            this.logger.error('Authentication failed', error);
            if (error instanceof UnauthorizedException) {
                throw error;
            }
            throw new UnauthorizedException('Invalid token');
        }
    }

    private extractTokenFromHeader(request: any): string | undefined {
        const authorization = request.headers.authorization;
        if (!authorization) {
            return undefined;
        }

        const [type, token] = authorization.split(' ');
        return type === 'Bearer' ? token : undefined;
    }
}
