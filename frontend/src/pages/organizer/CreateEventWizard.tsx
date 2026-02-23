import { useState } from "react";
import { Alert, Card, Container, ListGroup } from "react-bootstrap";
import { Link } from "react-router-dom";
import { apiFetch } from "../../lib/api";
import { readApiErrorMessage } from "../../lib/errors";
import EventEditorForm, { type EventEditorValues } from "./EventEditorForm";

async function readErrorMessage(res: Response): Promise<string> {
  return readApiErrorMessage(res);
}

export default function CreateEventWizard() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);

  async function createEvent(values: EventEditorValues) {
    setBusy(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await apiFetch("/api/events/organizer", {
        method: "POST",
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        throw new Error(await readErrorMessage(res));
      }

      const data = (await res.json()) as { event?: { id?: string } };
      setCreatedEventId(data.event?.id ?? null);
      setSuccessMessage("Draft event created successfully.");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to create event",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h1 className="h3 mb-1">Create Event Wizard</h1>
          <p className="text-muted mb-0">
            Draft first, configure type details, then publish from My Events.
          </p>
        </div>
        <Link to="/organizer" className="btn btn-outline-secondary">
          Back to organizer home
        </Link>
      </div>

      <Card className="mb-3 border">
        <Card.Body>
          {/* show the flow as simple steps to guide organizers */}
          <ListGroup variant="flush">
            <ListGroup.Item>Step 1 - fill event basics (name, dates, limits).</ListGroup.Item>
            <ListGroup.Item>Step 2 - add type-specific config JSON.</ListGroup.Item>
            <ListGroup.Item>Step 3 - save draft and publish from My Events.</ListGroup.Item>
          </ListGroup>
        </Card.Body>
      </Card>

      {error ? <Alert variant="danger">{error}</Alert> : null}
      {successMessage ? <Alert variant="success">{successMessage}</Alert> : null}

      {createdEventId ? (
        <Alert variant="info">
          Created event id: <strong>{createdEventId}</strong>
        </Alert>
      ) : null}

      <Card className="border">
        <Card.Body>
          <EventEditorForm
            busy={busy}
            submitLabel="Create draft event"
            onSubmit={createEvent}
          />
        </Card.Body>
      </Card>
    </Container>
  );
}
