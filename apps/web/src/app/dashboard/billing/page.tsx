import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CreditCard, Check, Zap } from "lucide-react";

export const dynamic = "force-dynamic";

const plans = [
    {
        name: "Starter",
        price: "$99",
        period: "month",
        description: "Perfect for small practices",
        features: [
            "Up to 500 calls/month",
            "1,000 AI minutes",
            "Basic analytics",
            "Email support",
            "1 workflow",
        ],
        current: false,
    },
    {
        name: "Professional",
        price: "$299",
        period: "month",
        description: "For growing hospitals",
        features: [
            "Up to 2,000 calls/month",
            "5,000 AI minutes",
            "Advanced analytics",
            "Priority support",
            "Unlimited workflows",
            "Custom integrations",
        ],
        current: true,
    },
    {
        name: "Enterprise",
        price: "Custom",
        period: "",
        description: "For large healthcare systems",
        features: [
            "Unlimited calls",
            "Unlimited AI minutes",
            "Custom analytics",
            "24/7 dedicated support",
            "Unlimited workflows",
            "Advanced HIPAA features",
            "SLA guarantee",
        ],
        current: false,
    },
];

export default async function BillingPage() {
    const user = await currentUser();

    if (!user) {
        redirect("/sign-in");
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
                <p className="text-muted-foreground">
                    Manage your subscription and payment methods
                </p>
            </div>

            {/* Current Plan */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Current Plan</CardTitle>
                            <CardDescription>
                                You are currently on the Professional plan
                            </CardDescription>
                        </div>
                        <Badge variant="success">Active</Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                        <div>
                            <p className="text-sm text-muted-foreground">Plan</p>
                            <p className="text-2xl font-bold">Professional</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Billing Period</p>
                            <p className="text-2xl font-bold">Monthly</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Next Billing Date</p>
                            <p className="text-2xl font-bold">Dec 1, 2025</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Usage This Month */}
            <Card>
                <CardHeader>
                    <CardTitle>Usage This Month</CardTitle>
                    <CardDescription>
                        Track your consumption and remaining quota
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium">Calls</p>
                            <p className="text-sm text-muted-foreground">538 / 2,000</p>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary-600" style={{ width: "27%" }} />
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium">AI Minutes</p>
                            <p className="text-sm text-muted-foreground">1,247 / 5,000</p>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-success-600" style={{ width: "25%" }} />
                        </div>
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">Estimated Cost</p>
                            <p className="text-sm text-muted-foreground">Based on current usage</p>
                        </div>
                        <p className="text-2xl font-bold">$299.00</p>
                    </div>
                </CardContent>
            </Card>

            {/* Payment Method */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Payment Method</CardTitle>
                            <CardDescription>
                                Manage your payment information
                            </CardDescription>
                        </div>
                        <Button variant="outline">Update</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4 rounded-lg border p-4">
                        <div className="h-12 w-12 rounded-lg bg-primary-100 flex items-center justify-center">
                            <CreditCard className="h-6 w-6 text-primary-600" />
                        </div>
                        <div className="flex-1">
                            <p className="font-medium">Visa ending in 4242</p>
                            <p className="text-sm text-muted-foreground">Expires 12/2025</p>
                        </div>
                        <Badge variant="outline">Default</Badge>
                    </div>
                </CardContent>
            </Card>

            {/* Available Plans */}
            <div>
                <h2 className="text-2xl font-bold tracking-tight mb-4">Available Plans</h2>
                <div className="grid gap-6 md:grid-cols-3">
                    {plans.map((plan) => (
                        <Card key={plan.name} className={plan.current ? "border-primary-600 border-2" : ""}>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle>{plan.name}</CardTitle>
                                    {plan.current && (
                                        <Badge variant="default">
                                            <Check className="h-3 w-3 mr-1" />
                                            Current
                                        </Badge>
                                    )}
                                </div>
                                <div className="mt-4">
                                    <span className="text-4xl font-bold">{plan.price}</span>
                                    {plan.period && <span className="text-muted-foreground">/{plan.period}</span>}
                                </div>
                                <CardDescription className="mt-2">{plan.description}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2 mb-6">
                                    {plan.features.map((feature) => (
                                        <li key={feature} className="flex items-start gap-2 text-sm">
                                            <Check className="h-4 w-4 text-success-600 mt-0.5 flex-shrink-0" />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                                {plan.current ? (
                                    <Button className="w-full" disabled>
                                        Current Plan
                                    </Button>
                                ) : plan.name === "Enterprise" ? (
                                    <Button className="w-full" variant="outline">
                                        Contact Sales
                                    </Button>
                                ) : (
                                    <Button className="w-full" variant="outline">
                                        <Zap className="h-4 w-4 mr-2" />
                                        Upgrade
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Billing History */}
            <Card>
                <CardHeader>
                    <CardTitle>Billing History</CardTitle>
                    <CardDescription>
                        Download past invoices and receipts
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {[
                            { date: "Nov 1, 2025", amount: "$299.00", status: "Paid" },
                            { date: "Oct 1, 2025", amount: "$299.00", status: "Paid" },
                            { date: "Sep 1, 2025", amount: "$299.00", status: "Paid" },
                        ].map((invoice) => (
                            <div key={invoice.date} className="flex items-center justify-between rounded-lg border p-4">
                                <div className="flex items-center gap-4">
                                    <div>
                                        <p className="font-medium">{invoice.date}</p>
                                        <p className="text-sm text-muted-foreground">Professional Plan</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <p className="font-medium">{invoice.amount}</p>
                                    <Badge variant="success">{invoice.status}</Badge>
                                    <Button variant="ghost" size="sm">Download</Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
