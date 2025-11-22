import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
import { ClerkService } from './clerk.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthGuard', () => {
    let guard: AuthGuard;
    let clerkService: ClerkService;
    let prisma: PrismaService;
    let reflector: Reflector;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthGuard,
                {
                    provide: ClerkService,
                    useValue: {
                        verifyToken: jest.fn(),
                    },
                },
                {
                    provide: PrismaService,
                    useValue: {
                        user: {
                            findUnique: jest.fn(),
                        },
                    },
                },
                {
                    provide: Reflector,
                    useValue: {
                        getAllAndOverride: jest.fn(),
                    },
                },
            ],
        }).compile();

        guard = module.get<AuthGuard>(AuthGuard);
        clerkService = module.get<ClerkService>(ClerkService);
        prisma = module.get<PrismaService>(PrismaService);
        reflector = module.get<Reflector>(Reflector);
    });

    describe('Public Routes', () => {
        it('should allow access to public routes without token', async () => {
            const context = createMockContext({ headers: {} });
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

            const result = await guard.canActivate(context);

            expect(result).toBe(true);
            expect(clerkService.verifyToken).not.toHaveBeenCalled();
        });
    });

    describe('Protected Routes', () => {
        it('should throw UnauthorizedException when no token is provided', async () => {
            const context = createMockContext({ headers: {} });
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

            await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
        });

        it('should validate token and attach user to request', async () => {
            const mockUser = {
                id: 'user-123',
                clerkUserId: 'clerk-123',
                email: 'test@example.com',
                hospitals: [
                    {
                        hospitalId: 'hospital-123',
                        role: 'ADMIN',
                        hospital: { id: 'hospital-123', name: 'Test Hospital' },
                    },
                ],
            };

            const context = createMockContext({
                headers: { authorization: 'Bearer valid-token' },
            });
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
            jest.spyOn(clerkService, 'verifyToken').mockResolvedValue({ sub: 'clerk-123' });
            jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);

            const result = await guard.canActivate(context);

            expect(result).toBe(true);
            expect(clerkService.verifyToken).toHaveBeenCalledWith('valid-token');
            expect(context.switchToHttp().getRequest().user).toEqual(mockUser);
        });

        it('should throw UnauthorizedException when user not found in database', async () => {
            const context = createMockContext({
                headers: { authorization: 'Bearer valid-token' },
            });
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
            jest.spyOn(clerkService, 'verifyToken').mockResolvedValue({ sub: 'clerk-123' });
            jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

            await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException when token is invalid', async () => {
            const context = createMockContext({
                headers: { authorization: 'Bearer invalid-token' },
            });
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
            jest.spyOn(clerkService, 'verifyToken').mockRejectedValue(new Error('Invalid token'));

            await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
        });
    });
});

function createMockContext(request: any): ExecutionContext {
    return {
        switchToHttp: () => ({
            getRequest: () => request,
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
    } as any;
}
