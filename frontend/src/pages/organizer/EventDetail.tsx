import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import jsQR from "jsqr";
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
  attendanceAuditTrail?: AttendanceAuditEntry[];
};

type AttendanceScanResponse = {
  alreadyMarked: boolean;
  attendance: {
    id: string;
    eventId: string;
    participationId: string;
    userId: string;
    markedAt: string;
  };
  ticket: {
    id: string;
    eventId: string;
    participationId: string;
  };
  participant: {
    id: string;
    name: string;
    email: string | null;
  };
};

type AttendanceAuditAction =
  | "scan_mark_present"
  | "manual_mark_present"
  | "manual_mark_absent";

type AttendanceAuditEntry = {
  id: string;
  eventId: string;
  participationId: string;
  userId: string;
  participantName: string;
  actorOrganizerId: string;
  actorOrganizerName: string | null;
  action: AttendanceAuditAction;
  reason: string | null;
  previousIsPresent: boolean;
  previousMarkedAt: string | null;
  nextIsPresent: boolean;
  nextMarkedAt: string | null;
  createdAt: string;
};

type AttendanceOverrideResponse = {
  alreadyInState: boolean;
  attendance: {
    id: string;
    eventId: string;
    participationId: string;
    userId: string;
    markedAt: string;
  } | null;
  participant: {
    id: string;
    name: string;
    email: string | null;
  };
};

