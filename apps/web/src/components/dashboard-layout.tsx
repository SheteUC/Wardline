"use client";

import React, { useState, useEffect } from 'react';
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import {
    LayoutDashboard, Phone, Settings, Search, Menu, X,
    AlertTriangle, Bot, GitBranch, Bell, ListTodo, PhoneCall, PlugZap, Voicemail,
} from 'lucide-react';
import { useCalls, useIntegrations, useVoicemails } from '@/lib/hooks/query-hooks';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { user } = useUser();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isMobile, setIsMobile] = useState(false);
    const urgentCallsQuery = useCalls({ isEmergency: true, pageSize: 25 });
    const voicemailsQuery = useVoicemails(true);
    const integrationsQuery = useIntegrations();

    const userRole = (user?.publicMetadata?.role as string) || 'readonly';
    const urgentCount = urgentCallsQuery.data?.total ?? 0;
    const voicemailCount = voicemailsQuery.data?.length ?? 0;
    const integrationFailureCount =
        integrationsQuery.data?.filter((integration) => integration.status !== 'CONNECTED').length ?? 0;
    const followUpCount = urgentCount + voicemailCount;
    const notificationCount = urgentCount + voicemailCount + integrationFailureCount;

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

    const NavItem = ({
        href,
        icon: Icon,
        label,
        badge,
        exact,
    }: {
        href: string;
        icon: React.ElementType;
        label: string;
        badge?: number;
        exact?: boolean;
    }) => {
        const normalizedPath = pathname.replace(/\/$/, '') || '/';
        const normalizedHref = href.replace(/\/$/, '') || '/';
        const isActive = exact
            ? normalizedPath === normalizedHref
            : normalizedPath === normalizedHref ||
              (normalizedHref !== '/' && normalizedPath.startsWith(normalizedHref + '/'));

        return (
            <Link
                href={href}
                onClick={() => { if (isMobile) setSidebarOpen(false); }}
                className={[
                    "w-full flex items-center justify-between px-4 py-2.5",
                    "text-sm font-semibold rounded-2xl mb-1",
                    "transition-all duration-150",
                    isActive
                        ? "neo-raised bg-[var(--background)] text-primary"
                        : "text-muted-foreground hover:text-foreground hover:neo-raised-sm hover:bg-[var(--background)]",
                ].join(" ")}
            >
                <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                    {label}
                </div>
                {badge !== undefined && badge > 0 && (
                    <span className="px-2 py-0.5 text-xs font-semibold bg-destructive/15 text-destructive rounded-full">
                        {badge}
                    </span>
                )}
            </Link>
        );
    };

    const pageTitle = (() => {
        if (pathname === '/dashboard') return 'Dashboard';
        if (pathname.startsWith('/dashboard/call-logs')) return 'Call Logs';
        if (pathname.startsWith('/dashboard/calls')) return 'Call Logs';
        if (pathname.startsWith('/dashboard/urgent-calls')) return 'Urgent Calls';
        if (pathname.startsWith('/dashboard/follow-ups')) return 'Follow-ups';
        if (pathname.startsWith('/dashboard/integration-failures')) return 'Integration Failures';
        if (pathname.startsWith('/dashboard/agents')) return 'Agents';
        if (pathname.startsWith('/dashboard/workflows')) return 'Call Flow';
        if (pathname.startsWith('/dashboard/settings')) return 'Settings';
        return 'Wardline';
    })();

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
                        <button onClick={() => setSidebarOpen(false)} className="ml-auto text-muted-foreground hover:text-foreground">
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
                        <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" exact />
                        <NavItem href="/dashboard/calls" icon={Phone} label="Call Logs" />
                        <NavItem href="/dashboard/urgent-calls" icon={AlertTriangle} label="Urgent Calls" badge={urgentCount} />
                        <NavItem href="/dashboard/voicemails" icon={Voicemail} label="Voicemails" badge={voicemailCount} />
                        <NavItem href="/dashboard/follow-ups" icon={ListTodo} label="Follow-ups" badge={followUpCount} />
                        <NavItem
                            href="/dashboard/integration-failures"
                            icon={PlugZap}
                            label="Integration Failures"
                            badge={integrationFailureCount}
                        />

                        {/* Configuration */}
                        <div className="text-xs font-semibold text-muted-foreground uppercase px-3 mb-2 mt-6 tracking-wider">
                            Configuration
                        </div>
                        <NavItem href="/dashboard/agents" icon={Bot} label="Agents" />
                        <NavItem href="/dashboard/workflows" icon={GitBranch} label="Call Flow" />

                        {/* Account */}
                        <div className="text-xs font-semibold text-muted-foreground uppercase px-3 mb-2 mt-6 tracking-wider">
                            Account
                        </div>
                        <NavItem href="/dashboard/settings" icon={Settings} label="Settings" />
                    </nav>

                    {/* User Card */}
                    <div className="neo-raised rounded-[14px] p-4 mt-4 bg-[var(--background)]">
                        <div className="flex items-center gap-3">
                            <UserButton afterSignOutUrl="/" />
                            <div>
                                <div className="text-sm font-medium text-sidebar-foreground">
                                    {user?.firstName || 'User'}
                                </div>
                                <div className="text-xs text-muted-foreground capitalize">
                                    {userRole.replace('_', ' ')}
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
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden mr-4 text-muted-foreground hover:text-foreground"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <h1 className="text-lg font-semibold text-foreground">{pageTitle}</h1>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="hidden md:flex items-center neo-inset rounded-3xl px-3 py-2 bg-[var(--background)]">
                            <Search className="w-4 h-4 text-muted-foreground mr-2 shrink-0" />
                            <input
                                type="text"
                                placeholder="Search calls, callers..."
                                className="bg-transparent border-none text-sm focus:outline-none text-foreground w-44 placeholder:text-muted-foreground"
                            />
                        </div>
                        <button className="relative h-10 w-10 neo-raised rounded-2xl bg-[var(--background)] flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors active:neo-pressed">
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
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
}
