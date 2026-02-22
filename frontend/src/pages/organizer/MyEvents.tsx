import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Carousel,
  Col,
  Container,
  Modal,
  Row,
  Spinner,
} from "react-bootstrap";
import { Link } from "react-router-dom";
import EventCard, { type EventCardData, type EventStatus } from "../../components/EventCard";
import { apiFetch } from "../../lib/api";
import EventEditorForm, {
  type EventEditorValues,
  type MerchConfig,
  type NormalFormConfig,
} from "./EventEditorForm";

type OrganizerEvent = EventCardData & {
  regDeadline: string;
  regLimit: number;
  regFee: number;
  eligibility: string;
  normalForm?: NormalFormConfig;
  merchConfig?: MerchConfig;
};

type OrganizerEventsResponse = {
  events?: OrganizerEvent[];
};

type MyEventsProps = {
  mode?: "all" | "ongoing";
};

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data?.error?.message || "Request failed";
  } catch {
    return "Request failed";
  }
}

function toEditorValues(event: OrganizerEvent): EventEditorValues {
  return {
    name: event.name,
    description: event.description,
    type: event.type,
    tags: event.tags,
    eligibility: event.eligibility,
    regFee: event.regFee,
    regDeadline: event.regDeadline,
    regLimit: event.regLimit,
    startDate: event.startDate,
    endDate: event.endDate,
    normalForm: event.normalForm,
    merchConfig: event.merchConfig,
  };
}

function chunkEvents(events: OrganizerEvent[], chunkSize: number): OrganizerEvent[][] {
  const chunks: OrganizerEvent[][] = [];

  for (let index = 0; index < events.length; index += chunkSize) {
    chunks.push(events.slice(index, index + chunkSize));
  }

  return chunks;
}

