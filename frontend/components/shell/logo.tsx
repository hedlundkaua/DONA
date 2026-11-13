export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label="Logo DONA Empreendedoras Restinga"
    >
      <circle cx="24" cy="24" r="22" fill="#fff" stroke="#9c1155" strokeWidth="1.6" />
      <circle cx="24" cy="24" r="18.4" fill="none" stroke="#e5176e" strokeWidth="0.9" strokeDasharray="1 2.4" />
      <text
        x="24"
        y="23"
        textAnchor="middle"
        fill="#10235c"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="8.2"
        fontWeight="700"
        letterSpacing="0.4"
      >
        DONA
      </text>
      <text
        x="24"
        y="28.4"
        textAnchor="middle"
        fill="#9c1155"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="4.2"
        fontStyle="italic"
        letterSpacing="0.2"
      >
        Restinga
      </text>
      <path d="M14 31.5c3 1.6 6.4 2.4 10 2.4s7-.8 10-2.4" fill="none" stroke="#e5176e" strokeWidth="0.8" strokeLinecap="round" />
    </svg>
  );
}
