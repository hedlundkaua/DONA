export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label="DONA"
    >
      <circle cx="24" cy="24" r="22" fill="#fff" stroke="#9c1155" strokeWidth="1.6" />
      <circle cx="24" cy="24" r="18.4" fill="none" stroke="#e5176e" strokeWidth="0.9" strokeDasharray="1 2.4" />
      <text
        x="24"
        y="27"
        textAnchor="middle"
        fill="#10235c"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="9.4"
        fontWeight="700"
        letterSpacing="0.5"
      >
        DONA
      </text>
      <path d="M14 33c3 1.6 6.4 2.4 10 2.4s7-.8 10-2.4" fill="none" stroke="#e5176e" strokeWidth="0.8" strokeLinecap="round" />
    </svg>
  );
}
