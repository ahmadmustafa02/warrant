export function WarrantMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="10" fill="currentColor" />
      <path
        d="M16 8.2 22 11v6.2c0 4.2-2.5 6.8-6 8.2-3.5-1.4-6-4-6-8.2V11l6-2.8Z"
        fill="white"
      />
      <path
        d="M13.2 16.3 15.3 18.3 19.2 14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
