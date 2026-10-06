import { NextResponse } from 'next/server';
import { Prisma } from '../generated/prisma/client';
import { ApiError } from './errors';

export async function api(action: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    const response = await action();
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    let status = 500;
    let message = 'Something went wrong. Please try again.';
    const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
    if (error instanceof ApiError) {
      status = error.status;
      message = error.message;
      if (error.retryAfter) headers['Retry-After'] = String(error.retryAfter);
    } else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      status = 409;
      message = 'This record already exists.';
    } else if (
      error instanceof Prisma.PrismaClientKnownRequestError ||
      error instanceof Prisma.PrismaClientInitializationError ||
      error instanceof Prisma.PrismaClientUnknownRequestError
    ) {
      status = 503;
      message = 'Database is temporarily unavailable. Please try again later.';
    }
    // Never log raw exceptions: database/mail errors can include secrets or private payloads.
    return NextResponse.json({ error: message }, { status, headers });
  }
}

export function sameOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  const site = request.headers.get('sec-fetch-site');
  if (!origin || origin !== new URL(request.url).origin || (site && site !== 'same-origin' && site !== 'none')) {
    throw new ApiError(403, 'This action must be made from this site.');
  }
}

export async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  sameOrigin(request);
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new ApiError(415, 'Send a JSON request.');
  }
  const maxBytes = 16_384;
  if (Number(request.headers.get('content-length')) > maxBytes) throw new ApiError(413, 'Request is too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'A JSON object is required.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new ApiError(413, 'Request is too large.');
      }
      chunks.push(value);
    }
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Not an object');
    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'A valid JSON object is required.');
  } finally {
    reader.releaseLock();
  }
}

export function text(value: unknown, label: string, min: number, max: number): string {
  if (typeof value !== 'string') throw new ApiError(400, `${label} is required.`);
  const result = value.trim();
  if (result.length < min || result.length > max || /\u0000/.test(result)) {
    throw new ApiError(400, `${label} must be ${min}–${max} characters.`);
  }
  return result;
}

export { passwordInput } from './password-validation';
