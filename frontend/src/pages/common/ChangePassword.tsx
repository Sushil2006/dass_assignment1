import { useState } from "react";
import { Alert, Button, Card, Form } from "react-bootstrap";
import { apiFetch } from "../../lib/api";

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data?.error?.message || "Request failed";
  } catch {
    return "Request failed";
  }
}

type ChangePasswordProps = {
  username?: string;
};

export default function ChangePassword({ username = "" }: ChangePasswordProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError("New password and confirm password must match.");
      return;
    }

    setSaving(true);
    try {
      const res = await apiFetch("/api/security/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (!res.ok) throw new Error(await readErrorMessage(res));

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Password updated successfully.");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to change password",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border">
      <Card.Body>
        <Card.Title className="h5 mb-3">Change Password</Card.Title>

        {error ? <Alert variant="danger">{error}</Alert> : null}
        {success ? <Alert variant="success">{success}</Alert> : null}

        <Form onSubmit={onSubmit}>
          {/* Keep username context for password-manager/autocomplete heuristics. */}
          <Form.Control
            type="email"
            name="username"
            autoComplete="username"
            value={username}
            readOnly
            className="d-none"
            tabIndex={-1}
            aria-hidden
          />

          <Form.Group className="mb-3" controlId="change-current-password">
            <Form.Label>Current Password</Form.Label>
            <Form.Control
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(currentEvent) => setCurrentPassword(currentEvent.target.value)}
              required
            />
          </Form.Group>

          <Form.Group className="mb-3" controlId="change-new-password">
            <Form.Label>New Password</Form.Label>
            <Form.Control
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(currentEvent) => setNewPassword(currentEvent.target.value)}
              minLength={8}
              required
            />
          </Form.Group>

          <Form.Group className="mb-3" controlId="change-confirm-password">
            <Form.Label>Confirm New Password</Form.Label>
            <Form.Control
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(currentEvent) => setConfirmPassword(currentEvent.target.value)}
              minLength={8}
              required
            />
          </Form.Group>

          <div className="d-flex justify-content-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Change Password"}
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
}
