import {
    canAccessInternalTools,
    isInternalToolRoute,
    shouldRedirectFromInternalTools,
} from './internal-tools';

describe('internal tools helpers', () => {
    const internalAdminUser = {
        publicMetadata: {
            internalAdmin: true,
            role: 'system_admin',
        },
    };

    it('requires both the env flag and internal admin metadata', () => {
        expect(canAccessInternalTools(internalAdminUser, 'true')).toBe(true);
        expect(canAccessInternalTools(internalAdminUser, 'false')).toBe(false);
        expect(
            canAccessInternalTools(
                {
                    publicMetadata: {
                        role: 'readonly',
                    },
                },
                'true',
            ),
        ).toBe(false);
    });

    it('recognizes the internal workflow routes', () => {
        expect(isInternalToolRoute('/dashboard/workflows')).toBe(true);
        expect(isInternalToolRoute('/dashboard/agents/123')).toBe(true);
        expect(isInternalToolRoute('/dashboard/settings')).toBe(false);
    });

    it('redirects non-internal users away from internal routes', () => {
        expect(
            shouldRedirectFromInternalTools({
                pathname: '/dashboard/workflows',
                user: undefined,
                flag: 'false',
            }),
        ).toBe(true);

        expect(
            shouldRedirectFromInternalTools({
                pathname: '/dashboard/settings',
                user: undefined,
                flag: 'false',
            }),
        ).toBe(false);
    });
});
