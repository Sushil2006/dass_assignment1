import { useState } from "react";
import { Alert, Button, Card, Container, Form } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { signup } from "../lib/auth";

export default function Signup() {
  const navigate = useNavigate();

  // Participant signup form state.
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // UI state for request lifecycle.
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      await signup(firstName, lastName, email, password);
      // Signup is participant-only in this milestone.
      navigate("/participant", { replace: true });
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
          <Card.Title className="mb-3">Create participant account</Card.Title>

          {error ? <Alert variant="danger">{error}</Alert> : null}

          <Form onSubmit={onSubmit}>
            <Form.Group className="mb-3" controlId="firstName">
              <Form.Label>First Name</Form.Label>
              <Form.Control
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                type="text"
                autoComplete="name"
                placeholder="Your first name"
                required
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="lastName">
              <Form.Label>Last Name</Form.Label>
              <Form.Control
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                type="text"
                autoComplete="family-name"
                placeholder="Your last name"
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

            <div className="d-grid gap-2">
              <Button type="submit" disabled={busy}>
                {busy ? "Creating..." : "Create account"}
              </Button>

              {/* Keep login navigation simple and type-safe. */}
              <Link to="/login" className="btn btn-outline-secondary">
                Back to login
              </Link>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
}
