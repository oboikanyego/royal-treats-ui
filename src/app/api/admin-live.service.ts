import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { Title } from '@angular/platform-browser';
import type { Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { AdminApi } from './admin-api.service';
import { SessionService } from './session.service';
import {
  type LiveAlert,
  addAlert,
  alertText,
  isLiveOrder,
  pendingCount,
  socketOrigin,
  titleWithCount,
} from './live-view';

const SOUND_KEY = 'royal-alert-sound';

/**
 * Live updates for a signed-in admin over Socket.IO: a new order raises an alert, and the number of
 * Pending orders is kept current. Customers and couriers never connect. The socket library is only
 * downloaded for admins, so it adds nothing to the storefront.
 */
@Injectable({ providedIn: 'root' })
export class AdminLive {
  private readonly sessions = inject(SessionService);
  private readonly title = inject(Title);
  private readonly admin = inject(AdminApi);
  private requestsTimer: ReturnType<typeof setInterval> | null = null;
  private socket: Socket | null = null;
  /** Bumped on every attempt, so a connection that finishes loading after a sign-out is dropped. */
  private attempt = 0;
  private audio: AudioContext | null = null;

  /** Pending orders, or null until the API has said (or when not connected). */
  readonly pending = signal<number | null>(null);
  /** People waiting for the shop to approve a new password, or null until the API has said. */
  readonly passwordRequests = signal<number | null>(null);
  readonly alerts = signal<LiveAlert[]>([]);
  /** Goes up whenever the API reports something that may change an orders list, so lists refresh. */
  readonly changes = signal(0);
  readonly soundOn = signal(readSound());

  constructor() {
    effect(() => {
      const user = this.sessions.user();
      untracked(() => {
        const token = this.sessions.token();
        if (user?.role === 'admin' && token) void this.connect(token);
        else this.disconnect();
      });
    });
    effect(() => {
      const count = this.pending();
      untracked(() => this.title.setTitle(titleWithCount(this.title.getTitle(), count)));
    });
  }

  /** For the title strategy: a navigation resets the title, so the count is put back. */
  withCount(title: string): string {
    return titleWithCount(title, this.pending());
  }

  dismiss(id: string): void {
    this.alerts.update((list) => list.filter((a) => a.id !== id));
  }

  setSound(on: boolean): void {
    this.soundOn.set(on);
    try {
      localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
    } catch {
      // Storage is blocked; the choice just lasts until the page is closed.
    }
    if (on) this.beep();
  }

  private async connect(token: string): Promise<void> {
    this.disconnect();
    const attempt = ++this.attempt;
    // After a page reload the browser only lets audio start once the admin has clicked something.
    document.addEventListener('pointerdown', () => this.unlockAudio(), { once: true });
    void this.refreshPasswordRequests();
    this.requestsTimer = setInterval(() => void this.refreshPasswordRequests(), 60_000);
    const { io } = await import('socket.io-client');
    if (attempt !== this.attempt) return;
    const socket = io(socketOrigin(environment.apiUrl), { auth: { token } });
    this.socket = socket;
    socket.on('orders:pending', (payload: unknown) => {
      const count = pendingCount(payload);
      if (count !== null) this.pending.set(count);
      this.changes.update((n) => n + 1);
    });
    socket.on('order:new', (payload: unknown) => {
      if (!isLiveOrder(payload)) return;
      this.alerts.update((list) => addAlert(list, { id: payload.id, text: alertText(payload) }));
      this.changes.update((n) => n + 1);
      this.beep();
    });
    // A refused token (signed out elsewhere, expired) will not start working by retrying.
    socket.on('connect_error', (error: Error) => {
      if (error.message === 'Not allowed') socket.disconnect();
    });
  }

  /** Password requests do not arrive over the socket, so the count is asked for on sign-in and every minute. */
  async refreshPasswordRequests(): Promise<void> {
    try {
      this.passwordRequests.set((await this.admin.dashboard()).passwordRequests ?? 0);
    } catch {
      // Keep the last count; the next minute asks again.
    }
  }

  private disconnect(): void {
    if (this.requestsTimer) clearInterval(this.requestsTimer);
    this.requestsTimer = null;
    this.passwordRequests.set(null);
    this.attempt++;
    this.socket?.disconnect();
    this.socket = null;
    this.pending.set(null);
    this.alerts.set([]);
  }

  private unlockAudio(): void {
    try {
      this.audio ??= new AudioContext();
      void this.audio.resume();
    } catch {
      // No audio available.
    }
  }

  /** Two short rising tones; browsers that block audio until a click simply stay silent. */
  private beep(): void {
    if (!this.soundOn()) return;
    try {
      const ctx = (this.audio ??= new AudioContext());
      void ctx.resume();
      [880, 1175].forEach((frequency, i) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = ctx.currentTime + i * 0.18;
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.15, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
        oscillator.connect(gain).connect(ctx.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.17);
      });
    } catch {
      // No audio available.
    }
  }
}

function readSound(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}
