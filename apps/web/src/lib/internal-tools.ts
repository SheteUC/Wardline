export interface InternalToolsUserLike {
    publicMetadata?: {
        role?: string;
        internalAdmin?: boolean;
    } | null;
}

const INTERNAL_TOOL_ROUTE_PREFIXES = [
    '/dashboard/agents',
    '/dashboard/workflows',
    '/dashboard/agent-console',
];

export function normalizePath(pathname: string): string {
    return pathname.replace(/\/$/, '') || '/';
}

export function isInternalToolsEnabled(flag = process.env.NEXT_PUBLIC_ENABLE_INTERNAL_TOOLS): boolean {
    return flag === 'true';
}

export function isInternalAdminUser(user?: InternalToolsUserLike | null): boolean {
    const metadata = user?.publicMetadata;
    return metadata?.internalAdmin === true || metadata?.role === 'system_admin';
}

export function canAccessInternalTools(user?: InternalToolsUserLike | null, flag?: string): boolean {
    return isInternalToolsEnabled(flag) && isInternalAdminUser(user);
}

export function isInternalToolRoute(pathname: string): boolean {
    const normalized = normalizePath(pathname);

    return INTERNAL_TOOL_ROUTE_PREFIXES.some(
        (routePrefix) => normalized === routePrefix || normalized.startsWith(`${routePrefix}/`),
    );
}

export function shouldRedirectFromInternalTools(options: {
    pathname: string;
    user?: InternalToolsUserLike | null;
    flag?: string;
}): boolean {
    const { pathname, user, flag } = options;

    if (!isInternalToolRoute(pathname)) {
        return false;
    }

    return !canAccessInternalTools(user, flag);
}
