import { betterAuth } from 'better-auth';
import { getOrCreateSetting } from './db';

/* ------------------------------------------------------------------ */
/* Password hashing                                                    */
/* ------------------------------------------------------------------ */

// Better Auth's default scrypt is pure JS and can exceed the Workers CPU limit.
// PBKDF2 runs natively through Web Crypto. 100k is the Workers iteration cap.
const ITERATIONS = 100_000;

const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromB64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2-sha256$${ITERATIONS}$${toB64(salt)}$${toB64(hash)}`;
}

export async function verifyPassword({ hash, password }: { hash: string; password: string }) {
  const [scheme, iterations, salt, expected] = hash.split('$');
  if (scheme !== 'pbkdf2-sha256' || !iterations || !salt || !expected) return false;
  const actual = await derive(password, fromB64(salt), Number(iterations));
  const wanted = fromB64(expected);
  if (actual.length !== wanted.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ wanted[i];
  return diff === 0;
}

/* ------------------------------------------------------------------ */
/* Better Auth                                                         */
/* ------------------------------------------------------------------ */

export const MIN_PASSWORD_LENGTH = 8;

function build(env: Env, baseURL: string, secret: string) {
  return betterAuth({
    appName: 'Fox Cub CMS',
    baseURL,
    basePath: '/api/auth',
    secret,
    database: env.DB,
    emailAndPassword: {
      enabled: true,
      // Accounts are only created by signed-in admins (or first-run setup).
      disableSignUp: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      password: { hash: hashPassword, verify: verifyPassword },
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
    },
    advanced: {
      // Cloudflare sets the real client IP here; rate limiting is per IP.
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
    },
    telemetry: { enabled: false },
  });
}

export type Auth = ReturnType<typeof build>;

let storedSecret: string | undefined;

/**
 * A fresh Better Auth instance per request. Instances hold pending promises, and
 * Workers can't share those between requests, so only the secret string is cached.
 */
export async function getAuth(env: Env, request: Request): Promise<Auth> {
  // Prefer a configured secret; otherwise generate one once and keep it in D1.
  const secret =
    env.BETTER_AUTH_SECRET ||
    (storedSecret ??= await getOrCreateSetting(env.DB, 'auth_secret', () =>
      toB64(crypto.getRandomValues(new Uint8Array(32))),
    ));
  return build(env, new URL(request.url).origin, secret);
}

/** Creates an email + password user directly (bypasses the disabled sign-up endpoint). */
export async function createUser(auth: Auth, input: { name: string; email: string; password: string }) {
  const ctx = await auth.$context;
  const email = input.email.trim().toLowerCase();
  if (await ctx.internalAdapter.findUserByEmail(email)) {
    throw new Error('A user with that email already exists.');
  }
  const user = await ctx.internalAdapter.createUser({
    name: input.name.trim() || email,
    email,
    emailVerified: true,
  }, { method: 'admin' });
  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: 'credential',
    accountId: user.id,
    password: await hashPassword(input.password),
  });
  return user;
}
