"use client";

import React from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export const Card = ({ children, className = "", title, action }: { children: React.ReactNode; className?: string; title?: string; action?: React.ReactNode }) => (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col ${className}`}>
        {(title || action) && (
            <div className="px-6 py-4 border-b border-slate-50 flex justify-between items-center">
                {title && <h3 className="font-semibold text-slate-800">{title}</h3>}
                {action && <div>{action}</div>}
            </div>
        )}
        <div className="p-6 flex-1">{children}</div>
    </div>
);

export const StatCard = ({ label, value, subtext, icon: Icon, trend, trendValue, alert }: any) => (
    <div className={`bg-white p-5 rounded-xl shadow-sm border ${alert ? 'border-rose-200 bg-rose-50/30' : 'border-slate-100'}`}>
        <div className="flex justify-between items-start mb-4">
            <div className={`p-2 rounded-lg ${alert ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
                <Icon className="w-5 h-5" />
            </div>
            {trend && (
                <span className={`text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1 ${trend === 'up' && !alert ? 'bg-emerald-100 text-emerald-700' :
                        trend === 'down' && alert ? 'bg-emerald-100 text-emerald-700' :
                            trend === 'down' ? 'bg-rose-100 text-rose-700' :
                                'bg-slate-100 text-slate-600'
                    }`}>
                    {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {trendValue}
                </span>
            )}
        </div>
        <div className="text-2xl font-bold text-slate-900">{value}</div>
        <div className="text-sm text-slate-500">{label}</div>
        {subtext && <div className="text-xs text-slate-400 mt-1">{subtext}</div>}
    </div>
);

export const Badge = ({ type, text }: { type: string; text: string }) => {
    const styles: Record<string, string> = {
        success: "bg-emerald-100 text-emerald-700 border-emerald-200",
        warning: "bg-amber-100 text-amber-700 border-amber-200",
        danger: "bg-rose-100 text-rose-700 border-rose-200",
        neutral: "bg-slate-100 text-slate-600 border-slate-200",
        primary: "bg-teal-100 text-teal-700 border-teal-200",
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
        primary: "bg-teal-600 text-white hover:bg-teal-700 focus:ring-teal-500 shadow-sm",
        secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus:ring-slate-200 shadow-sm",
        danger: "bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-500",
        ghost: "text-slate-600 hover:bg-slate-100",
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
        className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${checked ? 'bg-teal-600' : 'bg-slate-300'}`}
    >
        <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`}></div>
    </div>
);
