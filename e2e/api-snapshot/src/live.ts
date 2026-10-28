import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { Order, Session, User } from './models.js';
import { digest } from './security.js';

/** What an admin is told about a new order. No address or phone: those stay behind GET /orders. */
export type LiveOrder = {
  id: string;
  customer: string;
  fulfillment: string;
  totalCents: number;
  itemCount: number;
  date: string;
  time: string;
  createdAt: string;
};

export type LiveDeps = {
  /** The live session behind a bearer token if it belongs to an active admin, else null. */
  authorizeAdmin(
    token: string,
  ): Promise<{ tokenHash: string; expiresAt: Date } | null>;
  countPending(): Promise<number>;
};

export const databaseDeps: LiveDeps = {
  async authorizeAdmin(token) {
    const session = await Session.findOne({
      tokenHash: digest(token),
      expiresAt: { $gt: new Date() },
    });
    if (!session) return null;
    const admin = await User.exists({
      _id: session.userId,
      role: 'admin',
      active: true,
    });
    return admin
      ? { tokenHash: session.tokenHash, expiresAt: session.expiresAt }
      : null;
  },
  countPending: () => Order.countDocuments({ status: 'Pending' }),
};

const ADMINS = 'admins';
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
/** setTimeout cannot wait longer than this (about 24.8 days). */
const MAX_TIMER_MS = 2 ** 31 - 1;

/**
 * Live updates for admins over Socket.IO. Only a signed-in admin can connect: the bearer token goes
 * in the handshake (`auth: { token }`), is checked against the same sessions as the REST API, and the
 * connection ends when that session does (sign-out or expiry). Events:
 *  - `order:new`      a customer placed an order (see LiveOrder)
 *  - `orders:pending` { count } of Pending orders; sent on connect and whenever it may have changed
 * Until attach() is called every method does nothing, so tests and scripts need no socket server.
 */
export function createLiveHub(deps: LiveDeps = databaseDeps) {
  let io: Server | undefined;

  async function pendingChanged() {
    if (!io) return;
    try {
      io.to(ADMINS).emit('orders:pending', {
        count: await deps.countPending(),
      });
    } catch (error) {
      console.error('Could not send the pending count', error);
    }
  }

  return {
    attach(httpServer: HttpServer, origins: string[]) {
      io = new Server(httpServer, {
        cors: { origin: origins },
        serveClient: false,
      });
      io.use(async (socket, next) => {
        const token: unknown = socket.handshake.auth?.token;
        try {
          const session =
            typeof token === 'string' && TOKEN.test(token)
              ? await deps.authorizeAdmin(token)
              : null;
          if (!session) return next(new Error('Not allowed'));
          socket.data.tokenHash = session.tokenHash;
          socket.data.expiresAt = session.expiresAt;
          next();
        } catch {
          next(new Error('Not allowed'));
        }
      });
      io.on('connection', (socket) => {
        void socket.join(ADMINS);
        deps
          .countPending()
          .then((count) => socket.emit('orders:pending', { count }))
          .catch(() => undefined);
        // The connection must not outlive the session it was opened with.
        const timer = setTimeout(
          () => socket.disconnect(true),
          Math.min(
            Math.max((socket.data.expiresAt as Date).getTime() - Date.now(), 0),
            MAX_TIMER_MS,
          ),
        );
        timer.unref();
        socket.on('disconnect', () => clearTimeout(timer));
      });
    },
    orderCreated(order: LiveOrder) {
      if (!io) return;
      io.to(ADMINS).emit('order:new', order);
      void pendingChanged();
    },
    pendingChanged,
    /** Ends the live connections opened with this token (called on sign-out). */
    signedOut(tokenHash: string) {
      if (!io) return;
      for (const socket of io.sockets.sockets.values())
        if (socket.data.tokenHash === tokenHash) socket.disconnect(true);
    },
    /** Closes every connection so the HTTP server can shut down. */
    disconnectAll() {
      io?.disconnectSockets(true);
    },
  };
}
export type LiveHub = ReturnType<typeof createLiveHub>;
