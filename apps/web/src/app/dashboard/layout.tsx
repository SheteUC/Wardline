import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Providers } from "@/components/providers";
import { DashboardLayout } from "@/components/dashboard-layout";
import { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth-context";
import { BusinessProvider } from "@/lib/business-context";
import { noIndexMetadata } from "@/lib/metadata";

export const dynamic = "force-dynamic";
export const metadata: Metadata = noIndexMetadata;

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <ClerkProvider>
            <Providers>
                <BusinessProvider>
                    <AuthProvider>
                        <DashboardLayout>{children}</DashboardLayout>
                    </AuthProvider>
                </BusinessProvider>
            </Providers>
        </ClerkProvider>
    );
}
