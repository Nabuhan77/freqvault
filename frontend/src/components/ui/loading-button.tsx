import * as React from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

export const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ className, loading, loadingText, children, disabled, variant, size, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        className={cn(className)}
        disabled={disabled || loading}
        variant={variant}
        size={size}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {loadingText || "Loading..."}
          </>
        ) : (
          children
        )}
      </Button>
    );
  }
);

LoadingButton.displayName = "LoadingButton"; 