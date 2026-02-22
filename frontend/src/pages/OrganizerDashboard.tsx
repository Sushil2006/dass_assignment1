import { useCallback, useEffect, useState } from "react";
import { Alert, Button, ButtonGroup, Card, Container, Row, Col, Spinner, Table } from "react-bootstrap";
import CreateEventWizard from "./organizer/CreateEventWizard";
import MyEvents from "./organizer/MyEvents";
import OrganizerProfile from "./organizer/OrganizerProfile";
import { apiFetch } from "../lib/api";

type OrganizerView = "events" | "create" | "profile" | "analytics";

type OrganizerAnalyticsSummary = {
  totalEvents: number;
  draftEvents: number;
  publishedEvents: number;
  closedEvents: number;
  completedEvents: number;
  totalParticipations: number;
  activeParticipations: number;
  confirmedCount: number;
  pendingCount: number;
  cancelledCount: number;
  rejectedCount: number;
  registrations24h: number;
  estimatedRevenue: number;
  attendanceMarked: number;
  attendanceRate: number;
};

type OrganizerTopEvent = {
  id: string;
  name: string;
  type: "NORMAL" | "MERCH";
  status: "DRAFT" | "PUBLISHED" | "CLOSED" | "COMPLETED";
  startDate: string;
  endDate: string;
  totalParticipations: number;
  activeParticipations: number;
  registrations24h: number;
  estimatedRevenue: number;
  attendanceMarked: number;
  attendanceRate: number;
};

