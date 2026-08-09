import { cn } from "@voidhash/ui";

export function GooglePlayLogo({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn("h-5 w-5", className)}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M3.6 2.7 14.3 12 3.6 21.3a2 2 0 0 1-.6-1.4V4.1c0-.6.2-1 .6-1.4Z" fill="#34A853" />
      <path d="M14.3 12 17.5 9.2l3.3 1.9c.9.5.9 1.8 0 2.3l-3.3 1.9L14.3 12Z" fill="#FBBC04" />
      <path d="m3.6 2.7 13.9 6.5L14.3 12 3.6 2.7Z" fill="#4285F4" />
      <path d="M3.6 21.3 14.3 12l3.2 3.3-13.9 6Z" fill="#EA4335" />
    </svg>
  );
}
