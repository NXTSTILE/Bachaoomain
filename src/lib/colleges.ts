import { ApiError } from './errors';

// A registry, not a generic .edu allowlist: adding a college requires an explicit review.
export const COLLEGES = [
  {
    id: 'centurion',
    name: 'Centurion University',
    domains: ['centurionuniv.edu.in', 'cutm.ac.in'],
    studentId: /^\d{12}$/,
  },
] as const;

export function collegeEmail(value: unknown): { email: string; collegeId: string } {
  if (typeof value !== 'string' || value.length > 254) {
    throw new ApiError(400, 'Enter a valid college student email.');
  }
  const email = value.trim().toLowerCase();
  const parts = email.split('@');
  const college = COLLEGES.find(
    (entry) => parts.length === 2 && entry.domains.some((domain) => domain === parts[1]) && entry.studentId.test(parts[0]),
  );
  if (!college) {
    throw new ApiError(400, 'Use your 12-digit Centurion student email at centurionuniv.edu.in or cutm.ac.in.');
  }
  return { email, collegeId: college.id };
}

export function loginEmail(value: unknown): string {
  if (typeof value !== 'string' || value.length > 254) throw new ApiError(400, 'Enter a valid email address.');
  const email = value.trim().toLowerCase();
  if (!/^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) throw new ApiError(400, 'Enter a valid email address.');
  return email;
}

export const POST_CATEGORIES = ['Academics', 'Placements', 'Campus life', 'Projects'] as const;
export type PostCategory = (typeof POST_CATEGORIES)[number];
export type Role = 'POSTER' | 'HELPER' | 'ADMIN';

export function isRole(value: unknown): value is Role {
  return value === 'POSTER' || value === 'HELPER' || value === 'ADMIN';
}
