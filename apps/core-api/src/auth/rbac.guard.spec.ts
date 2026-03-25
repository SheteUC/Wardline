import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacGuard } from './rbac.guard';
import { UserRole } from '@wardline/types';

describe('RbacGuard', () => {
    let guard: RbacGuard;
    let reflector: Reflector;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RbacGuard,
                {
                    provide: Reflector,
                    useValue: {
                        getAllAndOverride: jest.fn(),
                    },
                },
            ],
        }).compile();

        guard = module.get<RbacGuard>(RbacGuard);
        reflector = module.get<Reflector>(Reflector);
    });

    describe('No Required Roles', () => {
        it('should allow access when no roles are specified', async () => {
            const context = createMockContext({});
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

            const result = await guard.canActivate(context);

            expect(result).toBe(true);
        });
    });

    describe('Permission Hierarchy', () => {
        it('should allow OWNER to access ADMIN-required routes', async () => {
            const user = createMockUser('business-123', UserRole.OWNER);
            const context = createMockContext({ user, params: { businessId: 'business-123' } });
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);

            const result = await guard.canActivate(context);

            expect(result).toBe(true);
        });

        it('should allow ADMIN to access SUPERVISOR-required routes', async () => {
            const user = createMockUser('business-123', UserRole.ADMIN);
            const context = createMockContext({ user, params: { businessId: 'business-123' } });
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.SUPERVISOR]);

            const result = await guard.canActivate(context);

            expect(result).toBe(true);
        });

        it('should deny READONLY access to ADMIN-required routes', async () => {
            const user = createMockUser('business-123', UserRole.READONLY);
            const context = createMockContext({ user, params: { businessId: 'business-123' } });
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);

            await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
        });
    });

    describe('Business Context', () => {
        it('should throw ForbiddenException when no business context', async () => {
            const user = createMockUser('business-123', UserRole.ADMIN);
            const context = createMockContext({ user, params: {} });
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);

            await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
        });

        it('should deny access when user does not belong to the business', async () => {
            const user = createMockUser('business-123', UserRole.ADMIN);
            const context = createMockContext({ user, params: { businessId: 'business-456' } });
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);

            await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
        });

        it('should extract businessId from request body', async () => {
            const user = createMockUser('business-123', UserRole.ADMIN);
            const context = createMockContext({ user, params: {}, body: { businessId: 'business-123' } });
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);

            const result = await guard.canActivate(context);

            expect(result).toBe(true);
        });

        it('should extract businessId from query params', async () => {
            const user = createMockUser('business-123', UserRole.ADMIN);
            const context = createMockContext({ user, params: {}, query: { businessId: 'business-123' } });
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);

            const result = await guard.canActivate(context);

            expect(result).toBe(true);
        });
    });
});

function createMockUser(businessId: string, role: UserRole) {
    return {
        id: 'user-123',
        businesses: [
            {
                businessId,
                role,
            },
        ],
    };
}

function createMockContext(request: any): ExecutionContext {
    return {
        switchToHttp: () => ({
            getRequest: () => request,
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
    } as any;
}
