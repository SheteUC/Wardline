"use client";

import React, { useState, useEffect } from 'react';
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import {
    LayoutDashboard, Phone, Activity, Bell, Search, Menu, X,
    BrainCircuit, Globe, Bot, ListTodo
} from 'lucide-react';
import { Button } from "@/components/dashboard/shared";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { user } = useUser();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isMobile, setIsMobile] = useState(false);

    // Get user role from metadata
    const userRole = (user?.publicMetadata?.role as string) || 'readonly';
    const isAdmin = ['admin', 'supervisor', 'owner', 'system_admin'].includes(userRole);
    const isSystemAdmin = userRole === 'system_admin';

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

    const NavItem = ({ href, icon: Icon, label, badge, exact }: { href: string, icon: any, label: string, badge?: number, exact?: boolean }) => {
        const normalizedPath = pathname.replace(/\/$/, '') || '/';
        const normalizedHref = href.replace(/\/$/, '') || '/';
        const isActive = exact
            ? normalizedPath === normalizedHref
            : normalizedPath === normalizedHref || (normalizedHref !== '/' && normalizedPath.startsWith(normalizedHref + '/'));
        return (
            <Link
                href={href}
                onClick={() => {
                    if (isMobile) setSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-all duration-200 rounded-lg mb-1
          ${isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                    }`}
            >
                <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${isActive ? 'text-foreground' : 'text-muted-foreground'}`} />
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

    return (
        <div className="flex h-screen bg-background font-sans text-foreground overflow-hidden">

            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
            >
                <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
                    <div className="h-8 w-8 bg-foreground rounded-lg flex items-center justify-center mr-3 shadow-sm">
                        <Activity className="text-background w-5 h-5" />
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
                        <div className="text-xs font-semibold text-muted-foreground uppercase px-4 mb-2 mt-2">Operations</div>
                        <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" exact />
                        <NavItem href="/dashboard/calls" icon={Phone} label="Calls & Triage" />

                        <div className="text-xs font-semibold text-muted-foreground uppercase px-4 mb-2 mt-6">Workflow System</div>
                        <NavItem href="/dashboard/workflows" icon={BrainCircuit} label="Workflows" />
                        <NavItem href="/dashboard/agents" icon={Bot} label="Agents" />
                        <NavItem href="/dashboard/queues" icon={ListTodo} label="Queues" />

                        <div className="text-xs font-semibold text-muted-foreground uppercase px-4 mb-2 mt-6">Settings</div>
                        <NavItem href="/dashboard/settings" icon={Globe} label="General" />
                    </nav>

                    <div className="bg-sidebar-accent p-4 rounded-xl border border-sidebar-border mt-4">
                        <div className="flex items-center gap-3 mb-3">
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

            {/* Overlay for mobile */}
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
                        <h1 className="text-lg font-semibold text-foreground">
                            {pathname === '/dashboard' && 'Operations Overview'}
                            {(pathname === '/dashboard/calls' || pathname.startsWith('/dashboard/calls/')) && 'Live Calls'}
                            {(pathname === '/dashboard/workflows' || pathname.startsWith('/dashboard/workflows/')) && 'AI Call Workflow'}
                            {(pathname === '/dashboard/agents' || pathname.startsWith('/dashboard/agents/')) && 'Agent Configuration'}
                            {(pathname === '/dashboard/queues' || pathname.startsWith('/dashboard/queues/')) && 'Call Queues'}
                            {pathname.startsWith('/dashboard/settings') && 'Settings'}
                        </h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="hidden md:flex items-center bg-muted rounded-lg px-3 py-1.5">
                            <Search className="w-4 h-4 text-muted-foreground mr-2" />
                            <input
                                type="text"
                                placeholder="Search patients, calls..."
                                className="bg-transparent border-none text-sm focus:outline-none text-foreground w-48"
                            />
                        </div>
                        <button className="relative p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors">
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-card"></span>
                        </button>
                    </div>
                </header>

                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto bg-background p-4 lg:p-8">
                    <div className="max-w-7xl mx-auto">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
}
