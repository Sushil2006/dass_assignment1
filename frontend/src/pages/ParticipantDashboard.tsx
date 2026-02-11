import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

export default function ParticipantDashboard() {
  const [status, setStatus] = useState("loading...");

  // function entered on first render
  useEffect(() => {
    async function loadHealth() {
      const res = await apiFetch("/api/health");
      const data = await res.json();
      setStatus(data.status ?? "ok"); // if status is null or undefined, set status to "ok"; otherwise, set status to data.status
    }
    loadHealth();
  }, []);

  return <div>API health: {status}</div>;
}
