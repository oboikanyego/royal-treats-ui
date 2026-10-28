import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from './api-client.service';
import { ApiRequestError } from './api-errors';
import type { ApiUser, AuthResponse } from './api-types';

/** Accounts and the signed-in user's profile (royal-treats-api /auth and /me). */
@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly api = inject(ApiClient);

  register(input: {
    name: string;
    email: string;
    phone: string;
    password: string;
    acceptedTerms: true;
    remember?: boolean;
  }) {
    return firstValueFrom(this.api.post<AuthResponse>('/auth/register', input));
  }
  login(email: string, password: string, remember = false) {
    return firstValueFrom(
      this.api.post<AuthResponse>('/auth/login', { email, password, remember }),
    );
  }
  /** Revokes the current token on the server. */
  logout() {
    return firstValueFrom(this.api.post<void>('/auth/logout'));
  }
  me() {
    return firstValueFrom(this.api.get<ApiUser>('/me'));
  }
  /** Changes name and phone (the email and role cannot be changed). */
  updateProfile(input: { name: string; phone: string }) {
    return firstValueFrom(this.api.patch<ApiUser>('/me', input));
  }
  /** Every other sign-in of this user is ended by the API; this one stays. */
  changePassword(currentPassword: string, newPassword: string) {
    return firstValueFrom(this.api.post<void>('/me/password', { currentPassword, newPassword }));
  }
  /** Asks the API to email a reset link. It answers the same for any address. */
  forgotPassword(email: string) {
    return firstValueFrom(this.api.post<{ ok: true }>('/auth/forgot-password', { email }));
  }
  /** Sets a new password with the one-time token from the email; ends every session of the account. */
  resetPassword(token: string, newPassword: string) {
    return firstValueFrom(this.api.post<void>('/auth/reset-password', { token, newPassword }));
  }
  uploadPhoto(file: File) {
    const form = new FormData();
    form.set('photo', file); // the API reads the multipart field named `photo`
    return firstValueFrom(this.api.put<void>('/me/photo', form));
  }
  /** The profile picture, or null when the user has none (the API answers 404). */
  async photo(): Promise<Blob | null> {
    try {
      return await firstValueFrom(this.api.getBlob('/me/photo'));
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 404) return null;
      throw error;
    }
  }
}
