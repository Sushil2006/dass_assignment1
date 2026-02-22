import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Col, Container, Row, Spinner } from "react-bootstrap";
import { Link, useNavigate, useParams } from "react-router-dom";
import EventCard, { type EventCardData } from "../../components/EventCard";
import { apiFetch } from "../../lib/api";

type OrganizerSummary = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  contactEmail?: string | null;
  contactNumber?: string | null;
};

type OrganizerDetailResponse = {
  organizer?: OrganizerSummary;
  upcomingEvents?: EventCardData[];
  pastEvents?: EventCardData[];
};

type FollowedOrganizersResponse = {
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

export default function OrganizerDetail() {
  const navigate = useNavigate();
  const { organizerId = "" } = useParams<{ organizerId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [organizer, setOrganizer] = useState<OrganizerSummary | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<EventCardData[]>([]);
  const [pastEvents, setPastEvents] = useState<EventCardData[]>([]);
  const [followedIds, setFollowedIds] = useState<string[]>([]);

  const followedSet = useMemo(() => new Set(followedIds), [followedIds]);
  const isFollowed = organizer ? followedSet.has(organizer.id) : false;

  const loadDetail = useCallback(async () => {
    if (!organizerId) return;
    setLoading(true);
    setError(null);

    try {
      const [detailRes, followsRes] = await Promise.all([
        apiFetch(`/api/organizers/${organizerId}`),
        apiFetch("/api/participants/me/follows"),
      ]);
      if (!detailRes.ok) throw new Error(await readErrorMessage(detailRes));
      if (!followsRes.ok) throw new Error(await readErrorMessage(followsRes));

      const detailData = (await detailRes.json()) as OrganizerDetailResponse;
      const followsData = (await followsRes.json()) as FollowedOrganizersResponse;

      setOrganizer(detailData.organizer ?? null);
      setUpcomingEvents(detailData.upcomingEvents ?? []);
      setPastEvents(detailData.pastEvents ?? []);
      setFollowedIds((followsData.organizers ?? []).map((entry) => entry.id));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load organizer");
      setOrganizer(null);
    } finally {
      setLoading(false);
    }
  }, [organizerId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  async function followOrganizer() {
    if (!organizer) return;
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch(`/api/participants/me/follows/${organizer.id}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));

      setFollowedIds((prev) => (prev.includes(organizer.id) ? prev : [...prev, organizer.id]));
      setSuccess("Organizer followed.");
    } catch (followError) {
      setError(followError instanceof Error ? followError.message : "Failed to follow organizer");
    } finally {
      setBusy(false);
    }
  }

  async function unfollowOrganizer() {
    if (!organizer) return;
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch(`/api/participants/me/follows/${organizer.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));

      setFollowedIds((prev) => prev.filter((id) => id !== organizer.id));
      setSuccess("Organizer unfollowed.");
    } catch (unfollowError) {
      setError(
        unfollowError instanceof Error ? unfollowError.message : "Failed to unfollow organizer",
      );
    } finally {
      setBusy(false);
    }
  }

  function renderEvents(items: EventCardData[], emptyText: string) {
    if (items.length === 0) {
      return (
        <Card className="border">
          <Card.Body className="text-muted">{emptyText}</Card.Body>
        </Card>
      );
    }

    return (
      <Row className="g-3">
        {items.map((event) => (
          <Col key={event.id} md={6} lg={4}>
            <EventCard
              event={event}
              actions={
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={() => {
                    navigate(`/participant/events/${event.id}`);
                  }}
                >
                  Open Event
                </Button>
              }
            />
          </Col>
        ))}
      </Row>
    );
  }

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h1 className="h3 mb-1">Organizer Detail</h1>
          <p className="text-muted mb-0">View organizer profile and follow/unfollow.</p>
        </div>
        <Link to="/participant/organizers" className="btn btn-outline-secondary">
          Back to Organizers
        </Link>
      </div>

      {error ? <Alert variant="danger">{error}</Alert> : null}
      {success ? <Alert variant="success">{success}</Alert> : null}

      {loading ? (
        <div className="d-flex align-items-center gap-2">
          <Spinner animation="border" size="sm" />
          <span>Loading organizer detail...</span>
        </div>
      ) : !organizer ? (
        <Card className="border">
          <Card.Body className="text-muted">Organizer not found.</Card.Body>
        </Card>
      ) : (
        <>
          <Card className="border mb-3">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
                <div>
                  <h2 className="h4 mb-1">{organizer.name}</h2>
                  <div className="small text-muted mb-2">
                    Category: {organizer.category ?? "-"}
                  </div>
                  <div className="text-muted">{organizer.description ?? "No description available."}</div>
                  <div className="small mt-2">
                    <strong>Contact Email:</strong> {organizer.contactEmail ?? "-"}
                  </div>
                  <div className="small">
                    <strong>Contact Number:</strong> {organizer.contactNumber ?? "-"}
                  </div>
                </div>
                {isFollowed ? (
                  <Button
                    variant="outline-danger"
                    disabled={busy}
                    onClick={() => {
                      void unfollowOrganizer();
                    }}
                  >
                    Unfollow
                  </Button>
                ) : (
                  <Button
                    variant="outline-success"
                    disabled={busy}
                    onClick={() => {
                      void followOrganizer();
                    }}
                  >
                    Follow
                  </Button>
                )}
              </div>
            </Card.Body>
          </Card>

          <Card className="border mb-3">
            <Card.Body>
              <Card.Title className="h5 mb-3">Upcoming Events</Card.Title>
              {renderEvents(upcomingEvents, "No upcoming events for this organizer.")}
            </Card.Body>
          </Card>

          <Card className="border">
            <Card.Body>
              <Card.Title className="h5 mb-3">Past Events</Card.Title>
              {renderEvents(pastEvents, "No past events for this organizer.")}
            </Card.Body>
          </Card>
        </>
      )}
    </Container>
  );
}
