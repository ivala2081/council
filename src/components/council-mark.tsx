export function CouncilMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17 7.5C15.5 5.5 13 4.5 10.5 5C7.5 5.5 5.5 8 5.5 11C5.5 14 7.5 16.5 10.5 17C13 17.5 15.5 16.5 17 14.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M15 9.5C14 8.5 12.5 8 11 8.5C9.5 9 8.5 10.5 8.5 12C8.5 13.5 9.5 15 11 15.5C12.5 16 14 15.5 15 14.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="18" cy="6" r="1.5" fill="currentColor" />
      <circle cx="18" cy="18" r="1.5" fill="currentColor" />
      <circle cx="19.5" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}
