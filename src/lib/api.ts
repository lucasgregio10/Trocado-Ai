import { supabase } from './supabase';

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export interface ApiFetchOptions extends RequestInit {
  skipAuth?: boolean;
}

async function handleForcedLogout(): Promise<never> {
  try {
    await supabase.auth.signOut();
  } catch {
    // Ignore local signOut errors when session is already invalid
  }

  if (unauthorizedHandler) {
    unauthorizedHandler();
  } else if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.assign('/login');
  }

  throw new ApiError('Sessão expirada. Entre novamente.', 401);
}

async function performRequest(
  path: string,
  options: ApiFetchOptions,
  accessToken?: string | null
): Promise<Response> {
  const { skipAuth: _skipAuth, headers: customHeaders, body, ...rest } = options;

  const headers = new Headers(customHeaders);
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const isBlob = typeof Blob !== 'undefined' && body instanceof Blob;
  if (!isFormData && !isBlob && body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  return fetch(path, {
    ...rest,
    headers,
    body,
  });
}

async function parseErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json().catch(() => null) : null;

  return (
    (payload &&
    typeof payload === 'object' &&
    'error' in payload &&
    typeof payload.error === 'string'
      ? payload.error
      : null) || `Erro na requisição (${response.status}).`
  );
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { skipAuth = false } = options;

  let token: string | null = null;
  if (!skipAuth) {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token ?? null;

    if (!token) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshed.session?.access_token) {
        return handleForcedLogout();
      }
      token = refreshed.session.access_token;
    }
  }

  let response = await performRequest(path, options, token);

  if (response.status === 401 && !skipAuth) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    const newToken = refreshed.session?.access_token ?? null;

    if (refreshError || !newToken) {
      return handleForcedLogout();
    }

    response = await performRequest(path, options, newToken);

    if (response.status === 401) {
      return handleForcedLogout();
    }
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new ApiError(message, response.status);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return null as T;
  }

  return (await response.json()) as T;
}

export async function apiFetchBlob(path: string): Promise<Blob> {
  const { data } = await supabase.auth.getSession();
  let token = data.session?.access_token ?? null;

  if (!token) {
    const { data: refreshed, error } = await supabase.auth.refreshSession();
    if (error || !refreshed.session?.access_token) {
      return handleForcedLogout();
    }
    token = refreshed.session.access_token;
  }

  let response = await performRequest(path, { method: 'GET' }, token);

  if (response.status === 401) {
    const { data: refreshed, error } = await supabase.auth.refreshSession();
    const newToken = refreshed.session?.access_token ?? null;
    if (error || !newToken) {
      return handleForcedLogout();
    }
    response = await performRequest(path, { method: 'GET' }, newToken);
    if (response.status === 401) {
      return handleForcedLogout();
    }
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new ApiError(message, response.status);
  }

  return response.blob();
}

export async function apiFetchStream(
  path: string,
  options: ApiFetchOptions = {}
): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  let token = data.session?.access_token ?? null;

  if (!token) {
    const { data: refreshed, error } = await supabase.auth.refreshSession();
    if (error || !refreshed.session?.access_token) {
      return handleForcedLogout();
    }
    token = refreshed.session.access_token;
  }

  let response = await performRequest(path, options, token);

  if (response.status === 401) {
    const { data: refreshed, error } = await supabase.auth.refreshSession();
    const newToken = refreshed.session?.access_token ?? null;
    if (error || !newToken) {
      return handleForcedLogout();
    }
    response = await performRequest(path, options, newToken);
    if (response.status === 401) {
      return handleForcedLogout();
    }
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new ApiError(message, response.status);
  }

  return response;
}

export async function downloadAuthenticatedCsv(from?: string, to?: string): Promise<void> {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const qs = params.toString();
  const path = qs ? `/api/export.csv?${qs}` : '/api/export.csv';

  const blob = await apiFetchBlob(path);
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `trocado-despesas-${today}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
