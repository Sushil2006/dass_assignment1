import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Col, Container, Form, Row, Spinner } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../../lib/api";

type OrganizerSummary = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  contactEmail?: string | null;
  contactNumber?: string | null;
};

type OrganizersResponse = {
  organizers?: OrganizerSummary[];
};

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data?.error?.message || "Request failed";
  } catch {
    return "Request failed";
  }
}

export default function Organizers() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const [searchText, setSearchText] = useState("");
  const [organizers, setOrganizers] = useState<OrganizerSummary[]>([]);
  const [followedIds, setFollowedIds] = useState<string[]>([]);

  const followedSet = useMemo(() => new Set(followedIds), [followedIds]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [organizersRes, followsRes] = await Promise.all([
        apiFetch("/api/organizers"),
        apiFetch("/api/participants/me/follows"),
      ]);

      if (!organizersRes.ok) throw new Error(await readErrorMessage(organizersRes));
      if (!followsRes.ok) throw new Error(await readErrorMessage(followsRes));

      const organizersData = (await organizersRes.json()) as OrganizersResponse;
      const followsData = (await followsRes.json()) as OrganizersResponse;

      setOrganizers(organizersData.organizers ?? []);
      setFollowedIds((followsData.organizers ?? []).map((entry) => entry.id));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load organizers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function followOrganizer(organizerId: string) {
    setActioningId(organizerId);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch(`/api/participants/me/follows/${organizerId}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));

      setFollowedIds((prev) => (prev.includes(organizerId) ? prev : [...prev, organizerId]));
      setSuccess("Organizer followed.");
    } catch (followError) {
      setError(followError instanceof Error ? followError.message : "Failed to follow organizer");
    } finally {
      setActioningId(null);
    }
  }

  async function unfollowOrganizer(organizerId: string) {
    setActioningId(organizerId);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch(`/api/participants/me/follows/${organizerId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));

      setFollowedIds((prev) => prev.filter((id) => id !== organizerId));
      setSuccess("Organizer unfollowed.");
    } catch (unfollowError) {
      setError(
        unfollowError instanceof Error ? unfollowError.message : "Failed to unfollow organizer",
      );
    } finally {
      setActioningId(null);
    }
  }

  const filtered = organizers.filter((organizer) => {
    if (!searchText.trim()) return true;
    const q = searchText.trim().toLowerCase();
    return (
      organizer.name.toLowerCase().includes(q) ||
      (organizer.category ?? "").toLowerCase().includes(q) ||
      (organizer.description ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h1 className="h3 mb-1">Clubs / Organizers</h1>
          <p className="text-muted mb-0">Discover organizers and follow/unfollow them.</p>
        </div>
        <Link to="/participant/profile" className="btn btn-outline-secondary">
          Back to Profile
        </Link>
      </div>

      {error ? <Alert variant="danger">{error}</Alert> : null}
      {success ? <Alert variant="success">{success}</Alert> : null}

      <Card className="border mb-3">
        <Card.Body>
          <Form.Group controlId="organizers-search">
            <Form.Label>Search organizers</Form.Label>
            <Form.Control
              value={searchText}
              onChange={(currentEvent) => setSearchText(currentEvent.target.value)}
              placeholder="name, category, description"
            />
          </Form.Group>
        </Card.Body>
      </Card>

      {loading ? (
        <div className="d-flex align-items-center gap-2">
          <Spinner animation="border" size="sm" />
          <span>Loading organizers...</span>
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border">
          <Card.Body className="text-muted">No organizers found.</Card.Body>
        </Card>
      ) : (
        <Row className="g-3">
          {filtered.map((organizer) => {
            const followed = followedSet.has(organizer.id);
            const busy = actioningId === organizer.id;

            return (
              <Col key={organizer.id} md={6} lg={4}>
                <Card className="h-100 border">
                  <Card.Body>
                    <Card.Title className="h5 mb-1">{organizer.name}</Card.Title>
                    <div className="small text-muted mb-2">
                      Category: {organizer.category ?? "-"}
                    </div>
                    <Card.Text className="text-muted small mb-3">
                      {organizer.description ?? "No description available."}
                    </Card.Text>
                    <div className="d-flex gap-2 flex-wrap">
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => {
                          navigate(`/participant/organizers/${organizer.id}`);
                        }}
                      >
                        Open
                      </Button>
                      {followed ? (
                        <Button
                          variant="outline-danger"
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            void unfollowOrganizer(organizer.id);
                          }}
                        >
                          Unfollow
                        </Button>
                      ) : (
                        <Button
                          variant="outline-success"
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            void followOrganizer(organizer.id);
                          }}
                        >
                          Follow
                        </Button>
                      )}
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </Container>
  );
}
