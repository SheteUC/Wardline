"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    Phone,
    LayoutDashboard,
    Workflow,
    BarChart3,
    Settings,
    CreditCard,
    Menu,
    X,
} from "lucide-react";
import { useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

const navigation = [
    {
        name: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
    },
    {
        name: "Calls",
        href: "/dashboard/calls",
        icon: Phone,
    },
    {
        name: "Workflows",
        href: "/dashboard/workflows",
        icon: Workflow,
    },
    {
        name: "Analytics",
        href: "/dashboard/analytics",
        icon: BarChart3,
    },
    {
        name: "Settings",
        href: "/dashboard/settings",
        icon: Settings,
    },
    {
        name: "Billing",
        href: "/dashboard/billing",
        icon: CreditCard,
    },
];

interface DashboardLayoutProps {
    children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
    const pathname = usePathname();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    return (
        <div className="flex min-h-screen">
            {/* Sidebar - Desktop */}
            <aside className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
                <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r bg-background px-6 pb-4">
                    {/* Logo */}
                    <div className="flex h-16 shrink-0 items-center gap-2">
                        <Phone className="h-6 w-6 text-primary-600" />
                        <span className="text-xl font-bold">Wardline</span>
                    </div>

                    {/* Navigation */}
                    <nav className="flex flex-1 flex-col">
                        <ul role="list" className="flex flex-1 flex-col gap-y-7">
                            <li>
                                <ul role="list" className="-mx-2 space-y-1">
                                    {navigation.map((item) => {
                                        const isActive = pathname === item.href;
                                        return (
                                            <li key={item.name}>
                                                <Link
                                                    href={item.href}
                                                    className={cn(
                                                        "group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 transition-colors",
                                                        isActive
                                                            ? "bg-primary-50 text-primary-600"
                                                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                                    )}
                                                >
                                                    <item.icon
                                                        className={cn(
                                                            "h-5 w-5 shrink-0",
                                                            isActive ? "text-primary-600" : "text-muted-foreground"
                                                        )}
                                                        aria-hidden="true"
                                                    />
                                                    {item.name}
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </li>
                        </ul>
                    </nav>
                </div>
            </aside>

            {/* Mobile menu */}
            <div className="lg:hidden">
                {mobileMenuOpen && (
                    <>
                        {/* Backdrop */}
                        <div
                            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
                            onClick={() => setMobileMenuOpen(false)}
                        />

                        {/* Side panel */}
                        <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-background border-r">
                            <div className="flex h-16 items-center justify-between px-6">
                                <div className="flex items-center gap-2">
                                    <Phone className="h-6 w-6 text-primary-600" />
                                    <span className="text-xl font-bold">Wardline</span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>

                            <nav className="px-6 pt-4">
                                <ul role="list" className="space-y-1">
                                    {navigation.map((item) => {
                                        const isActive = pathname === item.href;
                                        return (
                                            <li key={item.name}>
                                                <Link
                                                    href={item.href}
                                                    onClick={() => setMobileMenuOpen(false)}
                                                    className={cn(
                                                        "group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 transition-colors",
                                                        isActive
                                                            ? "bg-primary-50 text-primary-600"
                                                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                                    )}
                                                >
                                                    <item.icon
                                                        className={cn(
                                                            "h-5 w-5 shrink-0",
                                                            isActive ? "text-primary-600" : "text-muted-foreground"
                                                        )}
                                                        aria-hidden="true"
                                                    />
                                                    {item.name}
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </nav>
                        </aside>
                    </>
                )}
            </div>

            {/* Main content */}
            <div className="lg:pl-64 flex-1 flex flex-col">
                {/* Top bar */}
                <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b bg-background px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
                    {/* Mobile menu button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="lg:hidden"
                        onClick={() => setMobileMenuOpen(true)}
                    >
                        <Menu className="h-5 w-5" />
                        <span className="sr-only">Open sidebar</span>
                    </Button>

                    {/* Spacer */}
                    <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
                        <div className="flex flex-1" />
                        <div className="flex items-center gap-x-4 lg:gap-x-6">
                            <UserButton afterSignOutUrl="/" />
                        </div>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1">
                    <div className="px-4 py-8 sm:px-6 lg:px-8">{children}</div>
                </main>
            </div>
        </div>
    );
}
