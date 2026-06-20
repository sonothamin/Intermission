import React from "react";

interface GoogleButtonProps {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  children?: React.ReactNode;
}

/**
 * Renders the multicolored "G" Google "G" logo. We use the official SVG
 * paths rather than an image so the colors stay crisp at any size and the
 * component has no external network dependencies.
 */
const GoogleG: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    width="18"
    height="18"
    viewBox="0 0 18 18"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9082c1.7018-1.5668 2.6841-3.874 2.6841-6.615z"
      fill="#4285F4"
    />
    <path
      d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9082-2.2581c-.806.54-1.8368.8595-3.0482.8595-2.3441 0-4.3282-1.5831-5.0359-3.7104H.9573v2.3318C2.4382 15.9831 5.4818 18 9 18z"
      fill="#34A853"
    />
    <path
      d="M3.9641 10.71c-.18-.54-.2823-1.1168-.2823-1.71s.1023-1.17.2823-1.71V4.9582H.9573C.3477 6.1731 0 7.5477 0 9c0 1.4523.3477 2.8268.9573 4.0418L3.9641 10.71z"
      fill="#FBBC05"
    />
    <path
      d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.4259 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.9641 7.29C4.6718 5.1627 6.6559 3.5795 9 3.5795z"
      fill="#EA4335"
    />
  </svg>
);

/**
 * Pixel-faithful replacement for the GSI "Continue with Google" pill.
 * Uses the same filled-white background, dark text, and pill shape so
 * the rest of the auth card stays visually consistent.
 */
export const GoogleButton: React.FC<GoogleButtonProps> = ({
  onClick,
  disabled = false,
  label = "Continue with Google",
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={[
        "w-full min-h-[44px] flex items-center justify-center gap-3",
        "rounded-full bg-white text-[#1f1f1f] font-medium text-[15px]",
        "border border-[#dadce0] shadow-sm",
        "transition-colors hover:bg-[#f7f8f8] active:bg-[#eee]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1a73e8]/40",
        disabled ? "pointer-events-none opacity-50" : "cursor-pointer",
      ].join(" ")}
    >
      <GoogleG className="shrink-0" />
      <span className="leading-none">{label}</span>
    </button>
  );
};
