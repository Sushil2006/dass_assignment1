import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Container,
  Form,
  Row,
  Spinner,
} from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import EventCard, { type EventCardData } from "../../components/EventCard";
import { apiFetch } from "../../lib/api";

type EventsResponse = {
  events?: EventCardData[];
};

type BrowseFilters = {
  q: string;
  type: "" | "NORMAL" | "MERCH";
  status: "" | "PUBLISHED" | "ONGOING" | "CLOSED" | "COMPLETED";
  from: string;
  to: string;
};

const defaultFilters: BrowseFilters = {
  q: "",
  type: "",
  status: "",
  from: "",
  to: "",
};

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data?.error?.message || "Request failed";
  } catch {
    return "Request failed";
  }
}

function buildSearchParams(filters: BrowseFilters): string {
  const params = new URLSearchParams();

  if (filters.q) params.set("q", filters.q);
  if (filters.type) params.set("type", filters.type);
  if (filters.status) params.set("status", filters.status);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);

  return params.toString();
}

export default function BrowseEvents() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<BrowseFilters>(defaultFilters);
  const [events, setEvents] = useState<EventCardData[]>([]);
  const [trending, setTrending] = useState<EventCardData[]>([]);

  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // use one loader so submit/reset can reuse the same fetch path
  const loadEvents = useCallback(async (nextFilters: BrowseFilters) => {
    setLoadingEvents(true);
    setError(null);

    try {
      const query = buildSearchParams(nextFilters);
      const url = query ? `/api/events?${query}` : "/api/events";

      const res = await apiFetch(url);
      if (!res.ok) throw new Error(await readErrorMessage(res));

      const data = (await res.json()) as EventsResponse;
      setEvents(data.events ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load events");
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  // keep trending separate so search filters do not hide top events widget
  const loadTrending = useCallback(async () => {
    setLoadingTrending(true);

    try {
      const res = await apiFetch("/api/events/trending");
      if (!res.ok) throw new Error(await readErrorMessage(res));

      const data = (await res.json()) as EventsResponse;
      setTrending(data.events ?? []);
    } catch {
      setTrending([]);
    } finally {
      setLoadingTrending(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents(defaultFilters);
    void loadTrending();
  }, [loadEvents, loadTrending]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadEvents(filters);
  }

  async function clearFilters() {
    setFilters(defaultFilters);
    await loadEvents(defaultFilters);
  }

  return (
    <Container className="py-4">
      <div className="mb-3">
        <h1 className="h3 mb-1">Browse Events</h1>
        <p className="text-muted mb-0">Search, filter, and explore ongoing campus activity.</p>
      </div>

      {error ? <Alert variant="danger">{error}</Alert> : null}

      <Card className="border mb-3">
        <Card.Body>
          <Form onSubmit={onSubmit}>
            <Row className="g-3 align-items-end">
              <Col md={4}>
                <Form.Group controlId="browse-q">
                  <Form.Label>Search</Form.Label>
                  <Form.Control
                    value={filters.q}
                    onChange={(event) =>
                      setFilters((prev) => ({ ...prev, q: event.target.value }))
                    }
                    placeholder="name, tags, description"
                  />
                </Form.Group>
              </Col>

              <Col md={2}>
                <Form.Group controlId="browse-type">
                  <Form.Label>Type</Form.Label>
                  <Form.Select
                    value={filters.type}
                    onChange={(event) =>
                      setFilters((prev) => ({
                        ...prev,
                        type: event.target.value as BrowseFilters["type"],
                      }))
                    }
                  >
                    <option value="">All</option>
                    <option value="NORMAL">NORMAL</option>
                    <option value="MERCH">MERCH</option>
                  </Form.Select>
                </Form.Group>
              </Col>

              <Col md={2}>
                <Form.Group controlId="browse-status">
                  <Form.Label>Status</Form.Label>
                  <Form.Select
                    value={filters.status}
                    onChange={(event) =>
                      setFilters((prev) => ({
                        ...prev,
                        status: event.target.value as BrowseFilters["status"],
                      }))
                    }
                  >
                    <option value="">All</option>
                    <option value="PUBLISHED">PUBLISHED</option>
                    <option value="ONGOING">ONGOING</option>
                    <option value="CLOSED">CLOSED</option>
                    <option value="COMPLETED">COMPLETED</option>
                  </Form.Select>
                </Form.Group>
              </Col>

              <Col md={2}>
                <Form.Group controlId="browse-from">
                  <Form.Label>From</Form.Label>
                  <Form.Control
                    type="date"
                    value={filters.from}
                    onChange={(event) =>
                      setFilters((prev) => ({ ...prev, from: event.target.value }))
                    }
                  />
                </Form.Group>
              </Col>

              <Col md={2}>
                <Form.Group controlId="browse-to">
                  <Form.Label>To</Form.Label>
                  <Form.Control
                    type="date"
                    value={filters.to}
                    onChange={(event) =>
                      setFilters((prev) => ({ ...prev, to: event.target.value }))
                    }
                  />
                </Form.Group>
              </Col>

              <Col xs={12} className="d-flex gap-2 justify-content-end">
                <Button variant="outline-secondary" type="button" onClick={() => void clearFilters()}>
                  Reset
                </Button>
                <Button type="submit">Search</Button>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>

      <Card className="border mb-3">
        <Card.Body>
          <Card.Title className="h5 mb-3">Trending (last 24h)</Card.Title>
          {loadingTrending ? (
            <div className="d-flex align-items-center gap-2">
              <Spinner animation="border" size="sm" />
              <span>Loading trending events...</span>
            </div>
          ) : trending.length === 0 ? (
            <div className="text-muted">No trending data yet.</div>
          ) : (
            <Row className="g-3">
              {trending.map((event) => (
                <Col key={`trending-${event.id}`} md={6} lg={4}>
                  <EventCard
                    event={event}
                    onOpenDetail={(eventId) => {
                      navigate(`/participant/events/${eventId}`);
                    }}
                  />
                </Col>
              ))}
            </Row>
          )}
        </Card.Body>
      </Card>

      <Card className="border">
        <Card.Body>
          <Card.Title className="h5 mb-3">All Events</Card.Title>
          {loadingEvents ? (
            <div className="d-flex align-items-center gap-2">
              <Spinner animation="border" size="sm" />
              <span>Loading events...</span>
            </div>
          ) : events.length === 0 ? (
            <div className="text-muted">No events match current filters.</div>
          ) : (
            <Row className="g-3">
              {events.map((event) => (
                <Col key={event.id} md={6} lg={4}>
                  <EventCard
                    event={event}
                    onOpenDetail={(eventId) => {
                      navigate(`/participant/events/${eventId}`);
                    }}
                  />
                </Col>
              ))}
            </Row>
          )}
        </Card.Body>
      </Card>

    </Container>
  );
}
