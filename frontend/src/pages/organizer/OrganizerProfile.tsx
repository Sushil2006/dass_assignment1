import { useEffect, useState } from "react";
import { Alert, Button, Card, Col, Form, Row, Spinner } from "react-bootstrap";
import { apiFetch } from "../../lib/api";

type OrganizerProfileData = {
  id: string;
  name: string;
  email: string;
  category: string;
  description: string;
  contactEmail: string;
  contactNumber: string;
  discordWebhookUrl: string;
  createdAt: string;
};

type OrganizerProfileResponse = {
  profile?: OrganizerProfileData;
};

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data?.error?.message || "Request failed";
  } catch {
    return "Request failed";
  }
}

export default function OrganizerProfile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState("");

  // load organizer's own profile once on mount
  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      setError(null);

      try {
        const res = await apiFetch("/api/organizers/me");
        if (!res.ok) throw new Error(await readErrorMessage(res));

        const data = (await res.json()) as OrganizerProfileResponse;
        const profile = data.profile;

        if (!profile) {
          throw new Error("Profile not found");
        }

        setName(profile.name ?? "");
        setEmail(profile.email ?? "");
        setCategory(profile.category ?? "");
        setDescription(profile.description ?? "");
        setContactEmail(profile.contactEmail ?? "");
        setContactNumber(profile.contactNumber ?? "");
        setDiscordWebhookUrl(profile.discordWebhookUrl ?? "");
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    }

    void loadProfile();
  }, []);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch("/api/organizers/me", {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          category: category.trim(),
          description: description.trim(),
          contactEmail: contactEmail.trim(),
          contactNumber: contactNumber.trim(),
          discordWebhookUrl: discordWebhookUrl.trim(),
        }),
      });

      if (!res.ok) throw new Error(await readErrorMessage(res));

      const data = (await res.json()) as OrganizerProfileResponse;
      const profile = data.profile;

      if (profile) {
        setName(profile.name ?? "");
        setEmail(profile.email ?? "");
        setCategory(profile.category ?? "");
        setDescription(profile.description ?? "");
        setContactEmail(profile.contactEmail ?? "");
        setContactNumber(profile.contactNumber ?? "");
        setDiscordWebhookUrl(profile.discordWebhookUrl ?? "");
      }

      setSuccess("Profile updated successfully.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border">
      <Card.Body>
        <Card.Title className="h5 mb-3">Organizer Profile</Card.Title>

        {error ? <Alert variant="danger">{error}</Alert> : null}
        {success ? <Alert variant="success">{success}</Alert> : null}

        {loading ? (
          <div className="d-flex align-items-center gap-2">
            <Spinner animation="border" size="sm" />
            <span>Loading profile...</span>
          </div>
        ) : (
          <Form onSubmit={saveProfile}>
            <Row className="g-3">
              <Col md={6}>
                <Form.Group controlId="org-name">
                  <Form.Label>Name</Form.Label>
                  <Form.Control
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                  />
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group controlId="org-login-email">
                  <Form.Label>Login Email (read-only)</Form.Label>
                  <Form.Control value={email} disabled readOnly />
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group controlId="org-category">
                  <Form.Label>Category</Form.Label>
                  <Form.Control
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    placeholder="club / department / community"
                  />
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group controlId="org-contact-email">
                  <Form.Label>Contact Email</Form.Label>
                  <Form.Control
                    type="email"
                    value={contactEmail}
                    onChange={(event) => setContactEmail(event.target.value)}
                    placeholder="public contact email"
                  />
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group controlId="org-contact-number">
                  <Form.Label>Contact Number</Form.Label>
                  <Form.Control
                    value={contactNumber}
                    onChange={(event) => setContactNumber(event.target.value)}
                    placeholder="public contact number"
                  />
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group controlId="org-discord-webhook">
                  <Form.Label>Discord Webhook URL</Form.Label>
                  <Form.Control
                    value={discordWebhookUrl}
                    onChange={(event) => setDiscordWebhookUrl(event.target.value)}
                    placeholder="https://discord.com/api/webhooks/..."
                  />
                  <Form.Text className="text-muted">
                    leave empty to disable discord posting
                  </Form.Text>
                </Form.Group>
              </Col>

              <Col xs={12}>
                <Form.Group controlId="org-description">
                  <Form.Label>Description</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={4}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="write a short organizer bio"
                  />
                </Form.Group>
              </Col>
            </Row>

            <div className="mt-3 d-flex justify-content-end">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save profile"}
              </Button>
            </div>
          </Form>
        )}
      </Card.Body>
    </Card>
  );
}
