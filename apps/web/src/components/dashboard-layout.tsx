"use client";

import React, { useState, useEffect } from 'react';
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import {
    LayoutDashboard, Phone, Settings, Search, Menu, X,
    Bot, GitBranch, Bell, PhoneCall, Voicemail,
} from 'lucide-react';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { user } = useUser();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isMobile, setIsMobile] = useState(false);

    const userRole = (user?.publicMetadata?.role as string) || 'readonly';

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
                className={`w-full flex items-center justify-between pl-4 pr-4 py-3 text-sm font-medium transition-all duration-200 rounded-lg mb-1 border-l-2 -ml-px
                    ${isActive
                        ? 'bg-primary/10 text-primary border-primary font-semibold'
                        : 'border-transparent text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground hover:border-muted-foreground/30'
                    }`}
            >
                <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                    {label}
                </div>
                {badge !== undefined && badge > 0 && (
                    <span className="px-2 py-0.5 text-xs font-bold bg-rose-500 text-white rounded-full">
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
        if (pathname.startsWith('/dashboard/agents')) return 'Agents';
        if (pathname.startsWith('/dashboard/workflows')) return 'Call Flow';
        if (pathname.startsWith('/dashboard/settings')) return 'Settings';
        return 'Wardline';
    })();

    return (
        <div className="flex h-screen bg-background font-sans text-foreground overflow-hidden">

            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
                {/* Logo */}
                <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
                    <div className="h-8 w-8 bg-foreground rounded-lg flex items-center justify-center mr-3 shadow-sm">
                        <PhoneCall className="text-background w-4 h-4" />
                    </div>
                    <span className="text-xl font-bold tracking-tight text-sidebar-foreground">Wardline</span>
                    {isMobile && (
                        <button onClick={() => setSidebarOpen(false)} className="ml-auto text-slate-400">
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                <div className="p-4 flex flex-col h-[calc(100%-4rem)] justify-between overflow-y-auto">
                    <nav className="space-y-1">
                        {/* Overview */}
                        <div className="text-xs font-semibold text-muted-foreground uppercase px-4 mb-2 mt-2">
                            Overview
                        </div>
                        <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" exact />
                        <NavItem href="/dashboard/calls" icon={Phone} label="Call Logs" />
                        <NavItem href="/dashboard/voicemails" icon={Voicemail} label="Voicemails" />

                        {/* Configuration */}
                        <div className="text-xs font-semibold text-muted-foreground uppercase px-4 mb-2 mt-6">
                            Configuration
                        </div>
                        <NavItem href="/dashboard/agents" icon={Bot} label="Agents" />
                        <NavItem href="/dashboard/workflows" icon={GitBranch} label="Call Flow" />

                        {/* Account */}
                        <div className="text-xs font-semibold text-muted-foreground uppercase px-4 mb-2 mt-6">
                            Account
                        </div>
                        <NavItem href="/dashboard/settings" icon={Settings} label="Settings" />
                    </nav>

                    {/* User Card */}
                    <div className="bg-sidebar-accent p-4 rounded-xl border border-sidebar-border mt-4">
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
                    className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Top Header */}
                <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 lg:px-8 z-30">
                    <div className="flex items-center">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden mr-4 text-muted-foreground hover:text-foreground"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <h1 className="text-lg font-semibold text-foreground">{pageTitle}</h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="hidden md:flex items-center bg-muted rounded-lg px-3 py-1.5">
                            <Search className="w-4 h-4 text-muted-foreground mr-2" />
                            <input
                                type="text"
                                placeholder="Search calls, callers..."
                                className="bg-transparent border-none text-sm focus:outline-none text-foreground w-48"
                            />
                        </div>
                        <button className="relative p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors">
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-card" />
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
