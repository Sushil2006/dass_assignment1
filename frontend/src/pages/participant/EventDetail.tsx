import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Col, Container, Form, Row, Spinner, Stack } from "react-bootstrap";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../../lib/api";

type EventType = "NORMAL" | "MERCH";
type ParticipationStatus = "pending" | "confirmed" | "cancelled" | "rejected";

type NormalFieldType = "text" | "textarea" | "number" | "select" | "checkbox" | "file";

type NormalField = {
  key: string;
  label: string;
  type: NormalFieldType;
  required: boolean;
  options?: string[];
  order: number;
};

type NormalForm = {
  fields: NormalField[];
  isFormLocked: boolean;
};

type MerchVariant = {
  sku: string;
  label: string;
  stock: number;
  priceDelta?: number;
};

type MerchConfig = {
  variants: MerchVariant[];
  perParticipantLimit: number;
  totalStock: number;
};

type ParticipantEvent = {
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
  organizerId: string;
  status: string;
  displayStatus?: string;
  canRegister?: boolean;
  normalForm?: NormalForm;
  merchConfig?: MerchConfig;
};

type ParticipantParticipation = {
  id: string;
  status: ParticipationStatus;
  ticketId: string | null;
  eventType: EventType;
};

type EventDetailResponse = {
  event?: ParticipantEvent;
  myParticipation?: ParticipantParticipation | null;
};

