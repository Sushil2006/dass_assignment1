const API_BASE_URL = import.meta.env.VITE_API_BASE_URL; // vite exposes .env like this only

export function resolveApiUrl(pathOrUrl: string): string {
  const value = pathOrUrl.trim();
  if (!value) return value;
  if (/^https?:\/\//i.test(value)) return value;
  return new URL(value, API_BASE_URL).toString();
}

// reusable function that handles API requests from the frontend to the backend
export async function apiFetch(path: string, options: RequestInit = {}) {
  const isFormDataBody =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  return fetch(`${API_BASE_URL}${path}`, {
    ...options, // spread operator (unpacks operators)
    credentials: "include",
    headers: {
      ...(isFormDataBody ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
  });
}
