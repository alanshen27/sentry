import { cn } from "@/lib/utils";

interface LogoMarkProps {
  className?: string;
  /** pixel size of the square mark */
  size?: number;
  shieldColor?: string;
  arrowColor?: string;
}

/**
 * Sentry brand mark — a heraldic shield enclosing an upward navigation
 * spearhead. Mirrors public/logo.png as scalable, themeable SVG.
 */
export function LogoMark({
  className,
  size = 24,
  shieldColor = "currentColor",
  arrowColor = "#ef4444",
}: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Sentry"
    >
      <path
        d="M14 8H34C36.209 8 38 9.791 38 12V26C38 33 30.5 37.5 24 40.5C17.5 37.5 10 33 10 26V12C10 9.791 11.791 8 14 8Z"
        stroke={shieldColor}
        strokeWidth="2.75"
        strokeLinejoin="round"
      />
      <path
        d="M24 13L31 31L24 27L17 31L24 13Z"
        fill={arrowColor}
        stroke={arrowColor}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface LogoProps {
  className?: string;
  size?: number;
  /** show the "Sentry" wordmark next to the mark */
  showWordmark?: boolean;
  wordmarkClassName?: string;
}

export function Logo({ className, size = 24, showWordmark = true, wordmarkClassName }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <LogoMark size={size} className="text-slate-400" />
      {showWordmark && (
        <span className={cn("font-semibold tracking-tight", wordmarkClassName)}>Sentry</span>
      )}
    </div>
  );
}