type BarcodeDetectorCtor = new (options?: {
  formats?: string[];
}) => {
  detect: (
    source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas,
  ) => Promise<Array<{ rawValue?: string }>>;
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
  if (status === "approved") return "success";
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

function formatAttendanceAuditAction(action: AttendanceAuditAction): string {
  if (action === "scan_mark_present") return "scan marked present";
  if (action === "manual_mark_present") return "manual override: present";
  return "manual override: absent";
}

async function decodeQrPayloadFromImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const maxSide = 1400;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.floor(bitmap.width * scale));
  const height = Math.max(1, Math.floor(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Failed to process image");
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const imageData = context.getImageData(0, 0, width, height);
  const result = jsQR(imageData.data, width, height);
  const payload = result?.data?.trim();
  if (!payload) {
    throw new Error("No QR code found in the uploaded image");
  }

  return payload;
}

export default function OrganizerEventDetail() {
  const { eventId = "" } = useParams<{ eventId: string }>();
  const [loading, setLoading] = useState(true);
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [resolvingPaymentId, setResolvingPaymentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
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
  const [attendanceTicketIdInput, setAttendanceTicketIdInput] = useState("");
  const [attendanceQrPayloadInput, setAttendanceQrPayloadInput] = useState("");
  const [attendanceQrImage, setAttendanceQrImage] = useState<File | null>(null);
  const [markingAttendance, setMarkingAttendance] = useState(false);
  const [overridingAttendanceId, setOverridingAttendanceId] = useState<string | null>(
    null,
  );
  const [extractingQrFromImage, setExtractingQrFromImage] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [scannerSupported, setScannerSupported] = useState(false);
  const scannerVideoRef = useRef<HTMLVideoElement | null>(null);
  const scannerStreamRef = useRef<MediaStream | null>(null);
  const scannerLoopRef = useRef<number | null>(null);
  const barcodeDetectorRef = useRef<InstanceType<BarcodeDetectorCtor> | null>(null);

  const event = detail?.event ?? null;
  const analytics = detail?.analytics ?? null;
  const participants = useMemo(() => detail?.participants ?? [], [detail?.participants]);
  const attendanceAuditTrail = useMemo(
    () => detail?.attendanceAuditTrail ?? [],
    [detail?.attendanceAuditTrail],
  );
  const merchOrders = useMemo(
    () =>
      participants.filter(
        (entry) =>
          entry.eventType === "MERCH" &&
          entry.merchPurchase !== null &&
          entry.payment !== null,
      ),
    [participants],
  );
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

  useEffect(() => {
    const hasDetector =
      typeof window !== "undefined" &&
      "BarcodeDetector" in window &&
      typeof window.BarcodeDetector === "function";
    setScannerSupported(hasDetector);
  }, []);

  const stopCameraScanner = useCallback(() => {
    if (scannerLoopRef.current !== null) {
      window.clearTimeout(scannerLoopRef.current);
      scannerLoopRef.current = null;
    }

    const stream = scannerStreamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      scannerStreamRef.current = null;
    }

    const video = scannerVideoRef.current;
    if (video) {
      video.srcObject = null;
    }

    barcodeDetectorRef.current = null;
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCameraScanner();
    };
  }, [stopCameraScanner]);

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

  async function resolveMerchPayment(
    participationId: string,
    decision: "approve" | "reject",
  ) {
    setResolvingPaymentId(participationId);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch(`/api/participations/${participationId}/payment`, {
        method: "PATCH",
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));

      setSuccess(
        decision === "approve"
          ? "Payment approved and ticket issued."
          : "Payment rejected.",
      );
      await loadDetail();
    } catch (resolveError) {
      setError(
        resolveError instanceof Error
          ? resolveError.message
          : "Failed to resolve payment",
      );
    } finally {
      setResolvingPaymentId(null);
    }
  }

  async function markAttendanceByTicketId() {
    if (!eventId) return;
    const ticketId = attendanceTicketIdInput.trim();
    if (!ticketId) {
      setError("Ticket id is required.");
      return;
    }

    setMarkingAttendance(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch(`/api/events/organizer/${eventId}/attendance/scan`, {
        method: "POST",
        body: JSON.stringify({ ticketId }),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));

      const data = (await res.json()) as AttendanceScanResponse;
      setSuccess(
        data.alreadyMarked
          ? `Attendance already marked for ${data.participant.name} (${data.ticket.id}).`
          : `Attendance marked for ${data.participant.name} (${data.ticket.id}).`,
      );
      setAttendanceTicketIdInput("");
      await loadDetail();
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Failed to mark attendance");
    } finally {
      setMarkingAttendance(false);
    }
  }

  async function markAttendanceByQrPayload() {
    if (!eventId) return;
    const qrPayload = attendanceQrPayloadInput.trim();
    if (!qrPayload) {
      setError("QR payload is required.");
      return;
    }

    setMarkingAttendance(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch(`/api/events/organizer/${eventId}/attendance/scan`, {
        method: "POST",
        body: JSON.stringify({ qrPayload }),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));

      const data = (await res.json()) as AttendanceScanResponse;
      setSuccess(
        data.alreadyMarked
          ? `Attendance already marked for ${data.participant.name} (${data.ticket.id}).`
          : `Attendance marked for ${data.participant.name} (${data.ticket.id}).`,
      );
      await loadDetail();
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Failed to mark attendance");
    } finally {
      setMarkingAttendance(false);
    }
  }

  async function overrideAttendance(
    participationId: string,
    present: boolean,
    participantName: string,
  ) {
    if (!eventId) return;

    const reasonInput = window.prompt(
      `Reason for marking ${participantName} as ${present ? "present" : "absent"}:`,
      "",
    );
    if (reasonInput === null) return;

    const reason = reasonInput.trim();
    if (reason.length < 3) {
      setError("Reason must be at least 3 characters for manual override.");
      return;
    }

    setOverridingAttendanceId(participationId);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch(`/api/events/organizer/${eventId}/attendance/override`, {
        method: "PATCH",
        body: JSON.stringify({ participationId, present, reason }),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));

      const data = (await res.json()) as AttendanceOverrideResponse;
      if (data.alreadyInState) {
        setSuccess(
          `${data.participant.name} is already marked as ${present ? "present" : "absent"}.`,
        );
      } else {
        setSuccess(
          `Manual attendance override saved for ${data.participant.name} (${present ? "present" : "absent"}).`,
        );
      }
      await loadDetail();
    } catch (overrideError) {
      setError(
        overrideError instanceof Error
          ? overrideError.message
          : "Failed to override attendance",
      );
    } finally {
      setOverridingAttendanceId(null);
    }
  }

  async function startCameraScanner() {
    if (!scannerSupported) {
      setScannerError("Camera QR scanning is not supported in this browser.");
      return;
    }

    try {
      stopCameraScanner();
      setScannerError(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
        },
        audio: false,
      });
      scannerStreamRef.current = stream;

      const video = scannerVideoRef.current;
      if (!video) {
        stopCameraScanner();
        setScannerError("Scanner video element is unavailable.");
        return;
      }

      video.srcObject = stream;
      await video.play();

      const Detector = (window as Window & { BarcodeDetector?: BarcodeDetectorCtor })
        .BarcodeDetector;
      if (!Detector) {
        stopCameraScanner();
        setScannerError("BarcodeDetector is not available.");
        return;
      }

      barcodeDetectorRef.current = new Detector({ formats: ["qr_code"] });
      setCameraActive(true);

      const scanLoop = async () => {
        if (!barcodeDetectorRef.current || !scannerVideoRef.current) return;
        if (scannerVideoRef.current.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
          scannerLoopRef.current = window.setTimeout(() => {
            void scanLoop();
          }, 250);
          return;
        }

        try {
          const results = await barcodeDetectorRef.current.detect(scannerVideoRef.current);
          const firstValue = results[0]?.rawValue?.trim();
          if (firstValue) {
            setAttendanceQrPayloadInput(firstValue);
            setSuccess("QR payload captured. Click mark attendance to confirm.");
            stopCameraScanner();
            return;
          }
        } catch {
          // keep scanning
        }

        scannerLoopRef.current = window.setTimeout(() => {
          void scanLoop();
        }, 350);
      };

      scannerLoopRef.current = window.setTimeout(() => {
        void scanLoop();
      }, 350);
    } catch (cameraError) {
      stopCameraScanner();
      setScannerError(
        cameraError instanceof Error
          ? cameraError.message
          : "Unable to start camera scanner",
      );
    }
  }

  async function extractQrPayloadFromImage() {
    if (!attendanceQrImage) {
      setError("QR image file is required.");
      return;
    }

    setExtractingQrFromImage(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = await decodeQrPayloadFromImage(attendanceQrImage);
      setAttendanceQrPayloadInput(payload);
      setSuccess("QR payload extracted from image. Click mark by QR payload.");
    } catch (decodeError) {
      setError(
        decodeError instanceof Error
          ? decodeError.message
          : "Failed to decode QR from image",
      );
    } finally {
      setExtractingQrFromImage(false);
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
      {success ? <Alert variant="success">{success}</Alert> : null}

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
                          {entry.payment?.proofUrl ? (
                            <div>
                              <strong>Proof:</strong>{" "}
                              <a href={entry.payment.proofUrl} target="_blank" rel="noreferrer">
                                open proof
                              </a>
                            </div>
                          ) : null}
                          <div>
                            <strong>Attendance:</strong>{" "}
                            {entry.attendance.isPresent
                              ? `present (${entry.attendance.markedAt ? formatDate(entry.attendance.markedAt) : "-"})`
                              : "absent"}
                          </div>
                          {entry.status === "confirmed" ? (
                            <div className="mt-2 d-flex gap-2 flex-wrap">
                              <Button
                                size="sm"
                                variant="outline-success"
                                disabled={overridingAttendanceId === entry.id}
                                onClick={() => {
                                  void overrideAttendance(
                                    entry.id,
                                    true,
                                    entry.participant.name,
                                  );
                                }}
                              >
                                Mark Present
                              </Button>
                              <Button
                                size="sm"
                                variant="outline-secondary"
                                disabled={overridingAttendanceId === entry.id}
                                onClick={() => {
                                  void overrideAttendance(
                                    entry.id,
                                    false,
                                    entry.participant.name,
                                  );
                                }}
                              >
                                Mark Absent
                              </Button>
                            </div>
                          ) : null}
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

          <Tab eventKey="attendance" title="Attendance Scanner">
            <div className="mt-3 d-grid gap-3">
              <Card className="border">
                <Card.Body>
                  <h3 className="h6 mb-3">Mark Attendance</h3>
                  <p className="text-muted small mb-3">
                    Scan ticket QR payload, upload QR image, or enter ticket id. Duplicate scans are handled safely.
                  </p>

                  <Row className="g-2 align-items-end">
                    <Col lg={8}>
                      <Form.Group controlId="attendance-ticket-id-input">
                        <Form.Label>Ticket ID</Form.Label>
                        <Form.Control
                          placeholder="TKT-..."
                          value={attendanceTicketIdInput}
                          onChange={(currentEvent) =>
                            setAttendanceTicketIdInput(currentEvent.target.value)
                          }
                        />
                      </Form.Group>
                    </Col>
                    <Col lg={4}>
                      <Button
                        className="w-100"
                        variant="outline-primary"
                        disabled={markingAttendance}
                        onClick={() => {
                          void markAttendanceByTicketId();
                        }}
                      >
                        Mark by Ticket ID
                      </Button>
                    </Col>
                  </Row>

                  <hr />

                  <Row className="g-2">
                    <Col lg={8}>
                      <Form.Group controlId="attendance-qr-payload-input">
                        <Form.Label>QR Payload</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={4}
                          placeholder='{"ticketId":"TKT-...","eventId":"...","userId":"...","participationId":"..."}'
                          value={attendanceQrPayloadInput}
                          onChange={(currentEvent) =>
                            setAttendanceQrPayloadInput(currentEvent.target.value)
                          }
                        />
                      </Form.Group>
                      <Form.Group controlId="attendance-qr-image-input" className="mt-2">
                        <Form.Label>QR Image Upload</Form.Label>
                        <Form.Control
                          type="file"
                          accept="image/*"
                          onChange={(currentEvent) => {
                            const fileInput = currentEvent.target as HTMLInputElement;
                            const file = fileInput.files?.[0] ?? null;
                            setAttendanceQrImage(file);
                          }}
                        />
                      </Form.Group>
                    </Col>
                    <Col lg={4} className="d-grid gap-2">
                      <Button
                        variant="outline-dark"
                        disabled={extractingQrFromImage}
                        onClick={() => {
                          void extractQrPayloadFromImage();
                        }}
                      >
                        {extractingQrFromImage
                          ? "Extracting..."
                          : "Extract QR from Image"}
                      </Button>
                      <Button
                        variant="outline-success"
                        disabled={markingAttendance}
                        onClick={() => {
                          void markAttendanceByQrPayload();
                        }}
                      >
                        Mark by QR Payload
                      </Button>
                      <Button
                        variant={cameraActive ? "outline-danger" : "outline-secondary"}
                        onClick={() => {
                          if (cameraActive) {
                            stopCameraScanner();
                            return;
                          }
                          void startCameraScanner();
                        }}
                        disabled={!scannerSupported}
                      >
                        {cameraActive ? "Stop Camera Scanner" : "Start Camera Scanner"}
                      </Button>
                      {!scannerSupported ? (
                        <div className="small text-muted">
                          Browser does not support camera QR detection. Use image upload, ticket id, or pasted payload.
                        </div>
                      ) : null}
                    </Col>
                  </Row>

                  {scannerError ? <Alert variant="warning" className="mt-3 mb-0">{scannerError}</Alert> : null}

                  {cameraActive ? (
                    <div className="mt-3">
                      <video
                        ref={scannerVideoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{ width: "100%", maxWidth: "560px", border: "1px solid #ced4da" }}
                      />
                    </div>
                  ) : null}
                </Card.Body>
              </Card>

              <Card className="border">
                <Card.Body>
                  <h3 className="h6 mb-2">Attendance Audit Trail</h3>
                  <p className="text-muted small mb-3">
                    Manual overrides and successful scan-based attendance updates are logged here.
                  </p>

                  {attendanceAuditTrail.length === 0 ? (
                    <div className="text-muted small">No attendance audit entries yet.</div>
                  ) : (
                    <div className="d-grid gap-2">
                      {attendanceAuditTrail.map((entry) => (
                        <Card className="bg-light border" key={entry.id}>
                          <Card.Body className="py-2 small">
                            <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
                              <div>
                                <strong>{entry.participantName}</strong>
                                <div className="text-muted">{formatAttendanceAuditAction(entry.action)}</div>
                              </div>
                              <div className="text-muted">{formatDate(entry.createdAt)}</div>
                            </div>
                            <div>
                              <strong>State:</strong>{" "}
                              {entry.previousIsPresent ? "present" : "absent"} {"->"}{" "}
                              {entry.nextIsPresent ? "present" : "absent"}
                            </div>
                            {entry.reason ? (
                              <div>
                                <strong>Reason:</strong> {entry.reason}
                              </div>
                            ) : null}
                            <div>
                              <strong>By:</strong>{" "}
                              {entry.actorOrganizerName ?? entry.actorOrganizerId}
                            </div>
                          </Card.Body>
                        </Card>
                      ))}
                    </div>
                  )}
                </Card.Body>
              </Card>
            </div>
          </Tab>

          <Tab eventKey="merch-orders" title={`Merch Orders (${merchOrders.length})`}>
            <div className="mt-3 d-grid gap-3">
              {event.type !== "MERCH" ? (
                <Card className="border">
                  <Card.Body className="text-muted">
                    Merch payment workflow is only available for MERCH events.
                  </Card.Body>
                </Card>
              ) : merchOrders.length === 0 ? (
                <Card className="border">
                  <Card.Body className="text-muted">No merch orders yet.</Card.Body>
                </Card>
              ) : (
                merchOrders.map((order) => {
                  const busy = resolvingPaymentId === order.id;

                  return (
                    <Card className="border" key={`merch-order-${order.id}`}>
                      <Card.Body>
                        <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
                          <div>
                            <h3 className="h6 mb-1">{order.participant.name}</h3>
                            <div className="small text-muted mb-1">
                              {order.participant.email ?? "email unavailable"}
                            </div>
                            <div className="small text-muted">
                              <strong>Order:</strong> {order.merchPurchase?.label} x
                              {order.merchPurchase?.quantity}
                            </div>
                            <div className="small text-muted">
                              <strong>Amount:</strong>{" "}
                              {order.payment ? formatCurrency(order.payment.amount) : "-"}
                            </div>
                            <div className="small text-muted">
                              <strong>Payment:</strong> {order.payment?.status ?? "-"} (
                              {order.payment?.method ?? "-"})
                            </div>
                            <div className="small text-muted">
                              <strong>Ticket:</strong> {order.ticketId ?? "not issued"}
                            </div>
                          </div>

                          <div className="d-flex flex-column gap-2 align-items-end">
                            {order.payment?.proofUrl ? (
                              <a
                                className="btn btn-outline-secondary btn-sm"
                                href={order.payment.proofUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                View Proof
                              </a>
                            ) : null}
                            {order.payment?.status === "pending" ? (
                              <div className="d-flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline-success"
                                  disabled={busy}
                                  onClick={() => {
                                    void resolveMerchPayment(order.id, "approve");
                                  }}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline-danger"
                                  disabled={busy}
                                  onClick={() => {
                                    void resolveMerchPayment(order.id, "reject");
                                  }}
                                >
                                  Reject
                                </Button>
                              </div>
                            ) : (
                              <Badge bg={statusBadgeVariant(order.payment?.status ?? "pending")}>
                                {order.payment?.status ?? "pending"}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </Card.Body>
                    </Card>
                  );
                })
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
