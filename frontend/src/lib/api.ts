const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").trim(); // vite exposes .env like this only

function getApiOrigin(): string | null {
  if (!API_BASE_URL) return null;
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return null;
  }
}

const API_ORIGIN = getApiOrigin();

function isUploadApiPath(pathname: string): boolean {
  return /^\/api\/uploads\/[^/?#]+$/i.test(pathname);
}

export function resolveApiUrl(pathOrUrl: string): string {
  const value = pathOrUrl.trim();
  if (!value) return value;

  if (/^https?:\/\//i.test(value)) {
    if (!API_ORIGIN) return value;

    try {
      const parsed = new URL(value);
      if (isUploadApiPath(parsed.pathname)) {
        return `${API_ORIGIN}${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
    } catch {
      return value;
    }

    return value;
  }

  try {
    return API_BASE_URL ? new URL(value, API_BASE_URL).toString() : value;
  } catch {
    return value;
  }
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
