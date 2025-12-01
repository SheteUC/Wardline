"use client";

import React, { useState, useEffect } from 'react';
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
    LayoutDashboard, Phone, AlertTriangle, Users, BarChart3,
    Bell, Menu, X, Activity, Headphones, Clock, Settings
} from 'lucide-react';
import { QueryProvider } from "@/lib/query-provider";
import { HospitalProvider, useHospital } from "@/lib/hospital-context";
import { AuthProvider } from "@/lib/auth-context";

/**
 * Call Center Admin Dashboard Layout
 * Command center for call center supervisors
 */

function CallCenterLayoutContent({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { hospitalId } = useHospital();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isMobile, setIsMobile] = useState(false);

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

    const NavItem = ({ href, icon: Icon, label, badge }: { 
        href: string; 
        icon: React.ElementType; 
        label: string;
        badge?: number;
    }) => {
        const isActive = pathname === href || pathname.startsWith(href + '/');
        return (
            <Link
                href={href}
                onClick={() => {
                    if (isMobile) setSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-all duration-200 rounded-lg mb-1
                    ${isActive
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
            >
                <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${isActive ? 'text-rose-600' : 'text-muted-foreground'}`} />
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
        <div className="flex h-screen bg-slate-50 font-sans text-foreground overflow-hidden">
            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-border transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                `}
            >
                <div className="h-16 flex items-center px-6 border-b border-border bg-gradient-to-r from-rose-600 to-rose-500">
                    <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center mr-3 shadow-sm">
                        <Headphones className="text-rose-600 w-5 h-5" />
                    </div>
                    <span className="text-xl font-bold tracking-tight text-white">Call Center</span>
                    {isMobile && (
                        <button onClick={() => setSidebarOpen(false)} className="ml-auto text-white/80 hover:text-white">
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                <div className="p-4 flex flex-col h-[calc(100%-4rem)] justify-between overflow-y-auto">
                    <nav className="space-y-1">
                        <div className="text-xs font-semibold text-muted-foreground uppercase px-4 mb-2 mt-2">Command Center</div>
                        <NavItem href="/admin/call-center" icon={LayoutDashboard} label="Dashboard" />
                        <NavItem href="/admin/call-center/live" icon={Phone} label="Live Calls" badge={3} />
                        <NavItem href="/admin/call-center/escalations" icon={AlertTriangle} label="Escalations" badge={2} />
                        
                        <div className="text-xs font-semibold text-muted-foreground uppercase px-4 mb-2 mt-6">Analytics</div>
                        <NavItem href="/admin/call-center/summaries" icon={Activity} label="Call Summaries" />
                        <NavItem href="/admin/call-center/metrics" icon={BarChart3} label="Performance" />
                        
                        <div className="text-xs font-semibold text-muted-foreground uppercase px-4 mb-2 mt-6">Team</div>
                        <NavItem href="/admin/call-center/agents" icon={Users} label="Agents" />
                        <NavItem href="/admin/call-center/settings" icon={Settings} label="Settings" />
                    </nav>

                    <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 mt-4">
                        <div className="flex items-center gap-3 mb-3">
                            <UserButton afterSignOutUrl="/" />
                            <div>
                                <div className="text-sm font-medium text-rose-900">Supervisor</div>
                                <div className="text-xs text-rose-600">Call Center Admin</div>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Overlay for mobile */}
            {isMobile && sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Top Header */}
                <header className="h-16 bg-white border-b border-border flex items-center justify-between px-4 lg:px-8 z-30">
                    <div className="flex items-center">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden mr-4 text-muted-foreground hover:text-foreground"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <div className="flex items-center gap-3">
                            <span className="px-2 py-1 bg-rose-100 text-rose-700 text-xs font-medium rounded">
                                CALL CENTER
                            </span>
                            <h1 className="text-lg font-semibold text-foreground">
                                {pathname === '/admin/call-center' && 'Command Center'}
                                {pathname === '/admin/call-center/live' && 'Live Calls'}
                                {pathname === '/admin/call-center/escalations' && 'Escalated Calls'}
                                {pathname === '/admin/call-center/summaries' && 'Call Summaries'}
                                {pathname === '/admin/call-center/metrics' && 'Performance Metrics'}
                                {pathname === '/admin/call-center/agents' && 'Agent Management'}
                                {pathname === '/admin/call-center/settings' && 'Settings'}
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Live indicator */}
                        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-full">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span className="text-xs font-medium text-emerald-700">Live</span>
                        </div>
                        
                        <button className="relative p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors">
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>
                        </button>
                    </div>
                </header>

                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto bg-slate-50 p-4 lg:p-6">
                    <div className="max-w-7xl mx-auto">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
}

export default function CallCenterLayout({ children }: { children: React.ReactNode }) {
    return (
        <QueryProvider>
            <HospitalProvider>
                <AuthProvider>
                    <CallCenterLayoutContent>{children}</CallCenterLayoutContent>
                </AuthProvider>
            </HospitalProvider>
        </QueryProvider>
    );
}

