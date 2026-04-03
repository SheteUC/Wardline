"use client";

import type { ElementType, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import {
    LayoutDashboard, Phone, Settings, Search, Menu, X,
    AlertTriangle, Bell, ListTodo, PhoneCall, PlugZap, Voicemail,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { useBusiness } from '@/lib/business-context';
import { useFollowUpTasks, useIntegrations, useVoicemails } from '@/lib/hooks/query-hooks';
import { shouldRedirectToBusinessSettings } from '@/lib/business-selection';
import { formatUserRoleLabel } from '@wardline/types';

type DashboardNavItemProps = {
    href: string;
    icon: ElementType;
    label: string;
    pathname: string;
    businessId: string | null;
    businessLoading: boolean;
    isMobile: boolean;
    onNavigate: () => void;
    badge?: number;
    exact?: boolean;
    requiresBusiness?: boolean;
};

function DashboardNavItem({
    href,
    icon: Icon,
    label,
    pathname,
    businessId,
    businessLoading,
    isMobile,
    onNavigate,
    badge,
    exact,
    requiresBusiness,
}: DashboardNavItemProps) {
    const router = useRouter();
    const normalizedPath = pathname.replace(/\/$/, '') || '/';
    const normalizedHref = href.replace(/\/$/, '') || '/';
    const isDisabled = !!requiresBusiness && !businessLoading && !businessId;
    const isActive = exact
        ? normalizedPath === normalizedHref
        : normalizedPath === normalizedHref ||
          (normalizedHref !== '/' && normalizedPath.startsWith(normalizedHref + '/'));
    const className = [
        "w-full flex items-center justify-between px-4 py-2.5",
        "text-sm font-semibold rounded-2xl mb-1",
        "transition-all duration-150",
        isDisabled ? "cursor-pointer text-muted-foreground/60" : "",
        isActive
            ? "neo-raised bg-[var(--background)] text-primary"
            : "text-muted-foreground hover:text-foreground hover:neo-raised-sm hover:bg-[var(--background)]",
    ].join(" ");
    const content = (
        <>
            <div className="flex items-center gap-3">
                <Icon
                    className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-primary' : 'text-muted-foreground'
                    } ${isDisabled ? 'opacity-60' : ''}`}
                />
                {label}
            </div>
            {badge !== undefined && badge > 0 && (
                <span className="px-2 py-0.5 text-xs font-semibold bg-destructive/15 text-destructive rounded-full">
                    {badge}
                </span>
            )}
        </>
    );

    if (isDisabled) {
        return (
            <button
                type="button"
                onClick={() => {
                    router.push('/dashboard/settings');
                    if (isMobile) {
                        onNavigate();
                    }
                }}
                className={className}
                aria-label={`Open Practice Setup to unlock ${label}`}
            >
                {content}
            </button>
        );
    }

    return (
        <Link
            href={href}
            onClick={() => {
                if (isMobile) {
                    onNavigate();
                }
            }}
            className={className}
        >
            {content}
        </Link>
    );
}

export function DashboardLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { user } = useUser();
    const { businessId, isLoading: businessLoading } = useBusiness();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isMobile, setIsMobile] = useState(false);
    const followUpTasksQuery = useFollowUpTasks();
    const voicemailsQuery = useVoicemails(true);
    const integrationsQuery = useIntegrations();
    const userRole = (user?.publicMetadata?.role as string) || 'readonly';
    const openTasks = (followUpTasksQuery.data ?? []).filter(
        (task) => task.status !== 'COMPLETED' && task.status !== 'CANCELLED',
    );
    const urgentCount = openTasks.filter(
        (task) => task.priority === 'URGENT' || task.type === 'URGENT_CALLBACK',
    ).length;
    const voicemailCount = voicemailsQuery.data?.length ?? 0;
    const integrationFailureCount =
        integrationsQuery.data?.filter((integration) => integration.status !== 'CONNECTED').length ?? 0;
    const followUpCount = openTasks.length;
    const notificationCount = followUpCount + integrationFailureCount;

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 1024) {
                setIsMobile(true);
                setSidebarOpen(false);
            } else {
                setIsMobile(false);
                setSidebarOpen(true);
            }
        };
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (
            shouldRedirectToBusinessSettings({
                pathname,
                businessId,
                isLoading: businessLoading,
            })
        ) {
            router.replace('/dashboard/settings');
        }
    }, [businessId, businessLoading, pathname, router]);

    const pageTitle = (() => {
        if (pathname === '/dashboard') return 'Dashboard';
        if (pathname.startsWith('/dashboard/call-logs')) return 'Call Logs';
        if (pathname.startsWith('/dashboard/calls')) return 'Call Logs';
        if (pathname.startsWith('/dashboard/urgent-calls')) return 'Urgent Calls';
        if (pathname.startsWith('/dashboard/follow-ups')) return 'Follow-ups';
        if (pathname.startsWith('/dashboard/integration-failures')) return 'Integrations';
        if (pathname.startsWith('/dashboard/settings')) return 'Practice Setup';
        return 'Wardline';
    })();

    const showOnboardingBanner = !businessLoading && !businessId;
    const closeSidebar = () => setSidebarOpen(false);

    return (
        <div className="flex h-screen bg-background font-sans text-foreground overflow-hidden">

            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 w-64 bg-sidebar transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
                {/* Logo */}
                <div className="h-16 flex items-center px-6">
                    <div className="h-9 w-9 rounded-[12px] neo-raised-sm bg-[var(--background)] flex items-center justify-center mr-3">
                        <PhoneCall className="text-primary w-4 h-4" />
                    </div>
                    <span className="text-xl font-semibold tracking-tight text-sidebar-foreground">Wardline</span>
                    {isMobile && (
                        <button
                            type="button"
                            onClick={() => setSidebarOpen(false)}
                            aria-label="Close navigation"
                            className="ml-auto text-muted-foreground hover:text-foreground"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                <div className="px-4 pb-4 flex flex-col h-[calc(100%-4rem)] justify-between overflow-y-auto">
                    <nav className="space-y-1">
                        {/* Overview */}
                        <div className="text-xs font-semibold text-muted-foreground uppercase px-3 mb-2 mt-2 tracking-wider">
                            Overview
                        </div>
                        <DashboardNavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" pathname={pathname} businessId={businessId} businessLoading={businessLoading} isMobile={isMobile} onNavigate={closeSidebar} exact />
                        <DashboardNavItem href="/dashboard/calls" icon={Phone} label="Call Logs" pathname={pathname} businessId={businessId} businessLoading={businessLoading} isMobile={isMobile} onNavigate={closeSidebar} requiresBusiness />
                        <DashboardNavItem href="/dashboard/urgent-calls" icon={AlertTriangle} label="Urgent Calls" pathname={pathname} businessId={businessId} businessLoading={businessLoading} isMobile={isMobile} onNavigate={closeSidebar} badge={urgentCount} requiresBusiness />
                        <DashboardNavItem href="/dashboard/voicemails" icon={Voicemail} label="Voicemails" pathname={pathname} businessId={businessId} businessLoading={businessLoading} isMobile={isMobile} onNavigate={closeSidebar} badge={voicemailCount} requiresBusiness />
                        <DashboardNavItem href="/dashboard/follow-ups" icon={ListTodo} label="Follow-ups" pathname={pathname} businessId={businessId} businessLoading={businessLoading} isMobile={isMobile} onNavigate={closeSidebar} badge={followUpCount} requiresBusiness />
                        <DashboardNavItem
                            href="/dashboard/integration-failures"
                            icon={PlugZap}
                            label="Integrations"
                            pathname={pathname}
                            businessId={businessId}
                            businessLoading={businessLoading}
                            isMobile={isMobile}
                            onNavigate={closeSidebar}
                            badge={integrationFailureCount}
                            requiresBusiness
                        />

                        {/* Practice Setup */}
                        <div className="text-xs font-semibold text-muted-foreground uppercase px-3 mb-2 mt-6 tracking-wider">
                            Practice Setup
                        </div>
                        <DashboardNavItem href="/dashboard/settings" icon={Settings} label="Practice Setup" pathname={pathname} businessId={businessId} businessLoading={businessLoading} isMobile={isMobile} onNavigate={closeSidebar} />

                    </nav>

                    {/* User Card */}
                    <div className="neo-raised rounded-[14px] p-4 mt-4 bg-[var(--background)]">
                        <div className="flex items-center gap-3">
                            <UserButton />
                            <div>
                                <div className="text-sm font-medium text-sidebar-foreground">
                                    {user?.firstName || 'User'}
                                </div>
                                <div className="text-xs text-muted-foreground capitalize">
                                    {formatUserRoleLabel(userRole)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Mobile overlay */}
            {isMobile && sidebarOpen && (
                <div
                    className="fixed inset-0 bg-foreground/10 backdrop-blur-sm z-40"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Top Header */}
                <header className="h-16 bg-background flex items-center justify-between px-4 lg:px-8 z-30">
                    <div className="flex items-center">
                        <button
                            type="button"
                            onClick={() => setSidebarOpen(true)}
                            aria-label="Open navigation"
                            className="lg:hidden mr-4 text-muted-foreground hover:text-foreground"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <h1 className="text-lg font-semibold text-foreground">{pageTitle}</h1>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="hidden md:flex items-center neo-inset rounded-3xl px-3 py-2 bg-[var(--background)]">
                            <label htmlFor="dashboard-global-search" className="sr-only">
                                Search calls and callers
                            </label>
                            <Search className="w-4 h-4 text-muted-foreground mr-2 shrink-0" />
                            <input
                                id="dashboard-global-search"
                                type="text"
                                placeholder="Search calls, callers..."
                                aria-label="Search calls and callers"
                                className="bg-transparent border-none text-sm focus:outline-none text-foreground w-44 placeholder:text-muted-foreground"
                            />
                        </div>
                        <ThemeToggle />
                        <button
                            type="button"
                            aria-label="Notifications"
                            className="relative h-10 w-10 neo-raised rounded-2xl bg-[var(--background)] flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors active:neo-pressed"
                        >
                            <Bell className="w-5 h-5" />
                            {notificationCount > 0 && (
                                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                                    {notificationCount > 99 ? '99+' : notificationCount}
                                </span>
                            )}
                        </button>
                    </div>
                </header>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto bg-background p-4 lg:p-8">
                    <div className="max-w-7xl mx-auto">
                        {showOnboardingBanner && (
                            <div className="mb-6 rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-950 neo-inset">
                                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <p className="font-semibold">Finish setting up your first practice</p>
                                        <p className="text-amber-900/80">
                                            Create a practice in Practice Setup to unlock call handling, follow-up queues, and integrations.
                                        </p>
                                    </div>
                                    <Link
                                        href="/dashboard/settings"
                                        className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-[var(--background)] px-4 py-2 text-sm font-semibold text-primary neo-raised"
                                    >
                                        Open settings
                                    </Link>
                                </div>
                            </div>
                        )}
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
}
