import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, Col, Container, Row, Spinner, Tab, Tabs } from "react-bootstrap";
import { Link } from "react-router-dom";
import EventCard from "../../components/EventCard";
import { apiFetch } from "../../lib/api";

type ParticipationStatus = "pending" | "confirmed" | "cancelled" | "rejected";
type EventType = "NORMAL" | "MERCH";

type ParticipationEvent = {
  id: string;
  name: string;
  description: string;
  type: EventType;
  tags: string[];
  status: string;
  displayStatus?: string;
  startDate: string;
  endDate: string;
  eligibility?: string;
  regFee?: number;
  canRegister?: boolean;
};

type MerchPurchase = {
  sku: string;
  label: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
};

type ParticipationItem = {
  id: string;
  eventId: string;
  status: ParticipationStatus;
  eventType: EventType;
  ticketId: string;
  createdAt: string;
  event: ParticipationEvent;
  merchPurchase?: MerchPurchase;
};

type MyEventsResponse = {
  upcoming?: ParticipationItem[];
  normal?: ParticipationItem[];
  merchandise?: ParticipationItem[];
  completed?: ParticipationItem[];
  cancelledRejected?: ParticipationItem[];
};

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data?.error?.message || "Request failed";
  } catch {
    return "Request failed";
  }
}

function canCancel(status: ParticipationStatus): boolean {
  return status === "pending" || status === "confirmed";
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
}

export default function MyEvents() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [buckets, setBuckets] = useState<Required<MyEventsResponse>>({
    upcoming: [],
    normal: [],
    merchandise: [],
    completed: [],
    cancelledRejected: [],
  });

  const loadMyEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch("/api/participants/me/events");
      if (!res.ok) throw new Error(await readErrorMessage(res));

      const data = (await res.json()) as MyEventsResponse;
      setBuckets({
        upcoming: data.upcoming ?? [],
        normal: data.normal ?? [],
        merchandise: data.merchandise ?? [],
        completed: data.completed ?? [],
        cancelledRejected: data.cancelledRejected ?? [],
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load events");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMyEvents();
  }, [loadMyEvents]);

  async function cancelParticipation(participationId: string) {
    setActioningId(participationId);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch(`/api/participations/${participationId}/cancel`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));

      setSuccess("Participation cancelled.");
      await loadMyEvents();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Failed to cancel");
    } finally {
      setActioningId(null);
    }
  }

  function renderItems(items: ParticipationItem[], emptyText: string) {
    if (items.length === 0) {
      return (
        <Card className="border">
          <Card.Body className="text-muted">{emptyText}</Card.Body>
        </Card>
      );
    }

    return (
      <Row className="g-3">
        {items.map((item) => (
          <Col key={item.id} md={6} lg={4}>
            <EventCard
              event={item.event}
              actions={
                <>
                  <Link className="btn btn-outline-primary btn-sm" to={`/participant/events/${item.eventId}`}>
                    Open Event
                  </Link>
                  <Link className="btn btn-outline-dark btn-sm" to={`/participant/tickets/${item.ticketId}`}>
                    Ticket
                  </Link>
                  {canCancel(item.status) ? (
                    <Button
                      variant="outline-danger"
                      size="sm"
                      disabled={actioningId === item.id}
                      onClick={() => {
                        void cancelParticipation(item.id);
                      }}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </>
              }
            />
            <Card className="mt-2 border-0">
              <Card.Body className="px-0 pt-1 pb-0 small text-muted">
                <div>
                  <strong>Participation:</strong> {item.status}
                </div>
                <div>
                  <strong>Joined:</strong> {formatDate(item.createdAt)}
                </div>
                {item.merchPurchase ? (
                  <div>
                    <strong>Purchase:</strong> {item.merchPurchase.label} x{item.merchPurchase.quantity}
                  </div>
                ) : null}
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
    );
  }

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h1 className="h3 mb-1">My Events</h1>
          <p className="text-muted mb-0">Track participations, tickets, and history tabs.</p>
        </div>
        <Link className="btn btn-primary" to="/participant/events">
          Browse Events
        </Link>
      </div>

      {error ? <Alert variant="danger">{error}</Alert> : null}
      {success ? <Alert variant="success">{success}</Alert> : null}

      {loading ? (
        <div className="d-flex align-items-center gap-2">
          <Spinner animation="border" size="sm" />
          <span>Loading your events...</span>
        </div>
      ) : (
        <Tabs defaultActiveKey="upcoming" id="participant-my-events-tabs" className="mb-3">
          <Tab eventKey="upcoming" title={`Upcoming (${buckets.upcoming.length})`}>
            {renderItems(buckets.upcoming, "No upcoming participations yet.")}
          </Tab>
          <Tab eventKey="normal" title={`Normal (${buckets.normal.length})`}>
            {renderItems(buckets.normal, "No normal event participations yet.")}
          </Tab>
          <Tab eventKey="merchandise" title={`Merchandise (${buckets.merchandise.length})`}>
            {renderItems(buckets.merchandise, "No merchandise participations yet.")}
          </Tab>
          <Tab eventKey="completed" title={`Completed (${buckets.completed.length})`}>
            {renderItems(buckets.completed, "No completed participations yet.")}
          </Tab>
          <Tab
            eventKey="cancelled-rejected"
            title={`Cancelled/Rejected (${buckets.cancelledRejected.length})`}
          >
            {renderItems(buckets.cancelledRejected, "No cancelled or rejected records yet.")}
          </Tab>
        </Tabs>
      )}
    </Container>
  );
}
