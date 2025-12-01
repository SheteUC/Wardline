"use client";

import React, { useState, useEffect } from 'react';
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import {
    LayoutDashboard, Phone, Activity, GitGraph, Users, Settings,
    Bell, Search, LogOut, Menu, X, Plus, Filter, Download,
    AlertTriangle, Clock, CheckCircle, User, ChevronRight,
    MoreHorizontal, Play, Save, Mic, BrainCircuit, Calendar,
    FileText, ArrowUpRight, ArrowDownRight, RefreshCw,
    ZoomIn, ZoomOut, RotateCcw, CornerUpLeft, CornerUpRight,
    MousePointer, GripHorizontal,
    Shield, Globe, BellRing, CreditCard, Lock, Link2,
    Building2, Pill, Megaphone, Headphones, Server
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

    const NavItem = ({ href, icon: Icon, label, badge }: { href: string, icon: any, label: string, badge?: number }) => {
        const isActive = pathname === href || pathname.startsWith(href + '/');
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
                        <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" />
                        <NavItem href="/dashboard/calls" icon={Phone} label="Calls & Triage" />
                        <NavItem href="/dashboard/analytics" icon={GitGraph} label="Analytics" />

                        <div className="text-xs font-semibold text-muted-foreground uppercase px-4 mb-2 mt-6">Patient Access</div>
                        <NavItem href="/dashboard/departments" icon={Building2} label="Department Directory" />
                        <NavItem href="/dashboard/prescriptions" icon={Pill} label="Prescription Refills" />
                        <NavItem href="/dashboard/insurance" icon={Shield} label="Insurance Verification" />
                        <NavItem href="/dashboard/events" icon={Megaphone} label="Marketing Events" />

                        <div className="text-xs font-semibold text-muted-foreground uppercase px-4 mb-2 mt-6">Configuration</div>
                        <NavItem href="/dashboard/workflows" icon={BrainCircuit} label="AI Call Workflow" />
                        <NavItem href="/dashboard/team" icon={Users} label="Team Management" />

                        {/* Role-Based Admin Links */}
                        {isAdmin && (
                            <>
                                <div className="text-xs font-semibold text-muted-foreground uppercase px-4 mb-2 mt-6">Admin</div>
                                <NavItem href="/admin/call-center" icon={Headphones} label="Call Center" badge={2} />
                                {isSystemAdmin && (
                                    <NavItem href="/admin/system" icon={Server} label="System Admin" />
                                )}
                            </>
                        )}

                        <div className="text-xs font-semibold text-muted-foreground uppercase px-4 mb-2 mt-6">Settings</div>
                        <NavItem href="/dashboard/settings" icon={Globe} label="General" />
                        <NavItem href="/dashboard/settings/notifications" icon={BellRing} label="Notifications" />
                        <NavItem href="/dashboard/settings/integrations" icon={Link2} label="Integrations" />
                        <NavItem href="/dashboard/settings/security" icon={Shield} label="Security" />
                        <NavItem href="/dashboard/settings/billing" icon={CreditCard} label="Billing" />
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
                            {pathname === '/dashboard/calls' && 'Live Calls'}
                            {pathname === '/dashboard/workflows' && 'AI Call Workflow'}
                            {pathname === '/dashboard/analytics' && 'System Configuration'}
                            {pathname === '/dashboard/team' && 'Team Management'}
                            {pathname === '/dashboard/departments' && 'Department Directory'}
                            {pathname === '/dashboard/prescriptions' && 'Prescription Refills'}
                            {pathname === '/dashboard/insurance' && 'Insurance Verification'}
                            {pathname === '/dashboard/events' && 'Marketing Events'}
                            {pathname.startsWith('/dashboard/settings') && 'Settings & Preferences'}
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
