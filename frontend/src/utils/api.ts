const BASE_URL = 'http://localhost:5000';

export interface ApiError {
  code: string;
  message: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${path}`;
  
  // Set credentials for HTTP cookies (JWT)
  options.credentials = 'include';
  
  if (options.body && !(options.body instanceof FormData)) {
    options.headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
  }

  const response = await fetch(url, options);

  if (response.status === 204) {
    return {} as T;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error?.message || 'Something went wrong';
    const errorCode = data.error?.code || 'API_ERROR';
    const err: ApiError = { code: errorCode, message: errorMsg };
    throw err;
  }

  return data as T;
}

export const api = {
  get: <T>(path: string, options?: RequestInit) => request<T>(path, { method: 'GET', ...options }),
  post: <T>(path: string, body?: any, options?: RequestInit) =>
    request<T>(path, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
      ...options,
    }),
  patch: <T>(path: string, body?: any, options?: RequestInit) =>
    request<T>(path, {
      method: 'PATCH',
      body: body instanceof FormData ? body : JSON.stringify(body),
      ...options,
    }),
  delete: <T>(path: string, options?: RequestInit) => request<T>(path, { method: 'DELETE', ...options }),
};
