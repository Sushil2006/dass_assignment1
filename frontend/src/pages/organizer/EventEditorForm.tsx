import { useMemo, useState } from "react";
import { Alert, Button, Col, Form, Row } from "react-bootstrap";

export type EventType = "NORMAL" | "MERCH";

export type NormalFormFieldType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "checkbox"
  | "file";

export type NormalFormField = {
  key: string;
  label: string;
  type: NormalFormFieldType;
  required: boolean;
  order: number;
  options?: string[];
};

export type NormalFormConfig = {
  fields: NormalFormField[];
  isFormLocked: boolean;
};

export type MerchVariantConfig = {
  sku: string;
  label: string;
  stock: number;
  priceDelta?: number;
};

export type MerchConfig = {
  variants: MerchVariantConfig[];
  perParticipantLimit: number;
};

export type EventEditorValues = {
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
  normalForm?: NormalFormConfig;
  merchConfig?: MerchConfig;
};

type EventEditorFormProps = {
  initialValues?: Partial<EventEditorValues>;
  submitLabel?: string;
  busy?: boolean;
  onSubmit: (values: EventEditorValues) => Promise<void> | void;
};

const defaultNormalFormConfig: NormalFormConfig = {
  fields: [
    {
      key: "fullName",
      label: "Full Name",
      type: "text",
      required: true,
      order: 0,
    },
  ],
  isFormLocked: false,
};

const defaultMerchConfig: MerchConfig = {
  variants: [
    {
      sku: "TSHIRT-BLACK-M",
      label: "Black Tee - M",
      stock: 25,
      priceDelta: 0,
    },
  ],
  perParticipantLimit: 1,
};

function toDateTimeLocalValue(rawValue?: string): string {
  if (!rawValue) return "";

  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) return "";

  const adjusted = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 16);
}

