import type { Metadata } from "next";
import { ClerkProvider, SignUp } from "@clerk/nextjs";
import { noIndexMetadata } from "@/lib/metadata";

export const metadata: Metadata = noIndexMetadata;

export default function SignUpPage() {
    return (
        <ClerkProvider>
            <div className="flex min-h-screen items-center justify-center bg-muted/40">
                <SignUp
                    appearance={{
                        elements: {
                            rootBox: "mx-auto",
                            card: "shadow-lg",
                        },
                    }}
                    routing="path"
                    path="/sign-up"
                    signInUrl="/sign-in"
                    forceRedirectUrl="/dashboard"
                />
            </div>
        </ClerkProvider>
    );
}
