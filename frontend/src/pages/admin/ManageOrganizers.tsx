import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Container,
  Form,
  Row,
  Spinner,
  Table,
} from "react-bootstrap";
import { Link } from "react-router-dom";
import { apiFetch } from "../../lib/api";

type OrganizerRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  isDisabled: boolean;
  createdAt: string;
};

type OrganizerListResponse = {
  organizers?: OrganizerRow[];
};

type CreateOrganizerResponse = {
  organizer: OrganizerRow;
  credentials: {
    email: string;
    password: string;
  };
};

type CredentialsState = {
  email: string;
  password: string;
};

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data?.error?.message || "Request failed";
  } catch {
    return "Request failed";
  }
}

export default function ManageOrganizers() {
  const [organizers, setOrganizers] = useState<OrganizerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const [name, setName] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastCredentials, setLastCredentials] = useState<CredentialsState | null>(
    null,
  );

  const loadOrganizers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch("/api/admin/organizers");
      if (!res.ok) throw new Error(await readErrorMessage(res));

      const data = (await res.json()) as OrganizerListResponse;
      setOrganizers(data.organizers ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load organizers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrganizers();
  }, [loadOrganizers]);

  async function onCreateOrganizer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch("/api/admin/organizers", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!res.ok) throw new Error(await readErrorMessage(res));

      const data = (await res.json()) as CreateOrganizerResponse;

      setLastCredentials(data.credentials);
      setSuccess("Organizer created successfully");
      setName("");

      await loadOrganizers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create organizer");
    } finally {
      setSubmitting(false);
    }
  }

  async function runAction(path: string, organizerId: string, successMessage: string) {
    setActioningId(organizerId);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch(path, { method: "PATCH" });
      if (!res.ok) throw new Error(await readErrorMessage(res));

      setSuccess(successMessage);
      await loadOrganizers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActioningId(null);
    }
  }

  async function onDeleteOrganizer(organizerId: string) {
    setActioningId(organizerId);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch(`/api/admin/organizers/${organizerId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error(await readErrorMessage(res));

      setSuccess("Organizer deleted successfully");
      await loadOrganizers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setActioningId(null);
    }
  }

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 mb-1">Manage Organizers</h1>
          <p className="text-muted mb-0">
            Create organizers, share credentials, and control account lifecycle.
          </p>
        </div>
        <Link to="/admin" className="btn btn-outline-secondary">
          Back to admin home
        </Link>
      </div>

      {error ? <Alert variant="danger">{error}</Alert> : null}
      {success ? <Alert variant="success">{success}</Alert> : null}

      <Row className="g-3 mb-3">
        <Col lg={7}>
          <Card>
            <Card.Body>
              <Card.Title className="mb-3">Create Organizer</Card.Title>

              <Form onSubmit={onCreateOrganizer}>
                <Row className="g-3">
                  <Col md={6}>
                    <Form.Group controlId="organizer-name">
                      <Form.Label>Name</Form.Label>
                      <Form.Control
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Club/Organizer name"
                        required
                      />
                    </Form.Group>
                  </Col>

                  <Col md={6}>
                    <Form.Group controlId="organizer-email">
                      <Form.Label>Email</Form.Label>
                      <Form.Control
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="organizer@example.com"
                        required
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <div className="mt-3 d-flex justify-content-end">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Creating..." : "Create organizer"}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={5}>
          <Card className="h-100">
            <Card.Body>
              <Card.Title className="mb-3">Generated Credentials</Card.Title>

              {lastCredentials ? (
                <>
                  <Alert variant="warning" className="py-2">
                    Share once and store safely.
                  </Alert>
                  <div className="small">
                    <div>
                      <strong>Email:</strong> {lastCredentials.email}
                    </div>
                    <div>
                      <strong>Password:</strong> {lastCredentials.password}
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-muted mb-0">
                  Credentials appear here right after organizer creation.
                </p>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card>
        <Card.Body>
          <Card.Title className="mb-3">Organizer Accounts</Card.Title>

          {loading ? (
            <div className="d-flex align-items-center gap-2">
              <Spinner animation="border" size="sm" />
              <span>Loading organizers...</span>
            </div>
          ) : (
            <Table responsive hover className="align-middle mb-0">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {organizers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-muted py-4">
                      No organizers found.
                    </td>
                  </tr>
                ) : (
                  organizers.map((organizer) => {
                    const busy = actioningId === organizer.id;
                    return (
                      <tr key={organizer.id}>
                        <td>{organizer.name}</td>
                        <td>{organizer.email}</td>
                        <td>
                          {organizer.isDisabled ? (
                            <Badge bg="secondary">Disabled</Badge>
                          ) : (
                            <Badge bg="success">Active</Badge>
                          )}
                        </td>
                        <td>{new Date(organizer.createdAt).toLocaleString()}</td>
                        <td>
                          <div className="d-flex justify-content-end gap-2 flex-wrap">
                            <Button
                              size="sm"
                              variant="outline-warning"
                              disabled={busy || organizer.isDisabled}
                              onClick={() => {
                                void runAction(
                                  `/api/admin/organizers/${organizer.id}/disable`,
                                  organizer.id,
                                  "Organizer disabled successfully",
                                );
                              }}
                            >
                              Disable
                            </Button>

                            <Button
                              size="sm"
                              variant="outline-secondary"
                              disabled={busy || organizer.isDisabled}
                              onClick={() => {
                                void runAction(
                                  `/api/admin/organizers/${organizer.id}/archive`,
                                  organizer.id,
                                  "Organizer archived successfully",
                                );
                              }}
                            >
                              Archive
                            </Button>

                            <Button
                              size="sm"
                              variant="outline-danger"
                              disabled={busy}
                              onClick={() => {
                                void onDeleteOrganizer(organizer.id);
                              }}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
}
