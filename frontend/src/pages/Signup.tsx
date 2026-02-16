import { useState } from "react";
import { Alert, Button, Card, Container, Form } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { signup, type AuthUser } from "../lib/auth";

export default function Signup() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AuthUser["role"]>("participant");

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const user = await signup(name, email, password, role);
      // backend sets auth cookie on signup, so you're "logged in" right away
      if (user.role === "participant")
        navigate("/participant", { replace: true });
      else if (user.role === "organizer")
        navigate("/organizer", { replace: true });
      else navigate("/admin", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Container className="py-5" style={{ maxWidth: 480 }}>
      <Card className="border">
        <Card.Body>
          <Card.Title className="mb-3">Create account</Card.Title>

          {error ? <Alert variant="danger">{error}</Alert> : null}

          <Form onSubmit={onSubmit}>
            <Form.Group className="mb-3" controlId="name">
              <Form.Label>Name</Form.Label>
              <Form.Control
                value={name}
                onChange={(e) => setName(e.target.value)}
                type="text"
                autoComplete="name"
                placeholder="Your name"
                required
              />
            </Form.Group>

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
                autoComplete="new-password"
                placeholder="At least 8 characters"
                minLength={8}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="role">
              <Form.Label>Role</Form.Label>
              <Form.Select
                value={role}
                onChange={(e) => setRole(e.target.value as AuthUser["role"])}
              >
                <option value="participant">participant</option>
                <option value="organizer">organizer</option>
                <option value="admin">admin</option>
              </Form.Select>
              <Form.Text className="text-muted">
                Note: Backend only allows participant signup; other roles will
                return an error.
              </Form.Text>
            </Form.Group>

            <div className="d-grid gap-2">
              <Button type="submit" disabled={busy}>
                {busy ? "Creating..." : "Create account"}
              </Button>
              <Button as={Link} to="/login" variant="outline-secondary">
                Back to login
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
}
