import { useState } from "react";
import { Alert, Button, Card, Container, Form } from "react-bootstrap";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { login } from "../lib/auth";
import { useAuth } from "../lib/authState";

function pathForRole(role: string) {
  if (role === "participant") return "/participant";
  if (role === "organizer") return "/organizer";
  return "/admin";
}

export default function Login() {
  const navigate = useNavigate();
  const { user, loading, setUser } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && user) {
    return <Navigate to={pathForRole(user.role)} replace />;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const user = await login(email, password);
      setUser(user);
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
              <Link to="/signup" className="btn btn-outline-secondary">
                Create account
              </Link>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
}
