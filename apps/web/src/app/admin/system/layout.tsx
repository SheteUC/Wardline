"use client";

import React, { useState, useEffect } from 'react';
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
    LayoutDashboard, Phone, GitBranch, Server, Shield, Settings,
    Bell, Menu, X, Activity, Users, Building2, FileText
} from 'lucide-react';
import { QueryProvider } from "@/lib/query-provider";
import { HospitalProvider } from "@/lib/hospital-context";
import { AuthProvider } from "@/lib/auth-context";

/**
 * System Admin Dashboard Layout
 * Full-featured admin layout for platform-level management
 */

export default function SystemAdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
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

    const NavItem = ({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) => {
        const isActive = pathname === href || pathname.startsWith(href + '/');
        return (
            <Link
                href={href}
                onClick={() => {
                    if (isMobile) setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all duration-200 rounded-lg mb-1
                    ${isActive
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
            >
                <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-muted-foreground'}`} />
                {label}
            </Link>
        );
    };

    return (
        <QueryProvider>
            <HospitalProvider>
                <AuthProvider>
                    <div className="flex h-screen bg-slate-50 font-sans text-foreground overflow-hidden">
                        {/* Sidebar */}
                        <aside
                            className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-border transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
                                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                            `}
                        >
                            <div className="h-16 flex items-center px-6 border-b border-border bg-indigo-600">
                                <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center mr-3 shadow-sm">
                                    <Shield className="text-indigo-600 w-5 h-5" />
                                </div>
                                <span className="text-xl font-bold tracking-tight text-white">System Admin</span>
                                {isMobile && (
                                    <button onClick={() => setSidebarOpen(false)} className="ml-auto text-white/80 hover:text-white">
                                        <X className="w-5 h-5" />
                                    </button>
                                )}
                            </div>

                            <div className="p-4 flex flex-col h-[calc(100%-4rem)] justify-between overflow-y-auto">
                                <nav className="space-y-1">
                                    <div className="text-xs font-semibold text-muted-foreground uppercase px-4 mb-2 mt-2">Overview</div>
                                    <NavItem href="/admin/system" icon={LayoutDashboard} label="Dashboard" />
                                    
                                    <div className="text-xs font-semibold text-muted-foreground uppercase px-4 mb-2 mt-6">Platform</div>
                                    <NavItem href="/admin/system/hospitals" icon={Building2} label="Hospitals" />
                                    <NavItem href="/admin/system/workflows" icon={GitBranch} label="Workflows" />
                                    <NavItem href="/admin/system/phone-numbers" icon={Phone} label="Phone Numbers" />
                                    
                                    <div className="text-xs font-semibold text-muted-foreground uppercase px-4 mb-2 mt-6">System</div>
                                    <NavItem href="/admin/system/integrations" icon={Server} label="Integrations" />
                                    <NavItem href="/admin/system/audit-log" icon={FileText} label="Audit Log" />
                                    <NavItem href="/admin/system/settings" icon={Settings} label="Settings" />
                                </nav>

                                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 mt-4">
                                    <div className="flex items-center gap-3 mb-3">
                                        <UserButton afterSignOutUrl="/" />
                                        <div>
                                            <div className="text-sm font-medium text-indigo-900">Admin User</div>
                                            <div className="text-xs text-indigo-600">System Administrator</div>
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
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-medium rounded">
                                            SYSTEM ADMIN
                                        </span>
                                        <h1 className="text-lg font-semibold text-foreground">
                                            {pathname === '/admin/system' && 'System Overview'}
                                            {pathname === '/admin/system/hospitals' && 'Hospital Management'}
                                            {pathname === '/admin/system/workflows' && 'Workflow Configuration'}
                                            {pathname === '/admin/system/phone-numbers' && 'Phone Number Routing'}
                                            {pathname === '/admin/system/integrations' && 'Integration Health'}
                                            {pathname === '/admin/system/audit-log' && 'Audit Log'}
                                            {pathname === '/admin/system/settings' && 'System Settings'}
                                        </h1>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <button className="relative p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors">
                                        <Bell className="w-5 h-5" />
                                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                                    </button>
                                </div>
                            </header>

                            {/* Scrollable Content Area */}
                            <div className="flex-1 overflow-y-auto bg-slate-50 p-4 lg:p-8">
                                <div className="max-w-7xl mx-auto">
                                    {children}
                                </div>
                            </div>
                        </main>
                    </div>
                </AuthProvider>
            </HospitalProvider>
        </QueryProvider>
    );
}

