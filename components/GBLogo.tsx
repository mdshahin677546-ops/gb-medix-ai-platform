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
  const deepBlueId = `${gradientId}-deep-blue`;
  const glowId = `${gradientId}-glow`;

  return (
    <span className="gb-logo-lockup group inline-flex items-center gap-3">
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
              <stop offset="0.24" stopColor="#dce7f2" />
              <stop offset="0.5" stopColor="#7d8996" />
              <stop offset="0.72" stopColor="#f7fbff" />
              <stop offset="1" stopColor="#435064" />
            </linearGradient>
            <linearGradient id={deepBlueId} x1="22" x2="78" y1="16" y2="62">
              <stop offset="0" stopColor="#0f7cff" stopOpacity="0.92" />
              <stop offset="0.45" stopColor="#071a42" stopOpacity="0.96" />
              <stop offset="1" stopColor="#35e8ff" stopOpacity="0.82" />
            </linearGradient>
            <linearGradient id={glowId} x1="20" x2="76" y1="54" y2="28">
              <stop offset="0" stopColor="#27d7ff" stopOpacity="0.08" />
              <stop offset="0.5" stopColor="#63f5d7" stopOpacity="0.95" />
              <stop offset="1" stopColor="#27d7ff" stopOpacity="0.12" />
            </linearGradient>
          </defs>

          <path
            d="M46.2 32.2C36 13.7 18.6 8.6 11.3 15.8C6.9 20.1 9.5 32.4 27.3 36.2C18.8 40.3 15.9 52.7 23.7 58.1C30.3 62.7 40.9 52.6 46.2 35.5Z"
            fill={`url(#${deepBlueId})`}
            opacity="0.72"
          />
          <path
            d="M49.8 32.2C60 13.7 77.4 8.6 84.7 15.8C89.1 20.1 86.5 32.4 68.7 36.2C77.2 40.3 80.1 52.7 72.3 58.1C65.7 62.7 55.1 52.6 49.8 35.5Z"
            fill={`url(#${deepBlueId})`}
            opacity="0.72"
          />
          <path
            d="M45.1 16.2C31.4 16.6 18.9 23 13.9 31.2C24 30.2 35.1 31.8 44.9 39.9C36 39.7 26 43.2 20.2 50.8C31.5 51.3 41.2 45.2 48 35.7Z"
            fill="none"
            stroke={`url(#${silverId})`}
            strokeLinejoin="round"
            strokeWidth="5.8"
          />
          <path
            d="M50.9 16.2C64.6 16.6 77.1 23 82.1 31.2C72 30.2 60.9 31.8 51.1 39.9C60 39.7 70 43.2 75.8 50.8C64.5 51.3 54.8 45.2 48 35.7Z"
            fill="none"
            stroke={`url(#${silverId})`}
            strokeLinejoin="round"
            strokeWidth="5.8"
          />
          <path
            d="M25 47.4C38.9 37.6 57.1 37.6 71 47.4"
            fill="none"
            stroke={`url(#${glowId})`}
            strokeLinecap="round"
            strokeWidth="2.5"
          />
          <path
            d="M48 18C53.4 26.4 54.5 43.8 48 61C41.5 43.8 42.6 26.4 48 18Z"
            fill="#0c1728"
            stroke="#f3f8ff"
            strokeWidth="1.55"
          />
          <path d="M48 25.8V49" stroke="#63f5d7" strokeLinecap="round" strokeWidth="1.25" />
          <path d="M42.5 13.4C45.4 10 47 8.9 48.1 8.6" stroke="#f4f9ff" strokeLinecap="round" strokeWidth="1.35" />
          <path d="M53.5 13.4C50.6 10 49.1 8.9 47.9 8.6" stroke="#f4f9ff" strokeLinecap="round" strokeWidth="1.35" />
          <circle cx="42.2" cy="13.1" r="1.8" fill="#63f5d7" />
          <circle cx="53.8" cy="13.1" r="1.8" fill="#63f5d7" />
          <path d="M34 48.2h28" stroke="#27d7ff" strokeLinecap="round" strokeOpacity="0.68" strokeWidth="1" />
        </svg>
      </span>
      {showText ? (
        <span className={`gb-wordmark gb-wordmark-switch block ${titleSize} leading-5`} aria-label="GB Medix AI, Grey Butterfly">
          <span className="gb-wordmark-face gb-wordmark-primary" aria-hidden="true">
            <span>GB</span>
            <span className="gb-wordmark-accent">MEDIX</span>
            <span>AI</span>
          </span>
          <span className="gb-wordmark-face gb-wordmark-reveal" aria-hidden="true">
            GREY BUTTERFLY
          </span>
        </span>
      ) : null}
    </span>
  );
}
