import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Container,
  Form,
  Row,
  Spinner,
  Tab,
  Tabs,
} from "react-bootstrap";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../../lib/api";

type EventType = "NORMAL" | "MERCH";
type EventStatus = "DRAFT" | "PUBLISHED" | "CLOSED" | "COMPLETED" | "ONGOING";
type ParticipationStatus = "pending" | "confirmed" | "cancelled" | "rejected";
type FieldType = "text" | "textarea" | "number" | "select" | "checkbox" | "file";

type OrganizerEvent = {
  id: string;
  name: string;
  description: string;
  type: EventType;
  tags: string[];
  eligibility: string;
  regFee: number;
  regDeadline: string;
  regLimit: number;
  startDate: string;
  endDate: string;
  status: EventStatus;
  displayStatus?: EventStatus;
};

type EventAnalytics = {
  totalParticipations: number;
  activeParticipations: number;
  confirmedCount: number;
  pendingCount: number;
  cancelledCount: number;
  rejectedCount: number;
  normalCount: number;
  merchCount: number;
  registrations24h: number;
  estimatedRevenue: number;
  attendanceMarked: number;
  attendanceRate: number;
};

type ParticipantFieldResponse = {
  key: string;
  label: string;
  type: FieldType;
  value?: string | number | string[];
  file?: {
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    downloadUrl: string;
  };
};

type EventParticipant = {
  id: string;
  userId: string;
  status: ParticipationStatus;
  eventType: EventType;
  ticketId: string | null;
  createdAt: string;
  updatedAt: string;
  participant: {
    id: string;
    name: string;
    email: string | null;
    participantType: string | null;
    collegeOrOrganization: string | null;
    contactNumber: string | null;
  };
  normalResponses: ParticipantFieldResponse[];
  teamName: string | null;
  payment: {
    status: "pending" | "approved" | "rejected";
    amount: number;
    method: string;
    proofUrl: string | null;
    createdAt: string;
  } | null;
  attendance: {
    isPresent: boolean;
    markedAt: string | null;
  };
  merchPurchase: {
    sku: string;
    label: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
  } | null;
};

