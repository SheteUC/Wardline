"use client";

import React from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export const Card = ({ children, className = "", title, action }: { children: React.ReactNode; className?: string; title?: string; action?: React.ReactNode }) => (
    <div className={`bg-card rounded-xl shadow-sm border border-border flex flex-col ${className}`}>
        {(title || action) && (
            <div className="px-6 py-4 border-b border-border/50 flex justify-between items-center">
                {title && <h3 className="font-semibold text-foreground">{title}</h3>}
                {action && <div>{action}</div>}
            </div>
        )}
        <div className="p-6 flex-1">{children}</div>
    </div>
);

export const StatCard = ({ label, value, subtext, icon: Icon, trend, trendValue, alert }: any) => (
    <div className={`bg-card p-5 rounded-xl shadow-sm border ${alert ? 'border-red-200 bg-red-50/30' : 'border-border'}`}>
        <div className="flex justify-between items-start mb-4">
            <div className={`p-2 rounded-lg ${alert ? 'bg-red-100 text-red-600' : 'bg-muted text-muted-foreground'}`}>
                <Icon className="w-5 h-5" />
            </div>
            {trend && (
                <span className={`text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1 ${trend === 'up' && !alert ? 'bg-emerald-50 text-emerald-700' :
                    trend === 'down' && alert ? 'bg-emerald-50 text-emerald-700' :
                        trend === 'down' ? 'bg-red-50 text-red-700' :
                            'bg-muted text-muted-foreground'
                    }`}>
                    {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {trendValue}
                </span>
            )}
        </div>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
        {subtext && <div className="text-xs text-muted-foreground/70 mt-1">{subtext}</div>}
    </div>
);

export const Badge = ({ type, text }: { type: string; text: string }) => {
    const styles: Record<string, string> = {
        success: "bg-emerald-50 text-emerald-700 border-emerald-200",
        warning: "bg-orange-50 text-orange-700 border-orange-200",
        danger: "bg-red-50 text-red-700 border-red-200",
        neutral: "bg-muted text-muted-foreground border-border",
        primary: "bg-accent text-foreground border-border",
    };
    return (
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[type] || styles.neutral}`}>
            {text}
        </span>
    );
};

export const Button = ({ children, variant = 'primary', icon: Icon, className = "", onClick, disabled }: any) => {
    const base = "inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
    const variants: Record<string, string> = {
        primary: "bg-foreground text-background hover:bg-foreground/90 focus:ring-ring shadow-sm",
        secondary: "bg-card text-foreground border border-border hover:bg-muted focus:ring-ring shadow-sm",
        danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
        ghost: "text-muted-foreground hover:bg-muted",
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
        className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${checked ? 'bg-foreground' : 'bg-muted'}`}
    >
        <div className={`bg-background w-4 h-4 rounded-full shadow-sm transform transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`}></div>
    </div>
);
