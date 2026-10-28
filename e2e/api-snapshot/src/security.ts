import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from 'node:crypto';
import { promisify } from 'node:util';
import type { RequestHandler } from 'express';
import { Session, User } from './models.js';
const scrypt = promisify(scryptCallback);
export const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password: string, hash: string) {
  const [salt, key] = hash.split(':');
  if (!salt || !key) return false;
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(key, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const authenticate: RequestHandler = async (req, res, next) => {
  const token = req.headers.authorization?.match(
    /^Bearer ([A-Za-z0-9_-]{43})$/,
  )?.[1];
  if (!token) throw new ApiError(401, 'Sign in required');
  const session = await Session.findOne({
    tokenHash: digest(token),
    expiresAt: { $gt: new Date() },
  });
  const user =
    session && (await User.findOne({ _id: session.userId, active: true }));
  if (!user) throw new ApiError(401, 'Session expired or account inactive');
  res.locals.user = user;
  res.locals.tokenHash = digest(token);
  next();
};
export const permit =
  (...roles: string[]): RequestHandler =>
  (_req, res, next) => {
    if (!roles.includes(res.locals.user.role))
      throw new ApiError(403, 'Access denied');
    next();
  };
/** Sign-in lifetimes: a normal session, and one the user asked to keep on their device. */
export const SESSION_HOURS = 8;
export const REMEMBERED_SESSION_DAYS = 30;
export async function issueSession(userId: unknown, remember = false) {
  const token = randomBytes(32).toString('base64url');
  const lifetimeMs = remember
    ? REMEMBERED_SESSION_DAYS * 24 * 60 * 60 * 1000
    : SESSION_HOURS * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + lifetimeMs);
  await Session.create({ tokenHash: digest(token), userId, expiresAt });
  return { token, expiresAt };
}
export function userView(user: any) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    active: user.active,
  };
}
