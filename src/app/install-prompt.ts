/** What the visitor is using, as far as "Add to Home Screen" is concerned. */
export type InstallPlatform = 'installed' | 'ios' | 'android' | 'other';

export type PlatformFacts = {
  userAgent: string;
  /** Mac desktop Safari and iPadOS both say "Macintosh"; only the iPad has a touch screen. */
  maxTouchPoints: number;
  /** Already running from the Home Screen (display-mode: standalone, or iOS's navigator.standalone). */
  standalone: boolean;
};

/** Phones and tablets that can keep a shortcut; desktops get nothing. */
export function installPlatform(facts: PlatformFacts): InstallPlatform {
  if (facts.standalone) return 'installed';
  const ua = facts.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && facts.maxTouchPoints > 1))
    return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

/** The browser's own install prompt (Chrome on Android), saved until we choose to show it. */
export type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export const ASKED_KEY = 'royal-home-screen-asked';