type EventDetailResponse = {
  event?: OrganizerEvent;
  analytics?: EventAnalytics;
  participants?: EventParticipant[];
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

function statusBadgeVariant(status: string):
  | "secondary"
  | "success"
  | "warning"
  | "danger"
  | "dark"
  | "primary" {
  if (status === "confirmed") return "success";
  if (status === "pending") return "warning";
  if (status === "cancelled") return "secondary";
  if (status === "rejected") return "danger";
  if (status === "PUBLISHED") return "primary";
  if (status === "ONGOING") return "success";
  if (status === "CLOSED") return "warning";
  if (status === "DRAFT") return "secondary";
  return "dark";
}

function formatFieldValue(field: ParticipantFieldResponse): string {
  if (field.file) return field.file.originalName;
  if (Array.isArray(field.value)) return field.value.join(" | ");
  if (field.value === undefined || field.value === null) return "";
  return String(field.value);
}

export default function OrganizerEventDetail() {
  const { eventId = "" } = useParams<{ eventId: string }>();
  const [loading, setLoading] = useState(true);
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<EventDetailResponse | null>(null);
  const [participantQuery, setParticipantQuery] = useState("");
  const [participantStatusFilter, setParticipantStatusFilter] = useState<
    "all" | ParticipationStatus
  >("all");
  const [participantEventTypeFilter, setParticipantEventTypeFilter] = useState<
    "all" | EventType
  >("all");
  const [attendanceFilter, setAttendanceFilter] = useState<
    "all" | "present" | "absent"
  >("all");
  const [institutionCategoryFilter, setInstitutionCategoryFilter] = useState<
    "all" | "iiit" | "non-iiit"
  >("all");

  const event = detail?.event ?? null;
  const analytics = detail?.analytics ?? null;
  const participants = useMemo(() => detail?.participants ?? [], [detail?.participants]);
  const filteredParticipants = useMemo(() => {
    const query = participantQuery.trim().toLowerCase();

    return participants.filter((entry) => {
      if (participantStatusFilter !== "all" && entry.status !== participantStatusFilter) {
        return false;
      }

      if (
        participantEventTypeFilter !== "all" &&
        entry.eventType !== participantEventTypeFilter
      ) {
        return false;
      }

      if (attendanceFilter === "present" && !entry.attendance.isPresent) {
        return false;
      }

      if (attendanceFilter === "absent" && entry.attendance.isPresent) {
        return false;
      }

      if (institutionCategoryFilter !== "all") {
        const participantType = (entry.participant.participantType ?? "")
          .trim()
          .toLowerCase();
        if (participantType !== institutionCategoryFilter) {
          return false;
        }
      }

      if (!query) return true;

      const participantName = entry.participant.name.toLowerCase();
      const participantEmail = (entry.participant.email ?? "").toLowerCase();
      const ticketId = (entry.ticketId ?? "").toLowerCase();

      return (
        participantName.includes(query) ||
        participantEmail.includes(query) ||
        ticketId.includes(query)
      );
    });
  }, [
    participantQuery,
    participantStatusFilter,
    participantEventTypeFilter,
    attendanceFilter,
    institutionCategoryFilter,
    participants,
  ]);

  const loadDetail = useCallback(async () => {
    if (!eventId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch(`/api/events/organizer/${eventId}/participants`);
      if (!res.ok) throw new Error(await readErrorMessage(res));

      const data = (await res.json()) as EventDetailResponse;
      setDetail(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load event detail");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  async function downloadParticipantsCsv() {
    if (!eventId) return;

    setDownloadingCsv(true);
    setError(null);

    try {
      const res = await apiFetch(`/api/events/organizer/${eventId}/participants.csv`);
      if (!res.ok) throw new Error(await readErrorMessage(res));

      const blob = await res.blob();
      const header = res.headers.get("content-disposition") ?? "";
      const filenameMatch = header.match(/filename="?([^"]+)"?/i);
      const filename = filenameMatch?.[1] ?? "participants.csv";

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Failed to download csv");
    } finally {
      setDownloadingCsv(false);
    }
  }

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h1 className="h3 mb-1">Organizer Event Detail</h1>
          <p className="text-muted mb-0">Track participants, export csv, and view event analytics.</p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <Link className="btn btn-outline-secondary" to="/organizer">
            Back to Dashboard
          </Link>
          <Button
            variant="outline-primary"
            onClick={() => {
              void downloadParticipantsCsv();
            }}
            disabled={downloadingCsv || loading || !event}
          >
            {downloadingCsv ? "Exporting..." : "Export Participants CSV"}
          </Button>
        </div>
      </div>

      {error ? <Alert variant="danger">{error}</Alert> : null}

      {loading ? (
        <div className="d-flex align-items-center gap-2">
          <Spinner animation="border" size="sm" />
          <span>Loading event detail...</span>
        </div>
      ) : !event || !analytics ? (
        <Card className="border">
          <Card.Body className="text-muted">Event not available.</Card.Body>
        </Card>
      ) : (
        <Tabs defaultActiveKey="overview" id="organizer-event-detail-tabs" className="mb-3">
          <Tab eventKey="overview" title="Overview">
            <Card className="border mt-3">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap mb-3">
                  <div>
                    <h2 className="h4 mb-1">{event.name}</h2>
                    <div className="text-muted">{event.description}</div>
                  </div>
                  <div className="d-flex gap-2">
                    <Badge bg="info">{event.type}</Badge>
                    <Badge bg={statusBadgeVariant(event.displayStatus ?? event.status)}>
                      {event.displayStatus ?? event.status}
                    </Badge>
                  </div>
                </div>

                <Row className="small text-muted g-2">
                  <Col md={6}>
                    <div>
                      <strong>Starts:</strong> {formatDate(event.startDate)}
                    </div>
                    <div>
                      <strong>Ends:</strong> {formatDate(event.endDate)}
                    </div>
                    <div>
                      <strong>Registration Deadline:</strong> {formatDate(event.regDeadline)}
                    </div>
                  </Col>
                  <Col md={6}>
                    <div>
                      <strong>Eligibility:</strong> {event.eligibility}
                    </div>
                    <div>
                      <strong>Registration Limit:</strong> {event.regLimit}
                    </div>
                    <div>
                      <strong>Fee:</strong> {formatCurrency(event.regFee)}
                    </div>
                  </Col>
                </Row>

                {event.tags.length > 0 ? (
                  <div className="d-flex flex-wrap gap-2 mt-3">
                    {event.tags.map((tag) => (
                      <Badge bg="light" text="dark" className="border" key={`${event.id}-${tag}`}>
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </Card.Body>
            </Card>
          </Tab>

          <Tab eventKey="participants" title={`Participants (${participants.length})`}>
            <div className="mt-3 d-grid gap-3">
              <Card className="border">
                <Card.Body>
                  <Row className="g-2 align-items-end">
                    <Col md={6} lg={3}>
                      <Form.Group controlId="participant-search">
                        <Form.Label>Search</Form.Label>
                        <Form.Control
                          value={participantQuery}
                          onChange={(currentEvent) =>
                            setParticipantQuery(currentEvent.target.value)
                          }
                          placeholder="name, email, ticket id"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6} lg={3}>
                      <Form.Group controlId="participant-status-filter">
                        <Form.Label>Status</Form.Label>
                        <Form.Select
                          value={participantStatusFilter}
                          onChange={(currentEvent) =>
                            setParticipantStatusFilter(
                              currentEvent.target.value as
                                | "all"
                                | ParticipationStatus,
                            )
                          }
                        >
                          <option value="all">all</option>
                          <option value="pending">pending</option>
                          <option value="confirmed">confirmed</option>
                          <option value="cancelled">cancelled</option>
                          <option value="rejected">rejected</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    <Col md={6} lg={2}>
                      <Form.Group controlId="participant-type-filter">
                        <Form.Label>Event Type</Form.Label>
                        <Form.Select
                          value={participantEventTypeFilter}
                          onChange={(currentEvent) =>
                            setParticipantEventTypeFilter(
                              currentEvent.target.value as "all" | EventType,
                            )
                          }
                        >
                          <option value="all">all</option>
                          <option value="NORMAL">NORMAL</option>
                          <option value="MERCH">MERCH</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    <Col md={6} lg={2}>
                      <Form.Group controlId="participant-attendance-filter">
                        <Form.Label>Attendance</Form.Label>
                        <Form.Select
                          value={attendanceFilter}
                          onChange={(currentEvent) =>
                            setAttendanceFilter(
                              currentEvent.target.value as
                                | "all"
                                | "present"
                                | "absent",
                            )
                          }
                        >
                          <option value="all">all</option>
                          <option value="present">present</option>
                          <option value="absent">absent</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    <Col md={6} lg={2}>
                      <Form.Group controlId="participant-institution-filter">
                        <Form.Label>Institution</Form.Label>
                        <Form.Select
                          value={institutionCategoryFilter}
                          onChange={(currentEvent) =>
                            setInstitutionCategoryFilter(
                              currentEvent.target.value as
                                | "all"
                                | "iiit"
                                | "non-iiit",
                            )
                          }
                        >
                          <option value="all">all</option>
                          <option value="iiit">IIIT</option>
                          <option value="non-iiit">Non-IIIT</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              {filteredParticipants.length === 0 ? (
                <Card className="border">
                  <Card.Body className="text-muted">
                    {participants.length === 0
                      ? "No participants yet."
                      : "No participants match current filters."}
                  </Card.Body>
                </Card>
              ) : (
                filteredParticipants.map((entry) => (
                  <Card className="border" key={entry.id}>
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap mb-2">
                        <div>
                          <h3 className="h6 mb-1">{entry.participant.name}</h3>
                          <div className="small text-muted">
                            {entry.participant.email ?? "email unavailable"}
                          </div>
                        </div>
                        <div className="d-flex gap-2">
                          <Badge bg={statusBadgeVariant(entry.status)}>{entry.status}</Badge>
                          <Badge bg="info">{entry.eventType}</Badge>
                        </div>
                      </div>

                      <Row className="small text-muted g-2 mb-2">
                        <Col md={6}>
                          <div>
                            <strong>Ticket:</strong> {entry.ticketId ?? "-"}
                          </div>
                          <div>
                            <strong>Joined:</strong> {formatDate(entry.createdAt)}
                          </div>
                        </Col>
                        <Col md={6}>
                          <div>
                            <strong>Participant Type:</strong> {entry.participant.participantType ?? "-"}
                          </div>
                          <div>
                            <strong>College/Org:</strong> {entry.participant.collegeOrOrganization ?? "-"}
                          </div>
                        </Col>
                      </Row>

                      {entry.merchPurchase ? (
                        <Card className="bg-light border mb-2">
                          <Card.Body className="py-2 small">
                            <strong>Merch Purchase:</strong> {entry.merchPurchase.label} x
                            {entry.merchPurchase.quantity} ({entry.merchPurchase.sku}) | total{" "}
                            {formatCurrency(entry.merchPurchase.totalAmount)}
                          </Card.Body>
                        </Card>
                      ) : null}

                      <Card className="bg-light border mb-2">
                        <Card.Body className="py-2 small">
                          <div>
                            <strong>Team:</strong> {entry.teamName ?? "-"}
                          </div>
                          <div>
                            <strong>Payment:</strong>{" "}
                            {entry.payment
                              ? `${entry.payment.status} | ${entry.payment.method} | ${formatCurrency(entry.payment.amount)}`
                              : "not available"}
                          </div>
                          <div>
                            <strong>Attendance:</strong>{" "}
                            {entry.attendance.isPresent
                              ? `present (${entry.attendance.markedAt ? formatDate(entry.attendance.markedAt) : "-"})`
                              : "absent"}
                          </div>
                        </Card.Body>
                      </Card>

                      {entry.normalResponses.length > 0 ? (
                        <Card className="bg-light border">
                          <Card.Body className="py-2">
                            <div className="small fw-semibold mb-1">Form Responses</div>
                            <div className="small d-grid gap-1">
                              {entry.normalResponses.map((response) => (
                                <div key={`${entry.id}-${response.key}`}>
                                  <strong>{response.label}:</strong>{" "}
                                  {response.file ? (
                                    <a href={response.file.downloadUrl} target="_blank" rel="noreferrer">
                                      {response.file.originalName}
                                    </a>
                                  ) : (
                                    <span>{formatFieldValue(response) || "-"}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </Card.Body>
                        </Card>
                      ) : null}
                    </Card.Body>
                  </Card>
                ))
              )}
            </div>
          </Tab>

          <Tab eventKey="analytics" title="Analytics">
            <div className="mt-3">
              <Row className="g-3">
                <Col md={4}>
                  <Card className="border h-100">
                    <Card.Body>
                      <div className="text-muted small">Total participations</div>
                      <div className="h4 mb-0">{analytics.totalParticipations}</div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={4}>
                  <Card className="border h-100">
                    <Card.Body>
                      <div className="text-muted small">Active participations</div>
                      <div className="h4 mb-0">{analytics.activeParticipations}</div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={4}>
                  <Card className="border h-100">
                    <Card.Body>
                      <div className="text-muted small">Registrations (24h)</div>
                      <div className="h4 mb-0">{analytics.registrations24h}</div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={4}>
                  <Card className="border h-100">
                    <Card.Body>
                      <div className="text-muted small">Confirmed / Pending</div>
                      <div className="h4 mb-0">
                        {analytics.confirmedCount} / {analytics.pendingCount}
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={4}>
                  <Card className="border h-100">
                    <Card.Body>
                      <div className="text-muted small">Cancelled / Rejected</div>
                      <div className="h4 mb-0">
                        {analytics.cancelledCount} / {analytics.rejectedCount}
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={4}>
                  <Card className="border h-100">
                    <Card.Body>
                      <div className="text-muted small">Estimated revenue</div>
                      <div className="h4 mb-0">{formatCurrency(analytics.estimatedRevenue)}</div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card className="border h-100">
                    <Card.Body>
                      <div className="text-muted small">Normal participations</div>
                      <div className="h4 mb-0">{analytics.normalCount}</div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card className="border h-100">
                    <Card.Body>
                      <div className="text-muted small">Merch participations</div>
                      <div className="h4 mb-0">{analytics.merchCount}</div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card className="border h-100">
                    <Card.Body>
                      <div className="text-muted small">Attendance marked</div>
                      <div className="h4 mb-0">{analytics.attendanceMarked}</div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card className="border h-100">
                    <Card.Body>
                      <div className="text-muted small">Attendance rate</div>
                      <div className="h4 mb-0">{analytics.attendanceRate}%</div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            </div>
          </Tab>
        </Tabs>
      )}
    </Container>
  );
}
