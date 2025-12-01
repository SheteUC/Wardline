"use client";

import React, { useState, useEffect } from 'react';
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
    Home, Calendar, CreditCard, FileText, Shield, Menu, X, Activity, Bell, User
} from 'lucide-react';
import { QueryProvider } from "@/lib/query-provider";
import { HospitalProvider } from "@/lib/hospital-context";
import { AuthProvider } from "@/lib/auth-context";

/**
 * Patient Dashboard Layout
 * Mobile-first design with bottom navigation on small screens
 */

export default function PatientLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [menuOpen, setMenuOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const navItems = [
        { href: '/patient', icon: Home, label: 'Home' },
        { href: '/patient/appointments', icon: Calendar, label: 'Appointments' },
        { href: '/patient/bills', icon: CreditCard, label: 'Bills' },
        { href: '/patient/results', icon: FileText, label: 'Results' },
        { href: '/patient/insurance', icon: Shield, label: 'Insurance' },
    ];

    const NavItem = ({ href, icon: Icon, label, mobile = false }: { 
        href: string; 
        icon: React.ElementType; 
        label: string;
        mobile?: boolean;
    }) => {
        const isActive = pathname === href;
        
        if (mobile) {
            return (
                <Link
                    href={href}
                    className={`flex flex-col items-center justify-center py-2 px-3 transition-colors ${
                        isActive 
                            ? 'text-emerald-600' 
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-600' : ''}`} />
                    <span className="text-xs mt-1 font-medium">{label}</span>
                </Link>
            );
        }

        return (
            <Link
                href={href}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all duration-200 rounded-lg ${
                    isActive
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
            >
                <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-600' : ''}`} />
                {label}
            </Link>
        );
    };

    return (
        <QueryProvider>
            <HospitalProvider>
                <AuthProvider>
                    <div className="min-h-screen bg-gradient-to-b from-emerald-50/50 to-background flex flex-col">
                        {/* Top Header */}
                        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-border">
                            <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 bg-emerald-600 rounded-lg flex items-center justify-center shadow-sm">
                                        <Activity className="text-white w-5 h-5" />
                                    </div>
                                    <span className="text-lg font-bold tracking-tight text-foreground">MyHealth</span>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    <button className="relative p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors">
                                        <Bell className="w-5 h-5" />
                                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full"></span>
                                    </button>
                                    <UserButton 
                                        afterSignOutUrl="/"
                                        appearance={{
                                            elements: {
                                                avatarBox: "w-8 h-8"
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        </header>

                        {/* Main Content */}
                        <main className="flex-1 pb-20 md:pb-8">
                            <div className="max-w-4xl mx-auto px-4 py-4 md:py-6">
                                {children}
                            </div>
                        </main>

                        {/* Mobile Bottom Navigation */}
                        {isMobile && (
                            <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-border safe-area-inset-bottom">
                                <div className="flex items-center justify-around">
                                    {navItems.map((item) => (
                                        <NavItem 
                                            key={item.href} 
                                            {...item} 
                                            mobile 
                                        />
                                    ))}
                                </div>
                            </nav>
                        )}

                        {/* Desktop Sidebar */}
                        {!isMobile && (
                            <aside className="fixed left-0 top-14 bottom-0 w-64 bg-white border-r border-border p-4 hidden md:block">
                                <nav className="space-y-1">
                                    {navItems.map((item) => (
                                        <NavItem key={item.href} {...item} />
                                    ))}
                                </nav>
                                
                                <div className="absolute bottom-4 left-4 right-4">
                                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                                        <p className="text-sm font-medium text-emerald-800">Need Help?</p>
                                        <p className="text-xs text-emerald-600 mt-1">
                                            Contact our support team for assistance.
                                        </p>
                                        <Link 
                                            href="/patient/support" 
                                            className="mt-3 block text-center text-sm font-medium text-emerald-700 hover:text-emerald-800"
                                        >
                                            Get Support
                                        </Link>
                                    </div>
                                </div>
                            </aside>
                        )}

                        {/* Desktop main content offset */}
                        <style jsx global>{`
                            @media (min-width: 768px) {
                                main {
                                    margin-left: 256px;
                                }
                            }
                            .safe-area-inset-bottom {
                                padding-bottom: env(safe-area-inset-bottom);
                            }
                        `}</style>
                    </div>
                </AuthProvider>
            </HospitalProvider>
        </QueryProvider>
    );
}

