import { useEffect, useState } from "react";
import { getMe, type AuthUser } from "./auth";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const me = await getMe();
      setUser(me);
    } finally {
      setLoading(false); // even if request fails, set loading to false
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return { user, loading, refresh, setUser };
}
