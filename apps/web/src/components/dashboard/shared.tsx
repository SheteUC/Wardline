"use client";

import React from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

/** Inset text fields — use across dashboard forms for consistent Silk styling */
export const neoFieldClass =
    "w-full rounded-2xl border-0 bg-[var(--background)] px-3 py-2.5 text-sm text-foreground neo-inset outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/30 placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60";

/** Select / multiline — same base as fields */
export const neoSelectClass = neoFieldClass;

export const Card = ({ children, className = "", title, action }: {
    children: React.ReactNode;
    className?: string;
    title?: string;
    action?: React.ReactNode;
}) => (
    <div className={`bg-card rounded-3xl neo-raised p-6 flex flex-col ${className}`}>
        {(title || action) && (
            <div className="flex justify-between items-center mb-4">
                {title && <h3 className="font-semibold text-foreground">{title}</h3>}
                {action && <div>{action}</div>}
            </div>
        )}
        <div className="flex-1">{children}</div>
    </div>
);

export const StatCard = ({ label, value, subtext, icon: Icon, trend, trendValue, alert }: {
    label: string;
    value: string | number;
    subtext?: string;
    icon: React.ElementType;
    trend?: "up" | "down";
    trendValue?: string;
    alert?: boolean;
}) => (
    <div className="bg-card rounded-3xl neo-raised p-5">
        <div className="flex justify-between items-start mb-4">
            <div className={`h-10 w-10 rounded-2xl neo-raised-sm bg-[var(--background)] flex items-center justify-center ${alert ? "text-destructive" : "text-primary"}`}>
                <Icon className="w-5 h-5" />
            </div>
            {trend && (
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 ${
                    (trend === "up" && !alert) || (trend === "down" && alert)
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-destructive/10 text-destructive"
                }`}>
                    {trend === "up"
                        ? <ArrowUpRight className="w-3 h-3" />
                        : <ArrowDownRight className="w-3 h-3" />
                    }
                    {trendValue}
                </span>
            )}
        </div>
        <div className="text-2xl font-semibold text-foreground">{value}</div>
        <div className="text-sm text-muted-foreground mt-0.5">{label}</div>
        {subtext && <div className="text-xs text-muted-foreground/70 mt-1">{subtext}</div>}
    </div>
);

export const Badge = ({ type, text }: { type: string; text: string }) => {
    const styles: Record<string, string> = {
        success: "bg-emerald-500/10 text-emerald-600",
        warning: "bg-amber-500/10 text-amber-600",
        danger: "bg-destructive/10 text-destructive",
        neutral: "bg-muted text-muted-foreground",
        primary: "bg-primary/10 text-primary",
    };
    return (
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[type] || styles.neutral}`}>
            {text}
        </span>
    );
};

export const Button = ({ children, variant = "primary", icon: Icon, className = "", onClick, disabled }: {
    children: React.ReactNode;
    variant?: string;
    icon?: React.ElementType;
    className?: string;
    onClick?: () => void;
    disabled?: boolean;
}) => {
    const base = [
        "inline-flex items-center justify-center px-5 py-2 rounded-2xl",
        "text-sm font-semibold transition-all duration-150 select-none",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "bg-[var(--background)] neo-raised active:neo-pressed active:scale-[0.98]",
    ].join(" ");

    const variants: Record<string, string> = {
        primary: "text-primary",
        secondary: "text-muted-foreground",
        danger: "text-destructive",
        ghost: "neo-flat shadow-none bg-transparent text-muted-foreground hover:text-foreground hover:neo-raised-sm hover:bg-[var(--background)]",
        /** Primary CTA — solid indigo on neo surface */
        filled:
            "!bg-primary !text-primary-foreground hover:!bg-primary/90 active:!bg-primary/85 shadow-none",
    };

    return (
        <button className={`${base} ${variants[variant]} ${className}`} onClick={onClick} disabled={disabled}>
            {Icon && <Icon className="w-4 h-4 mr-2" />}
            {children}
        </button>
    );
};

export const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) => (
    <div
        onClick={() => onChange(!checked)}
        className="w-12 h-6 flex items-center rounded-full p-0.5 cursor-pointer transition-all duration-200 neo-inset bg-[var(--background)]"
    >
        <div className={[
            "h-5 w-5 rounded-full transition-all duration-200 neo-raised-sm",
            checked ? "translate-x-6 bg-primary" : "translate-x-0 bg-[var(--background)]",
        ].join(" ")} />
    </div>
);
