import { Injectable, signal } from '@angular/core';
import type { ApiUser } from './api-types';
import { TokenStore, safeSessionStorage } from './token-store';

/**
 * Who is signed in through the API: the user, their picture, and the bearer token (kept in
 * sessionStorage by TokenStore). The HTTP interceptor reads the token from here.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly tokens = new TokenStore(safeSessionStorage());
  readonly user = signal<ApiUser | null>(null);
  /** Object URL of the profile picture, when there is one. */
  readonly photoUrl = signal<string | null>(null);
  /** True while a saved session is being checked after a page load. */
  readonly restoring = signal(false);
  /** Set when the server rejected our token, so the sign-in screen can say why. */
  readonly expired = signal(false);

  token(): string | null {
    return this.tokens.read();
  }

  start(user: ApiUser, token: string, expiresAt: string): void {
    this.tokens.write(token, expiresAt);
    this.expired.set(false);
    this.user.set(user);
  }

  setPhoto(blob: Blob | null): void {
    const previous = this.photoUrl();
    if (previous) URL.revokeObjectURL(previous);
    this.photoUrl.set(blob ? URL.createObjectURL(blob) : null);
  }

  /** Forget the session. `expired` marks a rejected token rather than a deliberate sign-out. */
  clear(expired = false): void {
    this.tokens.clear();
    this.user.set(null);
    this.setPhoto(null);
    this.expired.set(expired);
  }
}
