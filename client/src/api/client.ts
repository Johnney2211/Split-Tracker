import { API_V1_BASE } from './config';

export async function parseApiError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error ?? 'Something went wrong';
  } catch {
    return 'Something went wrong';
  }
}

export async function apiFetch(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<Response> {
  const { token, headers, ...rest } = options;
  const nextHeaders = new Headers(headers);

  if (token) {
    nextHeaders.set('Authorization', `Bearer ${token}`);
  }

  if (rest.body && !nextHeaders.has('Content-Type')) {
    nextHeaders.set('Content-Type', 'application/json');
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return fetch(`${API_V1_BASE}${normalizedPath}`, {
    ...rest,
    headers: nextHeaders,
  });
}
