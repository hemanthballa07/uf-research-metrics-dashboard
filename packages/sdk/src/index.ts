/**
 * Typed SDK for the UF Research Metrics API.
 *
 * Types are generated from the OpenAPI spec (`pnpm --filter sdk generate`),
 * which is itself generated from the shared Zod schemas. This closes the loop:
 * one source of truth (Zod) → OpenAPI → TS types → frontend, so request/response
 * shapes cannot drift between client and server.
 */
import createOpenApiClient, { type Client } from 'openapi-fetch';
import type { paths, components, operations } from './schema.js';

export type { paths, components, operations };

// Convenience aliases for the documented entity schemas
export type Grant = components['schemas']['Grant'];
export type Faculty = components['schemas']['Faculty'];
export type Department = components['schemas']['Department'];
export type Sponsor = components['schemas']['Sponsor'];
export type GrantStatus = components['schemas']['GrantStatus'];
export type SponsorType = components['schemas']['SponsorType'];

export interface SdkOptions {
  baseUrl: string;
  /** Returns the current bearer token, or null when unauthenticated. */
  getToken?: () => string | null;
}

/**
 * Creates a fully typed API client. Every path, query param, and response body
 * is checked against the generated `paths` type at compile time.
 */
export function createApiClient(options: SdkOptions): Client<paths> {
  const client = createOpenApiClient<paths>({ baseUrl: options.baseUrl });

  if (options.getToken) {
    client.use({
      onRequest({ request }) {
        const token = options.getToken?.();
        if (token) request.headers.set('Authorization', `Bearer ${token}`);
        return request;
      },
    });
  }

  return client;
}
