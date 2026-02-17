import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Col, Container, Modal, Row, Spinner } from "react-bootstrap";
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

export default function MyEvents() {
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
          <h1 className="h3 mb-1">My Events</h1>
          <p className="text-muted mb-0">Create drafts, publish events, and manage lifecycle.</p>
        </div>
        <Link to="/organizer/events/new" className="btn btn-primary">
          Create Draft Event
        </Link>
      </div>

      {error ? <Alert variant="danger">{error}</Alert> : null}
      {success ? <Alert variant="success">{success}</Alert> : null}

      {loading ? (
        <div className="d-flex align-items-center gap-2">
          <Spinner animation="border" size="sm" />
          <span>Loading events...</span>
        </div>
      ) : events.length === 0 ? (
        <Card className="border">
          <Card.Body className="text-muted">No events yet. Create your first draft.</Card.Body>
        </Card>
      ) : (
        <Row className="g-3">
          {events.map((event) => {
            const busy = actioningId === event.id;

            return (
              <Col key={event.id} md={6} lg={4}>
                <EventCard
                  event={event}
                  actions={
                    <>
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
