import { Injectable, signal } from '@angular/core';
import {
  ASKED_KEY,
  type BeforeInstallPromptEvent,
  type InstallPlatform,
  installPlatform,
} from './install-prompt';

/**
 * Offers to put the shop on the phone's Home Screen. Chrome on Android lets us trigger its own install
 * prompt; iPhones do not, so there we only show the steps (Share, then Add to Home Screen). The offer is
 * made once per device, and never to someone already using the Home Screen shortcut or on a computer.
 */
@Injectable({ providedIn: 'root' })
export class InstallPrompt {
  /** Chrome's install prompt, once it has said the site can be installed. */
  private deferred: BeforeInstallPromptEvent | null = null;
  /** True while Chrome's prompt is available, so the card can offer a real button. */
  readonly nativeReady = signal(false);
  readonly platform = signal<InstallPlatform>(this.detect());

  constructor() {
    // Chrome fires this early, long before checkout, so it is listened for from the start.
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.deferred = event as BeforeInstallPromptEvent;
      this.nativeReady.set(true);
    });
    window.addEventListener('appinstalled', () => {
      this.deferred = null;
      this.nativeReady.set(false);
      this.platform.set('installed');
      this.remember();
    });
  }

  /** Whether to show the card now: on a phone, not installed, and not asked before on this device. */
  shouldOffer(): boolean {
    return (this.platform() === 'ios' || this.platform() === 'android') && !this.alreadyAsked();
  }

  /** Records that the offer was made, so the same device is not asked again. */
  markAsked(): void {
    this.remember();
  }

  /** Shows Chrome's install prompt. Resolves to whether the person accepted. */
  async install(): Promise<boolean> {
    const event = this.deferred;
    if (!event) return false;
    this.deferred = null;
    this.nativeReady.set(false);
    await event.prompt();
    const choice = await event.userChoice;
    return choice.outcome === 'accepted';
  }

  private detect(): InstallPlatform {
    return installPlatform({
      userAgent: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints ?? 0,
      standalone:
        window.matchMedia?.('(display-mode: standalone)').matches === true ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true,
    });
  }

  private alreadyAsked(): boolean {
    try {
      return localStorage.getItem(ASKED_KEY) !== null;
    } catch {
      return false;
    }
  }

  private remember(): void {
    try {
      localStorage.setItem(ASKED_KEY, new Date().toISOString());
    } catch {
      // Storage is blocked; the card may show again on a later order.
    }
  }
}
