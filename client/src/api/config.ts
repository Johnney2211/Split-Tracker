/**
 * Backend origin for all API requests.
 * Set VITE_API_URL in .env (local) or Vercel env (production).
 * Example production: https://split-tracker-0uxz.onrender.com
 */
const rawBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export const API_BASE_URL = String(rawBase).replace(/\/$/, '');

/** Prefixed API root, e.g. https://host/api/v1 */
export const API_V1_BASE = `${API_BASE_URL}/api/v1`;
