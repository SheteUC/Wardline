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
            const user = createMockUser('hospital-123', UserRole.OWNER);
            const context = createMockContext({ user, params: { hospitalId: 'hospital-123' } });
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);

            const result = await guard.canActivate(context);

            expect(result).toBe(true);
        });

        it('should allow ADMIN to access SUPERVISOR-required routes', async () => {
            const user = createMockUser('hospital-123', UserRole.ADMIN);
            const context = createMockContext({ user, params: { hospitalId: 'hospital-123' } });
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.SUPERVISOR]);

            const result = await guard.canActivate(context);

            expect(result).toBe(true);
        });

        it('should deny READONLY access to ADMIN-required routes', async () => {
            const user = createMockUser('hospital-123', UserRole.READONLY);
            const context = createMockContext({ user, params: { hospitalId: 'hospital-123' } });
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);

            await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
        });
    });

    describe('Hospital Context', () => {
        it('should throw ForbiddenException when no hospital context', async () => {
            const user = createMockUser('hospital-123', UserRole.ADMIN);
            const context = createMockContext({ user, params: {} });
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);

            await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
        });

        it('should deny access when user does not belong to hospital', async () => {
            const user = createMockUser('hospital-123', UserRole.ADMIN);
            const context = createMockContext({ user, params: { hospitalId: 'hospital-456' } });
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);

            await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
        });

        it('should extract hospitalId from request body', async () => {
            const user = createMockUser('hospital-123', UserRole.ADMIN);
            const context = createMockContext({ user, params: {}, body: { hospitalId: 'hospital-123' } });
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);

            const result = await guard.canActivate(context);

            expect(result).toBe(true);
        });

        it('should extract hospitalId from query params', async () => {
            const user = createMockUser('hospital-123', UserRole.ADMIN);
            const context = createMockContext({ user, params: {}, query: { hospitalId: 'hospital-123' } });
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);

            const result = await guard.canActivate(context);

            expect(result).toBe(true);
        });
    });
});

function createMockUser(hospitalId: string, role: UserRole) {
    return {
        id: 'user-123',
        hospitals: [
            {
                hospitalId,
                role,
                hospital: { id: hospitalId, name: 'Test Hospital' },
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
