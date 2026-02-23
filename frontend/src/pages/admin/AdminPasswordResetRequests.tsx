import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Container, Form, Spinner, Table } from "react-bootstrap";
import { Link } from "react-router-dom";
import { apiFetch } from "../../lib/api";
import { readApiErrorMessage } from "../../lib/errors";

type PasswordResetRequestStatus = "pending" | "approved" | "rejected";

type PasswordResetRequestRow = {
  id: string;
  organizerId: string;
  organizerName: string;
  organizerEmail: string;
  reason: string;
  status: PasswordResetRequestStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  adminComment: string | null;
};

type PasswordResetRequestListResponse = {
  requests?: PasswordResetRequestRow[];
};

type ResolvePasswordResetResponse = {
  request?: PasswordResetRequestRow;
  credentials?: {
    email: string;
    password: string;
  };
};

type GeneratedCredentialState = {
  email: string;
  password: string;
  requestId: string;
};

async function readErrorMessage(res: Response): Promise<string> {
  return readApiErrorMessage(res);
}

export default function AdminPasswordResetRequests() {
  const [requests, setRequests] = useState<PasswordResetRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [commentsById, setCommentsById] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastCredentials, setLastCredentials] =
    useState<GeneratedCredentialState | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch("/api/admin/password-reset-requests");
      if (!res.ok) throw new Error(await readErrorMessage(res));

      const data = (await res.json()) as PasswordResetRequestListResponse;
      setRequests(data.requests ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load password reset requests",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  async function resolveRequest(
    requestId: string,
    decision: "approve" | "reject",
  ) {
    setActioningId(requestId);
    setError(null);
    setSuccess(null);
    setLastCredentials(null);

    try {
      const res = await apiFetch(`/api/admin/password-reset-requests/${requestId}`, {
        method: "PATCH",
        body: JSON.stringify({
          decision,
          comment: commentsById[requestId]?.trim() ?? "",
        }),
      });

      if (!res.ok) throw new Error(await readErrorMessage(res));

      const data = (await res.json()) as ResolvePasswordResetResponse;
      if (data.credentials) {
        setLastCredentials({
          email: data.credentials.email,
          password: data.credentials.password,
          requestId,
        });
      }

      setSuccess(
        decision === "approve"
          ? "Password reset request approved."
          : "Password reset request rejected.",
      );

      await loadRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update request");
    } finally {
      setActioningId(null);
    }
  }

  function statusBadge(status: PasswordResetRequestStatus) {
    if (status === "approved") return <Badge bg="success">Approved</Badge>;
    if (status === "rejected") return <Badge bg="danger">Rejected</Badge>;
    return (
      <Badge bg="warning" text="dark">
        Pending
      </Badge>
    );
  }

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 mb-1">Password Reset Requests</h1>
          <p className="text-muted mb-0">
            Review organizer password reset requests and their statuses.
          </p>
        </div>
        <Link to="/admin" className="btn btn-outline-secondary">
          Back to admin home
        </Link>
      </div>

      {error ? <Alert variant="danger">{error}</Alert> : null}
      {success ? <Alert variant="success">{success}</Alert> : null}

      {lastCredentials ? (
        <Alert variant="warning">
          <div className="fw-semibold">Share regenerated credentials securely.</div>
          <div className="small">
            <div>
              <strong>Email:</strong> {lastCredentials.email}
            </div>
            <div>
              <strong>Password:</strong> {lastCredentials.password}
            </div>
          </div>
        </Alert>
      ) : null}

      <Card className="border">
        <Card.Body>
          {loading ? (
            <div className="d-flex align-items-center gap-2">
              <Spinner animation="border" size="sm" />
              <span>Loading requests...</span>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-muted mb-0">
              No password reset requests available right now.
            </div>
          ) : (
            <Table responsive hover className="align-middle mb-0">
              <thead>
                <tr>
                  <th>Organizer</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Requested</th>
                  <th>Admin Comment</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => {
                  const busy = actioningId === request.id;
                  const isPending = request.status === "pending";

                  return (
                    <tr key={request.id}>
                      <td>
                        <div className="fw-semibold">{request.organizerName}</div>
                        <div className="small text-muted">{request.organizerEmail}</div>
                      </td>
                      <td>{request.reason}</td>
                      <td>{statusBadge(request.status)}</td>
                      <td>{new Date(request.createdAt).toLocaleString()}</td>
                      <td>
                        {isPending ? (
                          <Form.Control
                            size="sm"
                            value={commentsById[request.id] ?? ""}
                            onChange={(event) =>
                              setCommentsById((current) => ({
                                ...current,
                                [request.id]: event.target.value,
                              }))
                            }
                            placeholder="Optional comment"
                          />
                        ) : (
                          <span className="small text-muted">
                            {request.adminComment ?? "—"}
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="d-flex justify-content-end gap-2">
                          <Button
                            size="sm"
                            variant="outline-success"
                            disabled={!isPending || busy}
                            onClick={() => {
                              void resolveRequest(request.id, "approve");
                            }}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline-danger"
                            disabled={!isPending || busy}
                            onClick={() => {
                              void resolveRequest(request.id, "reject");
                            }}
                          >
                            Reject
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
}
