import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({ basePath: '/api/auth' });

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** JSON fetch against the Worker API. Throws ApiError with the server's message. */
export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
    headers: options.body === undefined ? undefined : { 'content-type': 'application/json' },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: 'same-origin',
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status);
  return data;
}

export interface SiteState {
  site: import('../types').Site;
  revision: number;
  publishedAt: string | null;
  hasChanges: boolean;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface Submission {
  id: string;
  page: string;
  name: string;
  email: string;
  message: string;
  createdAt: string;
}

export const formatDate = (value: string) =>
  new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
