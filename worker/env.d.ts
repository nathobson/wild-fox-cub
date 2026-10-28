// Optional secret. Set with `wrangler secret put BETTER_AUTH_SECRET`;
// without it a secret is generated on first run and stored in D1.
interface Env {
  BETTER_AUTH_SECRET?: string;
  /** Rate limit for the public contact form (wrangler.jsonc "ratelimits"). */
  CONTACT_LIMITER?: RateLimit;
}