export default function EventEditorForm({
  initialValues,
  submitLabel = "Save Event",
  busy = false,
  onSubmit,
}: EventEditorFormProps) {
  // keep core event fields in local form state
  const [name, setName] = useState(initialValues?.name ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [type, setType] = useState<EventType>(initialValues?.type ?? "NORMAL");
  const [tagsText, setTagsText] = useState((initialValues?.tags ?? []).join(", "));
  const [eligibility, setEligibility] = useState(initialValues?.eligibility ?? "all");
  const [regFee, setRegFee] = useState(String(initialValues?.regFee ?? 0));
  const [regLimit, setRegLimit] = useState(String(initialValues?.regLimit ?? 1));
  const [regDeadline, setRegDeadline] = useState(
    toDateTimeLocalValue(initialValues?.regDeadline),
  );
  const [startDate, setStartDate] = useState(
    toDateTimeLocalValue(initialValues?.startDate),
  );
  const [endDate, setEndDate] = useState(toDateTimeLocalValue(initialValues?.endDate));

  // keep nested configs editable as json text for quick iteration
  const [normalFormText, setNormalFormText] = useState(
    JSON.stringify(initialValues?.normalForm ?? defaultNormalFormConfig, null, 2),
  );
  const [merchConfigText, setMerchConfigText] = useState(
    JSON.stringify(initialValues?.merchConfig ?? defaultMerchConfig, null, 2),
  );

  const [error, setError] = useState<string | null>(null);

  const currentConfigHint = useMemo(() => {
    if (type === "NORMAL") {
      return "normalForm must define fields[] and isFormLocked";
    }

    return "merchConfig must define variants[] and perParticipantLimit";
  }, [type]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsedFee = Number(regFee);
    const parsedLimit = Number(regLimit);

    if (Number.isNaN(parsedFee) || parsedFee < 0) {
      setError("Registration fee must be a valid non-negative number.");
      return;
    }

    if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
      setError("Registration limit must be an integer greater than 0.");
      return;
    }

    if (!regDeadline || !startDate || !endDate) {
      setError("Please provide registration deadline, start date, and end date.");
      return;
    }

    let normalForm: NormalFormConfig | undefined;
    let merchConfig: MerchConfig | undefined;

    // parse only the type-specific config that will be sent
    try {
      if (type === "NORMAL") {
        normalForm = JSON.parse(normalFormText) as NormalFormConfig;
      }

      if (type === "MERCH") {
        merchConfig = JSON.parse(merchConfigText) as MerchConfig;
      }
    } catch {
      setError("Invalid JSON in type-specific config.");
      return;
    }

    const values: EventEditorValues = {
      name: name.trim(),
      description: description.trim(),
      type,
      tags: tagsText
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
      eligibility: eligibility.trim() || "all",
      regFee: parsedFee,
      regLimit: parsedLimit,
      regDeadline,
      startDate,
      endDate,
      normalForm,
      merchConfig,
    };

    await onSubmit(values);
  }

  return (
    <Form onSubmit={handleSubmit}>
      {error ? <Alert variant="danger">{error}</Alert> : null}

      <Row className="g-3">
        <Col md={8}>
          <Form.Group controlId="event-name">
            <Form.Label>Event Name</Form.Label>
            <Form.Control
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. AI Workshop 2026"
              required
            />
          </Form.Group>
        </Col>

        <Col md={4}>
          <Form.Group controlId="event-type">
            <Form.Label>Type</Form.Label>
            <Form.Select
              value={type}
              onChange={(event) => setType(event.target.value as EventType)}
            >
              <option value="NORMAL">NORMAL</option>
              <option value="MERCH">MERCH</option>
            </Form.Select>
          </Form.Group>
        </Col>

        <Col xs={12}>
          <Form.Group controlId="event-description">
            <Form.Label>Description</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              required
            />
          </Form.Group>
        </Col>

        <Col md={6}>
          <Form.Group controlId="event-tags">
            <Form.Label>Tags (comma separated)</Form.Label>
            <Form.Control
              value={tagsText}
              onChange={(event) => setTagsText(event.target.value)}
              placeholder="tech, workshop, beginner"
            />
          </Form.Group>
        </Col>

        <Col md={6}>
          <Form.Group controlId="event-eligibility">
            <Form.Label>Eligibility</Form.Label>
            <Form.Control
              value={eligibility}
              onChange={(event) => setEligibility(event.target.value)}
              placeholder="all / iiit / non-iiit"
              required
            />
          </Form.Group>
        </Col>

        <Col md={3}>
          <Form.Group controlId="event-fee">
            <Form.Label>Reg Fee</Form.Label>
            <Form.Control
              type="number"
              min={0}
              step="0.01"
              value={regFee}
              onChange={(event) => setRegFee(event.target.value)}
              required
            />
          </Form.Group>
        </Col>

        <Col md={3}>
          <Form.Group controlId="event-limit">
            <Form.Label>Reg Limit</Form.Label>
            <Form.Control
              type="number"
              min={1}
              step={1}
              value={regLimit}
              onChange={(event) => setRegLimit(event.target.value)}
              required
            />
          </Form.Group>
        </Col>

        <Col md={6}>
          <Form.Group controlId="event-reg-deadline">
            <Form.Label>Registration Deadline</Form.Label>
            <Form.Control
              type="datetime-local"
              value={regDeadline}
              onChange={(event) => setRegDeadline(event.target.value)}
              required
            />
          </Form.Group>
        </Col>

        <Col md={6}>
          <Form.Group controlId="event-start-date">
            <Form.Label>Start Date</Form.Label>
            <Form.Control
              type="datetime-local"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              required
            />
          </Form.Group>
        </Col>

        <Col md={6}>
          <Form.Group controlId="event-end-date">
            <Form.Label>End Date</Form.Label>
            <Form.Control
              type="datetime-local"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              required
            />
          </Form.Group>
        </Col>

        <Col xs={12}>
          <Form.Group controlId="event-type-config">
            <Form.Label>{type === "NORMAL" ? "Normal Form JSON" : "Merch Config JSON"}</Form.Label>
            <Form.Text className="d-block mb-2 text-muted">{currentConfigHint}</Form.Text>
            <Form.Control
              as="textarea"
              rows={10}
              value={type === "NORMAL" ? normalFormText : merchConfigText}
              onChange={(event) => {
                if (type === "NORMAL") {
                  setNormalFormText(event.target.value);
                  return;
                }

                setMerchConfigText(event.target.value);
              }}
              required
            />
          </Form.Group>
        </Col>
      </Row>

      <div className="mt-3 d-flex justify-content-end">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving..." : submitLabel}
        </Button>
      </div>
    </Form>
  );
}
