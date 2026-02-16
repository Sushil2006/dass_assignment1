import { useEffect, useState } from "react";
import { Alert, Button, Card, Container, Form } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { getMe, login } from "../lib/auth";

function pathForRole(role: string) {
  if (role === "participant") return "/participant";
  if (role === "organizer") return "/organizer";
  return "/admin";
}

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const me = await getMe();
      if (cancelled) return;
      if (me) navigate(pathForRole(me.role), { replace: true });
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const user = await login(email, password);
      navigate(pathForRole(user.role), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Container className="py-5" style={{ maxWidth: 420 }}>
      <Card className="border">
        <Card.Body>
          <Card.Title className="mb-3">Login</Card.Title>

          {error ? <Alert variant="danger">{error}</Alert> : null}

          <Form onSubmit={onSubmit}>
            <Form.Group className="mb-3" controlId="email">
              <Form.Label>Email</Form.Label>
              <Form.Control
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="password">
              <Form.Label>Password</Form.Label>
              <Form.Control
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
                placeholder="********"
                required
              />
            </Form.Group>

            <div className="d-grid gap-2">
              <Button type="submit" disabled={busy}>
                {busy ? "Signing in..." : "Sign in"}
              </Button>
              <Button as={Link} to="/signup" variant="outline-secondary">
                Create account
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
}
