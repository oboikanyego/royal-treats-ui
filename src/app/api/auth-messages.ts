import type { ApiRequestError } from './api-errors';

export type AuthContext = 'login' | 'register' | 'photo';
const TOO_MANY = 'Too many attempts. Please wait a few minutes and try again.';

/** The API's `details` are `{ path, message }` per invalid field. */
function firstInvalidField(details: unknown): string | undefined {
  if (!Array.isArray(details)) return undefined;
  const path = (details[0] as { path?: unknown } | undefined)?.path;
  return Array.isArray(path) && typeof path[0] === 'string' ? path[0] : undefined;
}

const FIELD_HELP: Record<string, string> = {
  name: 'Enter your full name (at least 2 characters).',
  email: 'Enter a valid email address.',
  phone: 'Enter a valid phone number, 9 to 16 digits.',
  password: 'Use a password of 12 to 128 characters.',
};

/** A message a customer can act on, instead of the API's developer-facing text. */
export function authErrorMessage(error: ApiRequestError, context: AuthContext): string {
  if (error.status === 0) return error.message; // already friendly: cannot reach / too slow
  if (error.status === 429) return TOO_MANY;
  if (context === 'login') {
    if (error.status === 401) return 'Incorrect email or password.';
    return 'We could not sign you in. Please try again.';
  }
  if (context === 'register') {
    if (error.status === 409) return 'That email is already registered.';
    if (error.status === 400) {
      const field = firstInvalidField(error.details);
      return (field && FIELD_HELP[field]) || 'Please check your details and try again.';
    }
    return 'We could not create your account. Please try again.';
  }
  if (error.status === 401) return 'Please sign in again to change your picture.';
  if (error.status === 413) return 'That picture is too large. Choose one under 2 MB.';
  if (error.status === 400) return error.message;
  return 'We could not save your picture. Please try again.';
}

/** Mirrors the API's account rules so obvious mistakes are caught before a request is made. */
export function registrationProblem(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
}): string | null {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 100) return FIELD_HELP['name']!;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()) || input.email.trim().length > 254)
    return FIELD_HELP['email']!;
  if (!/^\+?[0-9 ]{9,16}$/.test(input.phone.trim())) return FIELD_HELP['phone']!;
  if (input.password.length < 12 || input.password.length > 128) return FIELD_HELP['password']!;
  return null;
}
