/** Subset of Clerk `user.*` webhook `data` used by this controller. */
export interface ClerkWebhookUserData {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    email_addresses?: Array<{ email_address?: string }>;
}

/** Top-level Clerk webhook JSON (verified before use). */
export interface ClerkWebhookPayload {
    type: string;
    data: ClerkWebhookUserData;
}
