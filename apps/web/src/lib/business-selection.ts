export interface BusinessSelectionCandidate {
    id: string;
}

const BUSINESS_REQUIRED_ROUTE_PREFIXES = [
    '/dashboard/calls',
    '/dashboard/urgent-calls',
    '/dashboard/voicemails',
    '/dashboard/follow-ups',
    '/dashboard/integration-failures',
];

export function normalizeDashboardPath(pathname: string): string {
    return pathname.replace(/\/$/, '') || '/';
}

export function selectPreferredBusinessId(options: {
    businesses: BusinessSelectionCandidate[];
    storedBusinessId?: string | null;
    defaultBusinessId?: string | null;
}): string | null {
    const { businesses, storedBusinessId, defaultBusinessId } = options;
    const validIds = new Set(businesses.map((business) => business.id));

    if (storedBusinessId && validIds.has(storedBusinessId)) {
        return storedBusinessId;
    }

    if (defaultBusinessId && validIds.has(defaultBusinessId)) {
        return defaultBusinessId;
    }

    return businesses[0]?.id ?? null;
}

export function routeRequiresBusiness(pathname: string): boolean {
    const normalizedPath = normalizeDashboardPath(pathname);

    return BUSINESS_REQUIRED_ROUTE_PREFIXES.some(
        (routePrefix) =>
            normalizedPath === routePrefix || normalizedPath.startsWith(`${routePrefix}/`),
    );
}

export function shouldRedirectToBusinessSettings(options: {
    pathname: string;
    businessId: string | null;
    isLoading: boolean;
}): boolean {
    const { pathname, businessId, isLoading } = options;

    if (isLoading || businessId) {
        return false;
    }

    return routeRequiresBusiness(pathname);
}
