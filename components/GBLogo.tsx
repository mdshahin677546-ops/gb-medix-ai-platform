import { useId } from "react";

type GBLogoProps = {
  size?: "sm" | "md";
  showText?: boolean;
};

export function GBLogo({ size = "md", showText = true }: GBLogoProps) {
  const gradientId = useId();
  const markSize = size === "sm" ? "h-10 w-12" : "h-12 w-14";
  const titleSize = size === "sm" ? "text-[15px]" : "text-[17px]";
  const silverId = `${gradientId}-silver`;
  const glassId = `${gradientId}-glass`;
  const glowId = `${gradientId}-glow`;

  return (
    <span className="group inline-flex items-center gap-3">
      <span
        className={[
          "gb-logo-mark relative grid shrink-0 place-items-center rounded-md",
          markSize
        ].join(" ")}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 96 72"
          className="relative z-10 h-full w-full"
          role="img"
          aria-label="Grey Butterfly GB logo"
        >
          <defs>
            <linearGradient id={silverId} x1="18" x2="80" y1="8" y2="58">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.24" stopColor="#d5dce4" />
              <stop offset="0.54" stopColor="#7d8996" />
              <stop offset="0.78" stopColor="#f6f8fb" />
              <stop offset="1" stopColor="#3a4654" />
            </linearGradient>
            <linearGradient id={glassId} x1="18" x2="74" y1="18" y2="64">
              <stop offset="0" stopColor="#2a3b4e" stopOpacity="0.68" />
              <stop offset="0.55" stopColor="#102237" stopOpacity="0.9" />
              <stop offset="1" stopColor="#050d18" stopOpacity="0.96" />
            </linearGradient>
            <linearGradient id={glowId} x1="20" x2="76" y1="54" y2="28">
              <stop offset="0" stopColor="#27d7ff" stopOpacity="0.04" />
              <stop offset="0.5" stopColor="#63f5d7" stopOpacity="0.9" />
              <stop offset="1" stopColor="#27d7ff" stopOpacity="0.08" />
            </linearGradient>
          </defs>
          <path
            d="M45.7 30.8C35.2 11.4 18.4 7.1 11.8 14.4C7.9 18.7 9.8 31.3 26.9 35.4C19.4 39.6 16.4 52.3 23.6 57.7C29.5 62.1 39.8 52.4 45.7 35.3Z"
            fill={`url(#${glassId})`}
            stroke="rgba(183, 238, 255, 0.22)"
            strokeWidth="1"
          />
          <path
            d="M50.3 30.8C60.8 11.4 77.6 7.1 84.2 14.4C88.1 18.7 86.2 31.3 69.1 35.4C76.6 39.6 79.6 52.3 72.4 57.7C66.5 62.1 56.2 52.4 50.3 35.3Z"
            fill={`url(#${glassId})`}
            stroke="rgba(183, 238, 255, 0.22)"
            strokeWidth="1"
          />
          <path
            d="M45 16.5C31 16.9 18.7 23.4 14.1 31.2C24.2 30.1 34.7 31.4 44.5 39.5C35.3 39 26.2 42.2 20.7 49.8C31.2 50.6 40.7 45.4 48 36.1Z"
            fill="none"
            stroke={`url(#${silverId})`}
            strokeLinejoin="round"
            strokeWidth="5.4"
          />
          <path
            d="M51 16.5C65 16.9 77.3 23.4 81.9 31.2C71.8 30.1 61.3 31.4 51.5 39.5C60.7 39 69.8 42.2 75.3 49.8C64.8 50.6 55.3 45.4 48 36.1Z"
            fill="none"
            stroke={`url(#${silverId})`}
            strokeLinejoin="round"
            strokeWidth="5.4"
          />
          <path
            d="M25 47.3C38.8 37.4 57.2 37.4 71 47.3"
            fill="none"
            stroke={`url(#${glowId})`}
            strokeLinecap="round"
            strokeWidth="2.2"
          />
          <path
            d="M48 18.5C53.2 26.5 54.3 43.6 48 60.7C41.7 43.6 42.8 26.5 48 18.5Z"
            fill="#101825"
            stroke="#dbe6ef"
            strokeWidth="1.4"
          />
          <path d="M48 26.2V48.6" stroke="#63f5d7" strokeLinecap="round" strokeWidth="1.2" />
          <path d="M42.5 13.5C45.3 10.1 46.9 9.1 48.1 8.8" stroke="#dfe8f2" strokeLinecap="round" strokeWidth="1.3" />
          <path d="M53.5 13.5C50.7 10.1 49.1 9.1 47.9 8.8" stroke="#dfe8f2" strokeLinecap="round" strokeWidth="1.3" />
          <circle cx="42.2" cy="13.2" r="1.7" fill="#63f5d7" />
          <circle cx="53.8" cy="13.2" r="1.7" fill="#63f5d7" />
          <path d="M34 48.4h28" stroke="#27d7ff" strokeLinecap="round" strokeOpacity="0.55" strokeWidth="1" />
        </svg>
      </span>
      {showText ? (
        <span className={`gb-wordmark block ${titleSize} leading-5`} aria-label="GB Medix AI">
          <span>GB</span>
          <span className="gb-wordmark-accent">MEDIX</span>
          <span>AI</span>
        </span>
      ) : null}
    </span>
  );
}
