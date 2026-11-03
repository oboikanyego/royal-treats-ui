import { Injectable, NgZone, inject, signal } from '@angular/core';

/** How long a tab must have been out of sight before coming back counts as a wake-up. */
export const IDLE_MS = 60_000;
/** Two wake-ups closer than this are one (a tab switch fires several events at once). */
const SETTLE_MS = 3_000;

/**
 * Works out when a tab has really been asleep: hidden for at least `idleMs`. A quick switch away and
 * back is not a wake-up, and neither is a second event arriving right after the first.
 */
export class IdleTracker {
  private hiddenAt: number | null = null;
  private lastWake = -Infinity;

  constructor(
    private readonly idleMs = IDLE_MS,
    private readonly settleMs = SETTLE_MS,
  ) {}

  /** The tab went out of sight (or the phone locked) at `now`. */
  hide(now: number): void {
    this.hiddenAt ??= now;
  }

  /** The tab is back at `now`. True when it should refresh what it shows. */
  show(now: number, restoredFromCache = false): boolean {
    const away = this.hiddenAt === null ? 0 : now - this.hiddenAt;
    this.hiddenAt = null;
    if (now - this.lastWake < this.settleMs) return false;
    if (!restoredFromCache && away < this.idleMs) return false;
    this.lastWake = now;
    return true;
  }
}

/**
 * Wakes the app when a left-alone tab comes back (phone unlocked, tab reopened, connection restored).
 * Browsers pause timers and sockets in hidden tabs, so what is on screen can be stale and the sign-in
 * may have ended. Each screen that shows live data watches `woke` and refreshes itself.
 */
@Injectable({ providedIn: 'root' })
export class WakeUp {
  /** Goes up by one every time the app wakes. */
  readonly woke = signal(0);
  private readonly zone = inject(NgZone);
  private readonly tracker = new IdleTracker();

  constructor() {
    this.zone.runOutsideAngular(() => {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') this.tracker.hide(Date.now());
        else this.wake(this.tracker.show(Date.now()));
      });
      // Back/forward cache: the page was frozen whole, so it is always stale when it returns.
      window.addEventListener('pageshow', (event) => {
        if (event.persisted) this.wake(this.tracker.show(Date.now(), true));
      });
      // Coming back online after a dropped connection.
      window.addEventListener('online', () => this.wake(this.tracker.show(Date.now(), true)));
    });
  }

  private wake(should: boolean): void {
    if (should) this.zone.run(() => this.woke.update((n) => n + 1));
  }
}
