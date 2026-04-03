import type { Metadata } from "next";
import { ClerkProvider, SignIn } from "@clerk/nextjs";
import { noIndexMetadata } from "@/lib/metadata";

export const metadata: Metadata = noIndexMetadata;

export default function SignInPage() {
    return (
        <ClerkProvider>
            <div className="flex min-h-screen items-center justify-center bg-muted/40">
                <SignIn
                    appearance={{
                        elements: {
                            rootBox: "mx-auto",
                            card: "shadow-lg",
                        },
                    }}
                    routing="path"
                    path="/sign-in"
                    signUpUrl="/sign-up"
                    forceRedirectUrl="/dashboard"
                />
            </div>
        </ClerkProvider>
    );
}