type AnalyticsResponse = {
  summary?: OrganizerAnalyticsSummary;
  topEvents?: OrganizerTopEvent[];
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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function emptySummary(): OrganizerAnalyticsSummary {
  return {
    totalEvents: 0,
    draftEvents: 0,
    publishedEvents: 0,
    closedEvents: 0,
    completedEvents: 0,
    totalParticipations: 0,
    activeParticipations: 0,
    confirmedCount: 0,
    pendingCount: 0,
    cancelledCount: 0,
    rejectedCount: 0,
    registrations24h: 0,
    estimatedRevenue: 0,
    attendanceMarked: 0,
    attendanceRate: 0,
  };
}

export default function OrganizerDashboard() {
  const [view, setView] = useState<OrganizerView>("events");

  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [summary, setSummary] = useState<OrganizerAnalyticsSummary>(emptySummary());
  const [topEvents, setTopEvents] = useState<OrganizerTopEvent[]>([]);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);

    try {
      const res = await apiFetch("/api/events/organizer/analytics/summary");
      if (!res.ok) throw new Error(await readErrorMessage(res));

      const data = (await res.json()) as AnalyticsResponse;
      setSummary(data.summary ?? emptySummary());
      setTopEvents(data.topEvents ?? []);
    } catch (loadError) {
      setAnalyticsError(
        loadError instanceof Error ? loadError.message : "Failed to load analytics",
      );
      setSummary(emptySummary());
      setTopEvents([]);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view !== "analytics") return;
    void loadAnalytics();
  }, [view, loadAnalytics]);

  return (
    <Container className="py-4">
      <div className="mb-3">
        <h1 className="h3 mb-1">Organizer Dashboard</h1>
        <p className="text-muted mb-0">Manage events, profile, and organizer analytics.</p>
      </div>

      <ButtonGroup className="mb-3 flex-wrap">
        <Button
          variant={view === "events" ? "primary" : "outline-primary"}
          onClick={() => setView("events")}
        >
          My Events
        </Button>
        <Button
          variant={view === "create" ? "primary" : "outline-primary"}
          onClick={() => setView("create")}
        >
          Create Event
        </Button>
        <Button
          variant={view === "analytics" ? "primary" : "outline-primary"}
          onClick={() => setView("analytics")}
        >
          Analytics
        </Button>
        <Button
          variant={view === "profile" ? "primary" : "outline-primary"}
          onClick={() => setView("profile")}
        >
          Profile
        </Button>
      </ButtonGroup>

      {view === "events" ? <MyEvents /> : null}
      {view === "create" ? <CreateEventWizard /> : null}
      {view === "profile" ? <OrganizerProfile /> : null}

      {view === "analytics" ? (
        <>
          <div className="d-flex justify-content-end mb-3">
            <Button
              size="sm"
              variant="outline-secondary"
              disabled={analyticsLoading}
              onClick={() => {
                void loadAnalytics();
              }}
            >
              Refresh
            </Button>
          </div>

          {analyticsError ? <Alert variant="danger">{analyticsError}</Alert> : null}

          {analyticsLoading ? (
            <div className="d-flex align-items-center gap-2">
              <Spinner animation="border" size="sm" />
              <span>Loading analytics...</span>
            </div>
          ) : (
            <>
              <Row className="g-3 mb-3">
                <Col md={4}>
                  <Card className="border h-100">
                    <Card.Body>
                      <div className="text-muted small">Total events</div>
                      <div className="h4 mb-0">{summary.totalEvents}</div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={4}>
                  <Card className="border h-100">
                    <Card.Body>
                      <div className="text-muted small">Total participations</div>
                      <div className="h4 mb-0">{summary.totalParticipations}</div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={4}>
                  <Card className="border h-100">
                    <Card.Body>
                      <div className="text-muted small">Estimated revenue</div>
                      <div className="h4 mb-0">{formatCurrency(summary.estimatedRevenue)}</div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={3}>
                  <Card className="border h-100">
                    <Card.Body>
                      <div className="text-muted small">Draft / Published</div>
                      <div className="h5 mb-0">
                        {summary.draftEvents} / {summary.publishedEvents}
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={3}>
                  <Card className="border h-100">
                    <Card.Body>
                      <div className="text-muted small">Closed / Completed</div>
                      <div className="h5 mb-0">
                        {summary.closedEvents} / {summary.completedEvents}
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={3}>
                  <Card className="border h-100">
                    <Card.Body>
                      <div className="text-muted small">Confirmed / Pending</div>
                      <div className="h5 mb-0">
                        {summary.confirmedCount} / {summary.pendingCount}
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={3}>
                  <Card className="border h-100">
                    <Card.Body>
                      <div className="text-muted small">Cancelled / Rejected</div>
                      <div className="h5 mb-0">
                        {summary.cancelledCount} / {summary.rejectedCount}
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card className="border h-100">
                    <Card.Body>
                      <div className="text-muted small">Attendance marked</div>
                      <div className="h5 mb-0">{summary.attendanceMarked}</div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card className="border h-100">
                    <Card.Body>
                      <div className="text-muted small">Attendance rate</div>
                      <div className="h5 mb-0">{summary.attendanceRate}%</div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              <Card className="border">
                <Card.Body>
                  <Card.Title className="h5">Top Events</Card.Title>
                  {topEvents.length === 0 ? (
                    <div className="text-muted">No events available yet.</div>
                  ) : (
                    <Table responsive hover size="sm" className="mb-0 align-middle">
                      <thead>
                        <tr>
                          <th>Event</th>
                          <th>Status</th>
                          <th>Active/Total</th>
                          <th>Regs (24h)</th>
                          <th>Revenue</th>
                          <th>Attendance</th>
                          <th>Schedule</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topEvents.map((event) => (
                          <tr key={event.id}>
                            <td>
                              <div className="fw-semibold">{event.name}</div>
                              <div className="small text-muted">{event.type}</div>
                            </td>
                            <td>{event.status}</td>
                            <td>
                              {event.activeParticipations}/{event.totalParticipations}
                            </td>
                            <td>{event.registrations24h}</td>
                            <td>{formatCurrency(event.estimatedRevenue)}</td>
                            <td>
                              {event.attendanceMarked} ({event.attendanceRate}%)
                            </td>
                            <td className="small text-muted">
                              {formatDate(event.startDate)} - {formatDate(event.endDate)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  )}
                </Card.Body>
              </Card>
            </>
          )}
        </>
      ) : null}
    </Container>
  );
}
