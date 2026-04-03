"use client";

import React from "react";
import { Button as BaseButton, Card as BaseCard, cn } from "@wardline/ui";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

export const neoFieldClass =
  "w-full rounded-2xl border-0 bg-[var(--background)] px-3 py-2.5 text-sm text-foreground neo-inset outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/30 placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60";

export const neoSelectClass = neoFieldClass;

export const Card = ({
  children,
  className = "",
  title,
  action,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
}) => (
  <BaseCard className={cn("flex flex-col", className)}>
    {(title || action) && (
      <div className="mb-4 flex items-center justify-between">
        {title && <h3 className="font-semibold text-foreground">{title}</h3>}
        {action && <div>{action}</div>}
      </div>
    )}
    <div className="flex-1">{children}</div>
  </BaseCard>
);

export const StatCard = ({
  label,
  value,
  subtext,
  icon: Icon,
  trend,
  trendValue,
  alert,
}: {
  label: string;
  value: string | number;
  subtext?: string;
  icon: React.ElementType;
  trend?: "up" | "down";
  trendValue?: string;
  alert?: boolean;
}) => (
  <div className="rounded-3xl bg-card p-5 neo-raised">
    <div className="mb-4 flex items-start justify-between">
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--background)] neo-raised-sm ${alert ? "text-destructive" : "text-primary"}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      {trend && (
        <span
          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
            (trend === "up" && !alert) || (trend === "down" && alert)
              ? "bg-emerald-500/10 text-emerald-600"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {trend === "up" ? (
            <ArrowUpRight className="h-3 w-3" />
          ) : (
            <ArrowDownRight className="h-3 w-3" />
          )}
          {trendValue}
        </span>
      )}
    </div>
    <div className="text-2xl font-semibold text-foreground">{value}</div>
    <div className="mt-0.5 text-sm text-muted-foreground">{label}</div>
    {subtext && <div className="mt-1 text-xs text-muted-foreground/70">{subtext}</div>}
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
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[type] || styles.neutral}`}>
      {text}
    </span>
  );
};

export const Button = ({
  children,
  variant = "primary",
  icon: Icon,
  className = "",
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  variant?: string;
  icon?: React.ElementType;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}) => {
  const variants: Record<string, "default" | "secondary" | "destructive" | "ghost" | "filled"> = {
    primary: "default",
    secondary: "secondary",
    danger: "destructive",
    ghost: "ghost",
    filled: "filled",
  };

  return (
    <BaseButton
      type="button"
      variant={variants[variant] ?? "default"}
      className={className}
      onClick={onClick}
      disabled={disabled}
    >
      {Icon && <Icon className="mr-2 h-4 w-4" />}
      {children}
    </BaseButton>
  );
};

export const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) => (
  <div
    onClick={() => onChange(!checked)}
    className="flex h-6 w-12 cursor-pointer items-center rounded-full bg-[var(--background)] p-0.5 transition-all duration-200 neo-inset"
  >
    <div
      className={[
        "h-5 w-5 rounded-full transition-all duration-200 neo-raised-sm",
        checked ? "translate-x-6 bg-primary" : "translate-x-0 bg-[var(--background)]",
      ].join(" ")}
    />
  </div>
);
