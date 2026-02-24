import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner } from "react-bootstrap";
import { apiFetch } from "../../lib/api";
import { organizerCategoryOptions } from "../../lib/organizerCategories";

type OrganizerProfileData = {
  id: string;
  name: string;
  email: string;
  category: string;
  categoryLabel?: string;
  description: string;
  contactEmail: string;
  contactNumber: string;
  discordWebhookUrl: string;
  createdAt: string;
};

type OrganizerProfileResponse = {
  profile?: OrganizerProfileData;
};

type OrganizerPasswordResetRequest = {
  id: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  adminComment: string | null;
};

type OrganizerPasswordResetRequestListResponse = {
  requests?: OrganizerPasswordResetRequest[];
};

type OrganizerPasswordResetRequestCreateResponse = {
  request?: OrganizerPasswordResetRequest;
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
  const [loadingResetRequests, setLoadingResetRequests] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requestingReset, setRequestingReset] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState("");
  const [resetReason, setResetReason] = useState("");
  const [resetRequests, setResetRequests] = useState<OrganizerPasswordResetRequest[]>(
    [],
  );

  const loadResetRequests = useCallback(async () => {
    setLoadingResetRequests(true);
    setResetError(null);

    try {
      const res = await apiFetch("/api/organizers/me/password-reset-requests");
      if (!res.ok) throw new Error(await readErrorMessage(res));

      const data = (await res.json()) as OrganizerPasswordResetRequestListResponse;
      setResetRequests(data.requests ?? []);
    } catch (loadError) {
      setResetError(
        loadError instanceof Error ? loadError.message : "Failed to load password reset requests",
      );
    } finally {
      setLoadingResetRequests(false);
    }
  }, []);

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
    void loadResetRequests();
  }, [loadResetRequests]);

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

  async function submitPasswordResetRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResetError(null);
    setResetSuccess(null);

    const reason = resetReason.trim();
    if (!reason) {
      setResetError("Reason is required");
      return;
    }

    setRequestingReset(true);

    try {
      const res = await apiFetch("/api/organizers/me/password-reset-requests", {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));

      const data = (await res.json()) as OrganizerPasswordResetRequestCreateResponse;
      if (data.request) {
        setResetRequests((current) => [data.request!, ...current]);
      } else {
        await loadResetRequests();
      }
      setResetReason("");
      setResetSuccess("Password reset request submitted for admin review.");
    } catch (submitError) {
      setResetError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to submit password reset request",
      );
    } finally {
      setRequestingReset(false);
    }
  }

  function statusBadge(status: OrganizerPasswordResetRequest["status"]) {
    if (status === "approved") return <Badge bg="success">Approved</Badge>;
    if (status === "rejected") return <Badge bg="danger">Rejected</Badge>;
    return <Badge bg="warning" text="dark">Pending</Badge>;
  }

  return (
    <>
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
                    <Form.Select
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                    >
                      <option value="">Select category</option>
                      {organizerCategoryOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Form.Select>
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

      <Card className="border mt-3">
        <Card.Body>
          <Card.Title className="h5 mb-3">Password Reset Requests</Card.Title>
          <p className="text-muted">
            Submit a request when you need admin to generate a new organizer password.
          </p>

          {resetError ? <Alert variant="danger">{resetError}</Alert> : null}
          {resetSuccess ? <Alert variant="success">{resetSuccess}</Alert> : null}

          <Form onSubmit={submitPasswordResetRequest}>
            <Form.Group controlId="org-password-reset-reason">
              <Form.Label>Reason</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={resetReason}
                onChange={(event) => setResetReason(event.target.value)}
                placeholder="Briefly explain why password reset is needed"
              />
            </Form.Group>
            <div className="mt-3 d-flex justify-content-end">
              <Button type="submit" disabled={requestingReset}>
                {requestingReset ? "Submitting..." : "Submit password reset request"}
              </Button>
            </div>
          </Form>

          <hr />

          <h2 className="h6">Recent Requests</h2>
          {loadingResetRequests ? (
            <div className="d-flex align-items-center gap-2">
              <Spinner animation="border" size="sm" />
              <span>Loading requests...</span>
            </div>
          ) : resetRequests.length === 0 ? (
            <p className="text-muted mb-0">No password reset requests yet.</p>
          ) : (
            <div className="d-flex flex-column gap-2">
              {resetRequests.map((request) => (
                <Card key={request.id} className="border">
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-start gap-2">
                      <div>
                        <div className="small text-muted">
                          Requested on {new Date(request.createdAt).toLocaleString()}
                        </div>
                        <div>{request.reason}</div>
                        {request.adminComment ? (
                          <div className="small text-muted mt-1">
                            Admin comment: {request.adminComment}
                          </div>
                        ) : null}
                      </div>
                      {statusBadge(request.status)}
                    </div>
                  </Card.Body>
                </Card>
              ))}
            </div>
          )}
        </Card.Body>
      </Card>
    </>
  );
}
