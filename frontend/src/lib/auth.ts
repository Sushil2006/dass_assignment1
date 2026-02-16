import { apiFetch } from "./api";

export type AuthUser = {
  id: string;
  email: string;
  role: "participant" | "organizer" | "admin";
  name: string;
  createdAt: string;
};

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data?.error?.message || "Request failed";
  } catch {
    return "Request failed";
  }
}

export async function login(
  email: string,
  password: string,
): Promise<AuthUser> {
  const res = await apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) throw new Error(await readErrorMessage(res));

  const data = await res.json();
  return data.user as AuthUser;
}

export async function getMe(): Promise<AuthUser | null> {
  const res = await apiFetch("/api/auth/me");

  if (res.status === 401) return null;
  if (!res.ok) throw new Error(await readErrorMessage(res));

  const data = await res.json();
  return data.user as AuthUser;
}

export async function logout(): Promise<void> {
  const res = await apiFetch("/api/auth/logout", { method: "POST" });
  if (!res.ok) throw new Error(await readErrorMessage(res));
}

export async function signup(
  name: string,
  email: string,
  password: string,
): Promise<AuthUser> {
  const res = await apiFetch("/api/auth/signup", {
    method: "POST",
    // self-signup is only for participants.
    body: JSON.stringify({ name, email, password, role: "participant" }),
  });

  if (!res.ok) throw new Error(await readErrorMessage(res));

  const data = await res.json();
  return data.user as AuthUser;
}
