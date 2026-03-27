import {
    routeRequiresBusiness,
    selectPreferredBusinessId,
    shouldRedirectToBusinessSettings,
} from './business-selection';

describe('business-selection helpers', () => {
    it('prefers the stored business id when it is still valid', () => {
        const businessId = selectPreferredBusinessId({
            businesses: [{ id: 'business-1' }, { id: 'business-2' }],
            storedBusinessId: 'business-2',
            defaultBusinessId: 'business-1',
        });

        expect(businessId).toBe('business-2');
    });

    it('falls back to the default business id when the stored value is stale', () => {
        const businessId = selectPreferredBusinessId({
            businesses: [{ id: 'business-1' }],
            storedBusinessId: 'stale-business',
            defaultBusinessId: 'business-1',
        });

        expect(businessId).toBe('business-1');
    });

    it('gates operational queue routes until a business exists', () => {
        expect(routeRequiresBusiness('/dashboard/calls')).toBe(true);
        expect(routeRequiresBusiness('/dashboard/settings')).toBe(false);
        expect(routeRequiresBusiness('/dashboard')).toBe(false);
    });

    it('redirects business-scoped routes to settings when no business is selected', () => {
        expect(
            shouldRedirectToBusinessSettings({
                pathname: '/dashboard/calls',
                businessId: null,
                isLoading: false,
            }),
        ).toBe(true);

        expect(
            shouldRedirectToBusinessSettings({
                pathname: '/dashboard/settings',
                businessId: null,
                isLoading: false,
            }),
        ).toBe(false);
    });
});
