import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "text-sm font-semibold select-none",
    "transition-all duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-40",
    "rounded-2xl",
    "bg-[var(--background)] neo-raised",
    "active:neo-pressed active:scale-[0.98]",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "text-primary",
        destructive: "text-destructive",
        outline: "text-foreground",
        secondary: "text-muted-foreground",
        ghost: [
          "neo-flat shadow-none",
          "text-muted-foreground hover:text-foreground",
          "hover:neo-raised-sm hover:bg-[var(--background)]",
          "active:bg-[var(--background)]",
        ].join(" "),
        link: "neo-flat shadow-none bg-transparent text-primary underline-offset-4 hover:underline active:scale-100",
        filled: "bg-primary text-white neo-raised hover:bg-primary/90 active:bg-primary/80",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 px-4 text-xs rounded-xl",
        lg: "h-12 px-8 rounded-2xl text-base",
        icon: "h-10 w-10 rounded-2xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