type ParticipationCreateResponse = {
  participation?: { id: string; status: ParticipationStatus };
  ticket?: { id: string };
  payment?: { status: "pending" | "approved" | "rejected" };
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

function formatCalendarUtc(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function googleCalendarLink(params: {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  reminderMinutes: number;
}): string {
  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", params.title);
  url.searchParams.set(
    "details",
    `${params.description}\n\nReminder: ${params.reminderMinutes} minutes before`,
  );
  url.searchParams.set(
    "dates",
    `${formatCalendarUtc(params.startDate)}/${formatCalendarUtc(params.endDate)}`,
  );
  return url.toString();
}

function outlookCalendarLink(params: {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  reminderMinutes: number;
}): string {
  const url = new URL("https://outlook.live.com/calendar/0/deeplink/compose");
  url.searchParams.set("path", "/calendar/action/compose");
  url.searchParams.set("rru", "addevent");
  url.searchParams.set("subject", params.title);
  url.searchParams.set(
    "body",
    `${params.description}\n\nReminder: ${params.reminderMinutes} minutes before`,
  );
  url.searchParams.set("startdt", new Date(params.startDate).toISOString());
  url.searchParams.set("enddt", new Date(params.endDate).toISOString());
  return url.toString();
}

function isActiveParticipation(status: ParticipationStatus | undefined): boolean {
  if (!status) return false;
  return status !== "cancelled" && status !== "rejected";
}

export default function EventDetail() {
  const { eventId = "" } = useParams<{ eventId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [detail, setDetail] = useState<EventDetailResponse | null>(null);
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null);

  const [submittingRegister, setSubmittingRegister] = useState(false);
  const [submittingPurchase, setSubmittingPurchase] = useState(false);
  const [downloadingCalendar, setDownloadingCalendar] = useState(false);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checkboxAnswers, setCheckboxAnswers] = useState<Record<string, string[]>>({});
  const [fileAnswers, setFileAnswers] = useState<Record<string, File | null>>({});

  const [selectedSku, setSelectedSku] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState<
    "upi" | "bank_transfer" | "cash" | "card" | "other"
  >("upi");
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [calendarReminderMinutes, setCalendarReminderMinutes] = useState("30");

  const event = detail?.event;
  const participation = detail?.myParticipation ?? null;
  const hasActiveParticipation = isActiveParticipation(participation?.status);
  const showExistingParticipationAlert = hasActiveParticipation && participation && !success;

  const sortedNormalFields = useMemo(() => {
    if (!event?.normalForm?.fields) return [];
    return [...event.normalForm.fields].sort((a, b) => a.order - b.order);
  }, [event?.normalForm?.fields]);

  const loadEvent = useCallback(async () => {
    if (!eventId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch(`/api/participants/me/events/${eventId}`);
      if (!res.ok) throw new Error(await readErrorMessage(res));

      const data = (await res.json()) as EventDetailResponse;
      setDetail(data);

      if (data.event?.type === "MERCH") {
        const firstVariant = data.event.merchConfig?.variants[0];
        setSelectedSku(firstVariant?.sku ?? "");
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load event");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void loadEvent();
  }, [loadEvent]);

  async function submitNormalRegistration(eventForm: React.FormEvent<HTMLFormElement>) {
    eventForm.preventDefault();
    if (!event) return;

    setSubmittingRegister(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append("eventId", event.id);

      const payload: Record<string, unknown> = { ...answers };
      for (const [key, value] of Object.entries(checkboxAnswers)) {
        payload[key] = value;
      }

      formData.append("answers", JSON.stringify(payload));
      for (const [key, file] of Object.entries(fileAnswers)) {
        if (file) formData.append(key, file);
      }

      const res = await apiFetch("/api/participations/register", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));

      const data = (await res.json()) as ParticipationCreateResponse;
      setCreatedTicketId(data.ticket?.id ?? null);
      setSuccess("Registration submitted and ticket generated.");
      await loadEvent();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to register");
    } finally {
      setSubmittingRegister(false);
    }
  }

  async function submitMerchPurchase(eventForm: React.FormEvent<HTMLFormElement>) {
    eventForm.preventDefault();
    if (!event) return;
    if (!paymentProof) {
      setError("Payment proof image is required.");
      return;
    }

    setSubmittingPurchase(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append("eventId", event.id);
      formData.append("sku", selectedSku);
      formData.append("quantity", quantity);
      formData.append("method", paymentMethod);
      formData.append("paymentProof", paymentProof);

      const res = await apiFetch("/api/participations/purchase", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));

      const data = (await res.json()) as ParticipationCreateResponse;
      setCreatedTicketId(data.ticket?.id ?? null);
      if (data.ticket?.id) {
        setSuccess("Purchase approved and ticket generated.");
      } else {
        setSuccess("Purchase submitted for organizer approval.");
      }
      setPaymentProof(null);
      await loadEvent();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to purchase");
    } finally {
      setSubmittingPurchase(false);
    }
  }

  async function downloadEventCalendar() {
    if (!event || !participation?.id) return;

    setDownloadingCalendar(true);
    setError(null);

    try {
      const reminderMinutes = Number(calendarReminderMinutes) || 30;
      const res = await apiFetch(
        `/api/participants/me/calendar/${event.id}.ics?reminderMinutes=${reminderMinutes}`,
      );
      if (!res.ok) throw new Error(await readErrorMessage(res));

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${event.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "event"}.ics`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error ? downloadError.message : "Failed to download calendar file",
      );
    } finally {
      setDownloadingCalendar(false);
    }
  }

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h1 className="h3 mb-1">Event Detail</h1>
          <p className="text-muted mb-0">Review full details and complete register/purchase flow.</p>
        </div>
        <Stack direction="horizontal" gap={2}>
          <Link className="btn btn-outline-secondary" to="/participant/events">
            Back to Browse
          </Link>
          <Link className="btn btn-outline-dark" to="/participant/my-events">
            My Events
          </Link>
        </Stack>
      </div>

      {error ? <Alert variant="danger">{error}</Alert> : null}
      {success ? <Alert variant="success">{success}</Alert> : null}
      {createdTicketId ? (
        <Alert variant="info">
          Ticket generated:{" "}
          <Link to={`/participant/tickets/${createdTicketId}`}>{createdTicketId}</Link>
        </Alert>
      ) : null}

      {loading ? (
        <div className="d-flex align-items-center gap-2">
          <Spinner animation="border" size="sm" />
          <span>Loading event detail...</span>
        </div>
      ) : !event ? (
        <Card className="border">
          <Card.Body className="text-muted">Event not available.</Card.Body>
        </Card>
      ) : (
        <>
          <Card className="border mb-3">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
                <div>
                  <h2 className="h4 mb-1">{event.name}</h2>
                  <div className="text-muted">{event.description}</div>
                </div>
                <div className="text-end small">
                  <div>
                    <strong>Type:</strong> {event.type}
                  </div>
                  <div>
                    <strong>Status:</strong> {event.displayStatus ?? event.status}
                  </div>
                </div>
              </div>

              <Row className="small text-muted">
                <Col md={6}>
                  <div>
                    <strong>Starts:</strong> {formatDate(event.startDate)}
                  </div>
                  <div>
                    <strong>Ends:</strong> {formatDate(event.endDate)}
                  </div>
                </Col>
                <Col md={6}>
                  <div>
                    <strong>Registration Deadline:</strong> {formatDate(event.regDeadline)}
                  </div>
                  <div>
                    <strong>Fee:</strong> {event.regFee}
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {showExistingParticipationAlert ? (
            <Alert variant="info">
              You already have an active participation ({participation.status}).{" "}
              {participation.ticketId ? (
                <Link to={`/participant/tickets/${participation.ticketId}`}>Open Ticket</Link>
              ) : (
                <span>Ticket will be issued after payment approval.</span>
              )}
            </Alert>
          ) : null}

          {hasActiveParticipation ? (
            <Card className="border mb-3">
              <Card.Body>
                <Card.Title className="h6 mb-3">Add To Calendar</Card.Title>
                <Row className="g-3 align-items-end">
                  <Col md={4}>
                    <Form.Group controlId="calendar-reminder">
                      <Form.Label>Reminder</Form.Label>
                      <Form.Select
                        value={calendarReminderMinutes}
                        onChange={(currentEvent) =>
                          setCalendarReminderMinutes(currentEvent.target.value)
                        }
                      >
                        <option value="10">10 minutes before</option>
                        <option value="30">30 minutes before</option>
                        <option value="60">1 hour before</option>
                        <option value="1440">1 day before</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={8} className="d-flex gap-2 flex-wrap">
                    <Button
                      variant="outline-primary"
                      disabled={downloadingCalendar}
                      onClick={() => {
                        void downloadEventCalendar();
                      }}
                    >
                      {downloadingCalendar ? "Downloading..." : "Download .ics"}
                    </Button>
                    <Button
                      as="a"
                      href={googleCalendarLink({
                        title: event.name,
                        description: event.description,
                        startDate: event.startDate,
                        endDate: event.endDate,
                        reminderMinutes: Number(calendarReminderMinutes) || 30,
                      })}
                      target="_blank"
                      rel="noreferrer"
                      variant="outline-success"
                    >
                      Open Google Calendar
                    </Button>
                    <Button
                      as="a"
                      href={outlookCalendarLink({
                        title: event.name,
                        description: event.description,
                        startDate: event.startDate,
                        endDate: event.endDate,
                        reminderMinutes: Number(calendarReminderMinutes) || 30,
                      })}
                      target="_blank"
                      rel="noreferrer"
                      variant="outline-secondary"
                    >
                      Open Outlook
                    </Button>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          ) : null}

          {!hasActiveParticipation && event.canRegister === false ? (
            <Alert variant="warning">Participation is currently unavailable for this event.</Alert>
          ) : null}

          {!hasActiveParticipation && event.canRegister !== false && event.type === "NORMAL" ? (
            <Card className="border">
              <Card.Body>
                <Card.Title className="h5 mb-3">Register</Card.Title>
                <Form onSubmit={submitNormalRegistration}>
                  <Row className="g-3">
                    {sortedNormalFields.map((field) => (
                      <Col key={field.key} xs={12}>
                        <Form.Group controlId={`field-${field.key}`}>
                          <Form.Label>
                            {field.label}
                            {field.required ? " *" : ""}
                          </Form.Label>

                          {field.type === "text" ? (
                            <Form.Control
                              value={answers[field.key] ?? ""}
                              onChange={(currentEvent) =>
                                setAnswers((prev) => ({
                                  ...prev,
                                  [field.key]: currentEvent.target.value,
                                }))
                              }
                              required={field.required}
                            />
                          ) : null}

                          {field.type === "textarea" ? (
                            <Form.Control
                              as="textarea"
                              rows={3}
                              value={answers[field.key] ?? ""}
                              onChange={(currentEvent) =>
                                setAnswers((prev) => ({
                                  ...prev,
                                  [field.key]: currentEvent.target.value,
                                }))
                              }
                              required={field.required}
                            />
                          ) : null}

                          {field.type === "number" ? (
                            <Form.Control
                              type="number"
                              value={answers[field.key] ?? ""}
                              onChange={(currentEvent) =>
                                setAnswers((prev) => ({
                                  ...prev,
                                  [field.key]: currentEvent.target.value,
                                }))
                              }
                              required={field.required}
                            />
                          ) : null}

                          {field.type === "select" ? (
                            <Form.Select
                              value={answers[field.key] ?? ""}
                              onChange={(currentEvent) =>
                                setAnswers((prev) => ({
                                  ...prev,
                                  [field.key]: currentEvent.target.value,
                                }))
                              }
                              required={field.required}
                            >
                              <option value="">Select option</option>
                              {(field.options ?? []).map((option) => (
                                <option key={`${field.key}-${option}`} value={option}>
                                  {option}
                                </option>
                              ))}
                            </Form.Select>
                          ) : null}

                          {field.type === "checkbox" ? (
                            <div>
                              {(field.options ?? []).map((option) => {
                                const selected = checkboxAnswers[field.key] ?? [];
                                const checked = selected.includes(option);

                                return (
                                  <Form.Check
                                    key={`${field.key}-${option}`}
                                    type="checkbox"
                                    label={option}
                                    checked={checked}
                                    onChange={(currentEvent) => {
                                      setCheckboxAnswers((prev) => {
                                        const existing = prev[field.key] ?? [];
                                        if (currentEvent.target.checked) {
                                          return {
                                            ...prev,
                                            [field.key]: [...existing, option],
                                          };
                                        }
                                        return {
                                          ...prev,
                                          [field.key]: existing.filter((item) => item !== option),
                                        };
                                      });
                                    }}
                                  />
                                );
                              })}
                            </div>
                          ) : null}

                          {field.type === "file" ? (
                            <Form.Control
                              type="file"
                              required={field.required}
                              onChange={(currentEvent) => {
                                const input = currentEvent.target as HTMLInputElement;
                                setFileAnswers((prev) => ({
                                  ...prev,
                                  [field.key]: input.files?.[0] ?? null,
                                }));
                              }}
                            />
                          ) : null}
                        </Form.Group>
                      </Col>
                    ))}
                  </Row>
                  <div className="mt-3">
                    <Button type="submit" disabled={submittingRegister}>
                      {submittingRegister ? "Submitting..." : "Register"}
                    </Button>
                  </div>
                </Form>
              </Card.Body>
            </Card>
          ) : null}

          {!hasActiveParticipation && event.canRegister !== false && event.type === "MERCH" ? (
            <Card className="border">
              <Card.Body>
                <Card.Title className="h5 mb-3">Purchase</Card.Title>
                <Form onSubmit={submitMerchPurchase}>
                  <Row className="g-3">
                    <Col md={8}>
                      <Form.Group controlId="merch-sku">
                        <Form.Label>Variant</Form.Label>
                        <Form.Select
                          value={selectedSku}
                          onChange={(currentEvent) => setSelectedSku(currentEvent.target.value)}
                          required
                        >
                          {(event.merchConfig?.variants ?? []).map((variant) => (
                            <option key={variant.sku} value={variant.sku}>
                              {variant.label} (stock: {variant.stock})
                            </option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group controlId="merch-qty">
                        <Form.Label>Quantity</Form.Label>
                        <Form.Control
                          type="number"
                          min={1}
                          max={event.merchConfig?.perParticipantLimit ?? 1}
                          value={quantity}
                          onChange={(currentEvent) => setQuantity(currentEvent.target.value)}
                          required
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group controlId="merch-payment-method">
                        <Form.Label>Payment Method</Form.Label>
                        <Form.Select
                          value={paymentMethod}
                          onChange={(currentEvent) =>
                            setPaymentMethod(
                              currentEvent.target.value as
                                | "upi"
                                | "bank_transfer"
                                | "cash"
                                | "card"
                                | "other",
                            )
                          }
                        >
                          <option value="upi">UPI</option>
                          <option value="bank_transfer">Bank Transfer</option>
                          <option value="cash">Cash</option>
                          <option value="card">Card</option>
                          <option value="other">Other</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group controlId="merch-payment-proof">
                        <Form.Label>Payment Proof (image)</Form.Label>
                        <Form.Control
                          type="file"
                          accept="image/*"
                          required
                          onChange={(currentEvent) => {
                            const input = currentEvent.target as HTMLInputElement;
                            setPaymentProof(input.files?.[0] ?? null);
                          }}
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                  <div className="mt-3">
                    <Button type="submit" disabled={submittingPurchase}>
                      {submittingPurchase ? "Submitting..." : "Purchase"}
                    </Button>
                  </div>
                </Form>
              </Card.Body>
            </Card>
          ) : null}
        </>
      )}
    </Container>
  );
}
