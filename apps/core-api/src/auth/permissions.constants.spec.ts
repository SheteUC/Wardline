import { UserRole } from '@wardline/types';
import { getRolesWithPermission, hasAnyPermission, hasPermission } from './permissions.constants';

describe('permissions constants', () => {
    it('accepts uppercase and legacy lowercase user roles', () => {
        expect(hasPermission('OWNER', UserRole.ADMIN)).toBe(true);
        expect(hasPermission('owner', UserRole.ADMIN)).toBe(true);
        expect(hasPermission('readonly', UserRole.ADMIN)).toBe(false);
    });

    it('checks any matching role threshold', () => {
        expect(hasAnyPermission('supervisor', [UserRole.ADMIN, UserRole.SUPERVISOR])).toBe(true);
        expect(hasAnyPermission('agent', [UserRole.ADMIN, UserRole.SUPERVISOR])).toBe(false);
    });

    it('returns all roles at or above the required threshold', () => {
        expect(getRolesWithPermission(UserRole.SUPERVISOR)).toEqual([
            UserRole.OWNER,
            UserRole.ADMIN,
            UserRole.SUPERVISOR,
        ]);
    });
});
