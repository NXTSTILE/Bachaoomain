import { ApiError } from './errors';

export const MIN_SIGNUP_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_BYTES = 72;

// Browser-safe counterpart of the verification API's password contract.
// Never trim passwords, and reject bcrypt's silent UTF-8 byte truncation.
export function passwordInput(value: unknown, registering = false): string {
  if (
    typeof value !== 'string' ||
    value.length < (registering ? MIN_SIGNUP_PASSWORD_LENGTH : 1) ||
    new TextEncoder().encode(value).byteLength > MAX_PASSWORD_BYTES ||
    value.includes('\0')
  ) {
    throw new ApiError(400, registering ? 'Password must be at least 8 characters and at most 72 UTF-8 bytes.' : 'Enter a valid password.');
  }
  return value;
}