export default function MyEvents({ mode = "all" }: MyEventsProps) {
  const [events, setEvents] = useState<OrganizerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [actioningId, setActioningId] = useState<string | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const editingEvent = useMemo(
    () => events.find((event) => event.id === editingEventId) ?? null,
    [events, editingEventId],
  );
  const filteredEvents = useMemo(() => {
    if (mode === "all") return events;

    return events.filter(
      (event) =>
        event.displayStatus === "ONGOING" ||
        event.status === "ONGOING",
    );
  }, [events, mode]);
  const carouselSlides = useMemo(
    () => chunkEvents(filteredEvents, 3),
    [filteredEvents],
  );

  // keep one loader function for initial load and post-action refresh
  const loadMyEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch("/api/events/organizer");
      if (!res.ok) throw new Error(await readErrorMessage(res));

      const data = (await res.json()) as OrganizerEventsResponse;
      setEvents(data.events ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load events");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMyEvents();
  }, [loadMyEvents]);

  async function updateEventStatus(eventId: string, status: EventStatus) {
    setActioningId(eventId);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch(`/api/events/organizer/${eventId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });

      if (!res.ok) throw new Error(await readErrorMessage(res));

      setSuccess(`Event moved to ${status}.`);
      await loadMyEvents();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Failed to update status");
    } finally {
      setActioningId(null);
    }
  }

  async function deleteEvent(eventId: string) {
    setActioningId(eventId);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch(`/api/events/organizer/${eventId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));

      setSuccess("Event deleted.");
      await loadMyEvents();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete event");
    } finally {
      setActioningId(null);
    }
  }

  async function saveEventEdits(values: EventEditorValues) {
    if (!editingEvent) return;

    setSavingEdit(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch(`/api/events/organizer/${editingEvent.id}`, {
        method: "PATCH",
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));

      setSuccess("Event updated successfully.");
      setEditingEventId(null);
      await loadMyEvents();
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : "Failed to update event");
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h1 className="h3 mb-1">
            {mode === "ongoing" ? "Ongoing Events" : "My Events"}
          </h1>
          <p className="text-muted mb-0">
            {mode === "ongoing"
              ? "Track currently active events and jump into operations."
              : "Create drafts, publish events, and manage lifecycle."}
          </p>
        </div>
        {mode === "all" ? (
          <Link to="/organizer/events/new" className="btn btn-primary">
            Create Draft Event
          </Link>
        ) : (
          <Link to="/organizer" className="btn btn-outline-secondary">
            Back to Dashboard
          </Link>
        )}
      </div>

      {error ? <Alert variant="danger">{error}</Alert> : null}
      {success ? <Alert variant="success">{success}</Alert> : null}

      {loading ? (
        <div className="d-flex align-items-center gap-2">
          <Spinner animation="border" size="sm" />
          <span>Loading events...</span>
        </div>
      ) : filteredEvents.length === 0 ? (
        <Card className="border">
          <Card.Body className="text-muted">
            {mode === "ongoing"
              ? "No ongoing events right now."
              : "No events yet. Create your first draft."}
          </Card.Body>
        </Card>
      ) : (
        <>
          <Card className="border mb-3">
            <Card.Body>
              <Card.Title className="h5 mb-3">Events Carousel</Card.Title>
              <Carousel interval={null}>
                {carouselSlides.map((slide, index) => (
                  <Carousel.Item key={`slide-${index}`}>
                    <Row className="g-3">
                      {slide.map((event) => (
                        <Col key={`slide-${index}-${event.id}`} md={4}>
                          <EventCard
                            event={event}
                            actions={
                              <Link
                                to={`/organizer/events/${event.id}`}
                                className="btn btn-outline-primary btn-sm"
                              >
                                Manage
                              </Link>
                            }
                          />
                        </Col>
                      ))}
                    </Row>
                  </Carousel.Item>
                ))}
              </Carousel>
            </Card.Body>
          </Card>

          <Row className="g-3">
            {filteredEvents.map((event) => {
            const busy = actioningId === event.id;

            return (
              <Col key={event.id} md={6} lg={4}>
                <EventCard
                  event={event}
                  actions={
                    <>
                      <Link
                        to={`/organizer/events/${event.id}`}
                        className="btn btn-outline-primary btn-sm"
                      >
                        Open
                      </Link>

                      <Button
                        size="sm"
                        variant="outline-secondary"
                        onClick={() => {
                          setEditingEventId(event.id);
                        }}
                      >
                        Edit
                      </Button>

                      {event.status === "DRAFT" ? (
                        <Button
                          size="sm"
                          variant="outline-success"
                          disabled={busy}
                          onClick={() => {
                            void updateEventStatus(event.id, "PUBLISHED");
                          }}
                        >
                          Publish
                        </Button>
                      ) : null}

                      {event.status === "PUBLISHED" ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline-warning"
                            disabled={busy}
                            onClick={() => {
                              void updateEventStatus(event.id, "CLOSED");
                            }}
                          >
                            Close
                          </Button>

                          <Button
                            size="sm"
                            variant="outline-dark"
                            disabled={busy}
                            onClick={() => {
                              void updateEventStatus(event.id, "COMPLETED");
                            }}
                          >
                            Complete
                          </Button>
                        </>
                      ) : null}

                      {event.status === "CLOSED" ? (
                        <Button
                          size="sm"
                          variant="outline-dark"
                          disabled={busy}
                          onClick={() => {
                            void updateEventStatus(event.id, "COMPLETED");
                          }}
                        >
                          Complete
                        </Button>
                      ) : null}

                      <Button
                        size="sm"
                        variant="outline-danger"
                        disabled={busy}
                        onClick={() => {
                          void deleteEvent(event.id);
                        }}
                      >
                        Delete
                      </Button>
                    </>
                  }
                />
              </Col>
            );
            })}
          </Row>
        </>
      )}

      <Modal
        show={Boolean(editingEvent)}
        onHide={() => {
          setEditingEventId(null);
        }}
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>Edit Event</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {editingEvent ? (
            // reuse shared editor to keep create and edit validation aligned
            <EventEditorForm
              initialValues={toEditorValues(editingEvent)}
              busy={savingEdit}
              submitLabel="Save changes"
              onSubmit={saveEventEdits}
            />
          ) : null}
        </Modal.Body>
      </Modal>
    </Container>
  );
}
