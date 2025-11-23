"use client";

import React, { useState, useEffect } from 'react';
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
    LayoutDashboard, Phone, Activity, GitGraph, Users, Settings,
    Bell, Search, LogOut, Menu, X, Plus, Filter, Download,
    AlertTriangle, Clock, CheckCircle, User, ChevronRight,
    MoreHorizontal, Play, Save, Mic, BrainCircuit, Calendar,
    FileText, ArrowUpRight, ArrowDownRight, RefreshCw,
    ZoomIn, ZoomOut, RotateCcw, CornerUpLeft, CornerUpRight,
    MousePointer, GripHorizontal,
    Shield, Globe, BellRing, CreditCard, Lock, Link2
} from 'lucide-react';
import { Button } from "@/components/dashboard/shared";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
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

    const NavItem = ({ href, icon: Icon, label }: { href: string, icon: any, label: string }) => {
        const isActive = pathname === href;
        return (
            <Link
                href={href}
                onClick={() => {
                    if (isMobile) setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all duration-200 rounded-lg mb-1
          ${isActive
                        ? 'bg-teal-50 text-teal-700 shadow-sm ring-1 ring-teal-200'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
            >
                <Icon className={`w-5 h-5 ${isActive ? 'text-teal-600' : 'text-slate-400'}`} />
                {label}
            </Link>
        );
    };

    return (
        <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden selection:bg-teal-100">

            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
            >
                <div className="h-16 flex items-center px-6 border-b border-slate-100">
                    <div className="h-8 w-8 bg-teal-600 rounded-lg flex items-center justify-center mr-3 shadow-sm">
                        <Activity className="text-white w-5 h-5" />
                    </div>
                    <span className="text-xl font-bold tracking-tight text-slate-800">Wardline</span>
                    {isMobile && (
                        <button onClick={() => setSidebarOpen(false)} className="ml-auto text-slate-400">
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                <div className="p-4 flex flex-col h-[calc(100%-4rem)] justify-between overflow-y-auto">
                    <nav className="space-y-1">
                        <div className="text-xs font-semibold text-slate-400 uppercase px-4 mb-2 mt-2">Operations</div>
                        <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" />
                        <NavItem href="/dashboard/calls" icon={Phone} label="Calls & Triage" />
                        <NavItem href="/dashboard/analytics" icon={GitGraph} label="Analytics" />

                        <div className="text-xs font-semibold text-slate-400 uppercase px-4 mb-2 mt-6">Configuration</div>
                        <NavItem href="/dashboard/workflows" icon={BrainCircuit} label="Workflow Builder" />
                        <NavItem href="/dashboard/team" icon={Users} label="Team Management" />

                        <div className="text-xs font-semibold text-slate-400 uppercase px-4 mb-2 mt-6">Settings</div>
                        <NavItem href="/dashboard/settings" icon={Globe} label="General" />
                        <NavItem href="/dashboard/settings/notifications" icon={BellRing} label="Notifications" />
                        <NavItem href="/dashboard/settings/integrations" icon={Link2} label="Integrations" />
                        <NavItem href="/dashboard/settings/security" icon={Shield} label="Security" />
                        <NavItem href="/dashboard/settings/billing" icon={CreditCard} label="Billing" />
                    </nav>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mt-4">
                        <div className="flex items-center gap-3 mb-3">
                            <UserButton afterSignOutUrl="/" />
                            <div>
                                <div className="text-sm font-medium text-slate-900">Jane Doe</div>
                                <div className="text-xs text-slate-500">Ops Director</div>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Overlay for mobile */}
            {isMobile && sidebarOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Top Header */}
                <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 z-30">
                    <div className="flex items-center">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden mr-4 text-slate-500 hover:text-slate-700"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <h1 className="text-lg font-semibold text-slate-800">
                            {pathname === '/dashboard' && 'Operations Overview'}
                            {pathname === '/dashboard/calls' && 'Live Calls'}
                            {pathname === '/dashboard/workflows' && 'Workflow Configuration'}
                            {pathname === '/dashboard/analytics' && 'System Configuration'}
                            {pathname === '/dashboard/team' && 'Team Management'}
                            {pathname.startsWith('/dashboard/settings') && 'Settings & Preferences'}
                        </h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="hidden md:flex items-center bg-slate-100 rounded-lg px-3 py-1.5">
                            <Search className="w-4 h-4 text-slate-400 mr-2" />
                            <input
                                type="text"
                                placeholder="Search patients, calls..."
                                className="bg-transparent border-none text-sm focus:outline-none text-slate-700 w-48"
                            />
                        </div>
                        <button className="relative p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>
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
    );
}
