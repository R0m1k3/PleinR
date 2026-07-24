import type { SocialLink } from "@/lib/site-settings";

const PATHS: Record<SocialLink["network"], string> = {
  facebook:
    "M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.5-3.91 3.77-3.91 1.09 0 2.23.2 2.23.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.44 2.91h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94Z",
  linkedin:
    "M6.94 5.5a2.06 2.06 0 1 1-4.12 0 2.06 2.06 0 0 1 4.12 0ZM6.6 9.05H3.15V21H6.6V9.05Zm5.52 0H8.8V21h3.32v-6.27c0-3.1 4-3.35 4-.01V21h3.33v-7.42c0-5.26-5.94-5.07-7.33-2.48V9.05Z",
};

export const SOCIAL_BRAND: Record<SocialLink["network"], string> = {
  facebook: "#1877F2",
  linkedin: "#0A66C2",
};

export function SocialIcon({ network, size = 18 }: { network: SocialLink["network"]; size?: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" width={size} height={size} style={{ display: "block" }}>
      <path d={PATHS[network]} />
    </svg>
  );
}
