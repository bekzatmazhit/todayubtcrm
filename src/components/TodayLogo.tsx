export function TodayLogo({ size = 64, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Background circle */}
      <circle cx="60" cy="60" r="58" fill="url(#grad)" stroke="url(#grad)" strokeWidth="2" />

      {/* Letter T - stylized */}
      <path
        d="M32 38h56v8H64v38h-8V46H32v-8z"
        fill="white"
        opacity="0.95"
      />

      {/* Accent dot */}
      <circle cx="88" cy="76" r="6" fill="white" opacity="0.9" />

      {/* Subtle book/learning lines */}
      <path
        d="M36 82c8-4 16-6 24-6s16 2 24 6"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.4"
        fill="none"
      />
      <path
        d="M40 88c6-3 13-5 20-5s14 2 20 5"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.25"
        fill="none"
      />

      <defs>
        <linearGradient id="grad" x1="0" y1="0" x2="120" y2="120">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="50%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
    </svg>
  );
}
