const API_BASE_URL = import.meta.env.VITE_API_BASE_URL; // vite exposes .env like this only

// reusable function that handles API requests from the frontend to the backend
export async function apiFetch(path: string, options: RequestInit = {}) {
  return fetch(`${API_BASE_URL}${path}`, {
    ...options, // spread operator (unpacks operators)
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
}
