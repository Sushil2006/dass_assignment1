import { useCallback, useEffect, useState } from "react";
import { Alert, Card, Container, Spinner, Stack } from "react-bootstrap";
import { Link, useParams } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import { apiFetch } from "../../lib/api";

type TicketResponse = {
  ticket?: {
    id: string;
    qrPayload: string;
    eventType: "NORMAL" | "MERCH";
    createdAt: string;
    participationId: string;
    event: {
      id: string;
      name: string;
      type: "NORMAL" | "MERCH";
      status: string;
      startDate: string;
      endDate: string;
      organizerId: string;
    };
    participant: {
      id: string;
      name: string;
      email: string;
    };
  };
};

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data?.error?.message || "Request failed";
  } catch {
    return "Request failed";
  }
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
}

export default function TicketDetail() {
  const { ticketId = "" } = useParams<{ ticketId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<TicketResponse["ticket"] | null>(null);

  const loadTicket = useCallback(async () => {
    if (!ticketId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch(`/api/tickets/${ticketId}`);
      if (!res.ok) throw new Error(await readErrorMessage(res));

      const data = (await res.json()) as TicketResponse;
      setTicket(data.ticket ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load ticket");
      setTicket(null);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    void loadTicket();
  }, [loadTicket]);

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h1 className="h3 mb-1">Ticket Detail</h1>
          <p className="text-muted mb-0">View ticket id, qr payload, and linked event details.</p>
        </div>
        <Stack direction="horizontal" gap={2}>
          <Link className="btn btn-outline-secondary" to="/participant/my-events">
            Back to My Events
          </Link>
        </Stack>
      </div>

      {error ? <Alert variant="danger">{error}</Alert> : null}

      {loading ? (
        <div className="d-flex align-items-center gap-2">
          <Spinner animation="border" size="sm" />
          <span>Loading ticket...</span>
        </div>
      ) : !ticket ? (
        <Card className="border">
          <Card.Body className="text-muted">Ticket not available.</Card.Body>
        </Card>
      ) : (
        <Card className="border">
          <Card.Body>
            <h2 className="h4 mb-3">{ticket.id}</h2>
            <div className="small text-muted mb-3">
              <div>
                <strong>Type:</strong> {ticket.eventType}
              </div>
              <div>
                <strong>Issued:</strong> {formatDate(ticket.createdAt)}
              </div>
              <div>
                <strong>Participant:</strong> {ticket.participant.name} ({ticket.participant.email})
              </div>
            </div>

            <Card className="bg-light border mb-3">
              <Card.Body>
                <h3 className="h6 mb-3">QR Code</h3>
                <div className="d-flex justify-content-center mb-3">
                  <QRCodeCanvas value={ticket.qrPayload} size={220} includeMargin />
                </div>
                <h3 className="h6 mb-2">QR Payload (debug)</h3>
                <pre className="small mb-0">{ticket.qrPayload}</pre>
              </Card.Body>
            </Card>

            <div className="d-flex gap-2 flex-wrap">
              <Link className="btn btn-outline-primary btn-sm" to={`/participant/events/${ticket.event.id}`}>
                Open Event
              </Link>
              <Link className="btn btn-outline-dark btn-sm" to="/participant/my-events">
                Back to History
              </Link>
            </div>
          </Card.Body>
        </Card>
      )}
    </Container>
  );
}
