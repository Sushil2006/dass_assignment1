import { useState } from "react";
import { Alert, Button, Card, Col, Form, Row } from "react-bootstrap";

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
  editPolicy?: "full" | "published-limited";
  onSubmit: (values: EventEditorValues) => Promise<void> | void;
};

type NormalFieldDraft = {
  uiId: string;
  key: string;
  label: string;
  type: NormalFormFieldType;
  required: boolean;
  optionsText: string;
};

type MerchVariantDraft = {
  uiId: string;
  sku: string;
  label: string;
  stock: string;
  priceDelta: string;
};

const normalFieldTypes: NormalFormFieldType[] = [
  "text",
  "textarea",
  "number",
  "select",
  "checkbox",
  "file",
];

function createUiId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function toDateTimeLocalValue(rawValue?: string): string {
  if (!rawValue) return "";

  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) return "";

  const adjusted = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 16);
}

function buildInitialNormalFields(
  initialValues?: Partial<EventEditorValues>,
): NormalFieldDraft[] {
  const source = initialValues?.normalForm?.fields;

  if (!source || source.length === 0) {
    return [
      {
        uiId: createUiId("normal-field"),
        key: "fullName",
        label: "Full Name",
        type: "text",
        required: true,
        optionsText: "",
      },
    ];
  }

  return source
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((field) => ({
      uiId: createUiId("normal-field"),
      key: field.key,
      label: field.label,
      type: field.type,
      required: field.required,
      optionsText: field.options?.join(", ") ?? "",
    }));
}

function buildInitialMerchVariants(
  initialValues?: Partial<EventEditorValues>,
): MerchVariantDraft[] {
  const source = initialValues?.merchConfig?.variants;

  if (!source || source.length === 0) {
    return [
      {
        uiId: createUiId("merch-variant"),
        sku: "TSHIRT-BLACK-M",
        label: "Black Tee - M",
        stock: "25",
        priceDelta: "0",
      },
    ];
  }

  return source.map((variant) => ({
    uiId: createUiId("merch-variant"),
    sku: variant.sku,
    label: variant.label,
    stock: String(variant.stock),
    priceDelta:
      typeof variant.priceDelta === "number" ? String(variant.priceDelta) : "",
  }));
}

export default function EventEditorForm({
  initialValues,
  submitLabel = "Save Event",
  busy = false,
  editPolicy = "full",
  onSubmit,
}: EventEditorFormProps) {
  const isPublishedLimited = editPolicy === "published-limited";
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

  const [normalFields, setNormalFields] = useState<NormalFieldDraft[]>(
    buildInitialNormalFields(initialValues),
  );
  const [isFormLocked] = useState(
    initialValues?.normalForm?.isFormLocked ?? true,
  );

  const [merchVariants, setMerchVariants] = useState<MerchVariantDraft[]>(
    buildInitialMerchVariants(initialValues),
  );
  const [perParticipantLimit, setPerParticipantLimit] = useState(
    String(initialValues?.merchConfig?.perParticipantLimit ?? 1),
  );

  const [error, setError] = useState<string | null>(null);

  function updateNormalField(index: number, patch: Partial<NormalFieldDraft>) {
    setNormalFields((prev) =>
      prev.map((field, fieldIndex) =>
        fieldIndex === index ? { ...field, ...patch } : field,
      ),
    );
  }

  function removeNormalField(index: number) {
    setNormalFields((prev) => prev.filter((_, fieldIndex) => fieldIndex !== index));
  }

  function addNormalField() {
    setNormalFields((prev) => [
      ...prev,
      {
        uiId: createUiId("normal-field"),
        key: `field_${prev.length + 1}`,
        label: "",
        type: "text",
        required: false,
        optionsText: "",
      },
    ]);
  }

  function updateMerchVariant(index: number, patch: Partial<MerchVariantDraft>) {
    setMerchVariants((prev) =>
      prev.map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, ...patch } : variant,
      ),
    );
  }

  function removeMerchVariant(index: number) {
    setMerchVariants((prev) =>
      prev.filter((_, variantIndex) => variantIndex !== index),
    );
  }

  function addMerchVariant() {
    setMerchVariants((prev) => [
      ...prev,
      {
        uiId: createUiId("merch-variant"),
        sku: "",
        label: "",
        stock: "0",
        priceDelta: "",
      },
    ]);
  }

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

    if (type === "NORMAL") {
      if (normalFields.length === 0) {
        setError("Add at least one form field for a NORMAL event.");
        return;
      }

      const builtFields: NormalFormField[] = [];

      for (let index = 0; index < normalFields.length; index += 1) {
        const field = normalFields[index];
        const key = field.key.trim();
        const label = field.label.trim();

        if (!key || !label) {
          setError("Each normal form field needs a key and label.");
          return;
        }

        const needsOptions = field.type === "select" || field.type === "checkbox";
        const options = field.optionsText
          .split(",")
          .map((option) => option.trim())
          .filter((option) => option.length > 0);

        if (needsOptions && options.length === 0) {
          setError("Select/checkbox fields need at least one option.");
          return;
        }

        builtFields.push({
          key,
          label,
          type: field.type,
          required: field.required,
          order: index,
          options: needsOptions ? options : undefined,
        });
      }

      normalForm = {
        fields: builtFields,
        isFormLocked,
      };
    }

    if (type === "MERCH") {
      const parsedPerParticipantLimit = Number(perParticipantLimit);
      if (
        !Number.isInteger(parsedPerParticipantLimit) ||
        parsedPerParticipantLimit < 1
      ) {
        setError("Per participant limit must be an integer greater than 0.");
        return;
      }

      if (merchVariants.length === 0) {
        setError("Add at least one merch variant for a MERCH event.");
        return;
      }

      const builtVariants: MerchVariantConfig[] = [];

      for (const variant of merchVariants) {
        const sku = variant.sku.trim();
        const label = variant.label.trim();
        const stock = Number(variant.stock);

        if (!sku || !label) {
          setError("Each merch variant needs SKU and label.");
          return;
        }

        if (!Number.isInteger(stock) || stock < 0) {
          setError("Variant stock must be an integer 0 or higher.");
          return;
        }

        let parsedPriceDelta: number | undefined;
        if (variant.priceDelta.trim() !== "") {
          parsedPriceDelta = Number(variant.priceDelta);
          if (Number.isNaN(parsedPriceDelta)) {
            setError("Price delta must be a valid number when provided.");
            return;
          }
        }

        builtVariants.push({
          sku,
          label,
          stock,
          priceDelta: parsedPriceDelta,
        });
      }

      merchConfig = {
        variants: builtVariants,
        perParticipantLimit: parsedPerParticipantLimit,
      };
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
      {isPublishedLimited ? (
        <Alert variant="info">
          Published events only allow updating description, registration deadline
          (extension), and registration limit (increase).
        </Alert>
      ) : null}

      <Row className="g-3">
        <Col md={8}>
          <Form.Group controlId="event-name">
            <Form.Label>Event Name</Form.Label>
            <Form.Control
              value={name}
              onChange={(currentEvent) => setName(currentEvent.target.value)}
              placeholder="e.g. AI Workshop 2026"
              disabled={isPublishedLimited}
              required
            />
          </Form.Group>
        </Col>

        <Col md={4}>
          <Form.Group controlId="event-type">
            <Form.Label>Type</Form.Label>
            <Form.Select
              value={type}
              onChange={(currentEvent) =>
                setType(currentEvent.target.value as EventType)
              }
              disabled={isPublishedLimited}
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
              onChange={(currentEvent) => setDescription(currentEvent.target.value)}
              required
            />
          </Form.Group>
        </Col>

        <Col md={6}>
          <Form.Group controlId="event-tags">
            <Form.Label>Tags (comma separated)</Form.Label>
            <Form.Control
              value={tagsText}
              onChange={(currentEvent) => setTagsText(currentEvent.target.value)}
              placeholder="tech, workshop, beginner"
              disabled={isPublishedLimited}
            />
          </Form.Group>
        </Col>

        <Col md={6}>
          <Form.Group controlId="event-eligibility">
            <Form.Label>Eligibility</Form.Label>
            <Form.Control
              value={eligibility}
              onChange={(currentEvent) => setEligibility(currentEvent.target.value)}
              placeholder="all / iiit / non-iiit"
              disabled={isPublishedLimited}
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
              onChange={(currentEvent) => setRegFee(currentEvent.target.value)}
              disabled={isPublishedLimited}
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
              onChange={(currentEvent) => setRegLimit(currentEvent.target.value)}
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
              onChange={(currentEvent) => setRegDeadline(currentEvent.target.value)}
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
              onChange={(currentEvent) => setStartDate(currentEvent.target.value)}
              disabled={isPublishedLimited}
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
              onChange={(currentEvent) => setEndDate(currentEvent.target.value)}
              disabled={isPublishedLimited}
              required
            />
          </Form.Group>
        </Col>

        {type === "NORMAL" ? (
          <Col xs={12}>
            <Card className="border">
              <Card.Body>
                <Card.Title className="h6">Normal Event Form Builder</Card.Title>

                <Form.Check
                  className="mb-3"
                  type="switch"
                  id="normal-form-locked"
                  label="form auto-locks after first registration"
                  checked={isFormLocked}
                  disabled
                />

                {normalFields.map((field, index) => {
                  const needsOptions =
                    field.type === "select" || field.type === "checkbox";

                  return (
                    <Card key={field.uiId} className="mb-3 border">
                      <Card.Body>
                        <Row className="g-2 align-items-end">
                          <Col md={3}>
                            <Form.Group controlId={`normal-field-key-${index}`}>
                              <Form.Label>Field Key</Form.Label>
                              <Form.Control
                                value={field.key}
                                onChange={(currentEvent) =>
                                  updateNormalField(index, {
                                    key: currentEvent.target.value,
                                  })
                                }
                                disabled={isPublishedLimited}
                                required
                              />
                            </Form.Group>
                          </Col>

                          <Col md={3}>
                            <Form.Group controlId={`normal-field-label-${index}`}>
                              <Form.Label>Label</Form.Label>
                              <Form.Control
                                value={field.label}
                                onChange={(currentEvent) =>
                                  updateNormalField(index, {
                                    label: currentEvent.target.value,
                                  })
                                }
                                disabled={isPublishedLimited}
                                required
                              />
                            </Form.Group>
                          </Col>

                          <Col md={2}>
                            <Form.Group controlId={`normal-field-type-${index}`}>
                              <Form.Label>Type</Form.Label>
                              <Form.Select
                                value={field.type}
                                onChange={(currentEvent) =>
                                  updateNormalField(index, {
                                    type: currentEvent.target.value as NormalFormFieldType,
                                  })
                                }
                                disabled={isPublishedLimited}
                              >
                                {normalFieldTypes.map((fieldType) => (
                                  <option key={fieldType} value={fieldType}>
                                    {fieldType}
                                  </option>
                                ))}
                              </Form.Select>
                            </Form.Group>
                          </Col>

                          <Col md={2}>
                            <Form.Check
                              id={`normal-field-required-${index}`}
                              className="mt-4"
                              label="Required"
                              checked={field.required}
                              disabled={isPublishedLimited}
                              onChange={(currentEvent) =>
                                updateNormalField(index, {
                                  required: currentEvent.target.checked,
                                })
                              }
                            />
                          </Col>

                          <Col md={2} className="d-flex justify-content-end">
                            <Button
                              variant="outline-danger"
                              type="button"
                              disabled={isPublishedLimited || normalFields.length <= 1}
                              onClick={() => removeNormalField(index)}
                            >
                              Remove
                            </Button>
                          </Col>

                          {needsOptions ? (
                            <Col xs={12}>
                              <Form.Group controlId={`normal-field-options-${index}`}>
                                <Form.Label>Options (comma separated)</Form.Label>
                                <Form.Control
                                  value={field.optionsText}
                                  onChange={(currentEvent) =>
                                    updateNormalField(index, {
                                      optionsText: currentEvent.target.value,
                                    })
                                  }
                                  placeholder="option1, option2"
                                  disabled={isPublishedLimited}
                                  required
                                />
                              </Form.Group>
                            </Col>
                          ) : null}
                        </Row>
                      </Card.Body>
                    </Card>
                  );
                })}

                <Button
                  variant="outline-primary"
                  type="button"
                  disabled={isPublishedLimited}
                  onClick={addNormalField}
                >
                  Add Field
                </Button>
              </Card.Body>
            </Card>
          </Col>
        ) : null}

        {type === "MERCH" ? (
          <Col xs={12}>
            <Card className="border">
              <Card.Body>
                <Card.Title className="h6">Merch Config</Card.Title>

                <Row className="g-2 mb-3">
                  <Col md={4}>
                    <Form.Group controlId="merch-per-limit">
                      <Form.Label>Per Participant Limit</Form.Label>
                      <Form.Control
                        type="number"
                        min={1}
                        step={1}
                        value={perParticipantLimit}
                        onChange={(currentEvent) =>
                          setPerParticipantLimit(currentEvent.target.value)
                        }
                        disabled={isPublishedLimited}
                        required
                      />
                    </Form.Group>
                  </Col>
                </Row>

                {merchVariants.map((variant, index) => (
                  <Card key={variant.uiId} className="mb-3 border">
                    <Card.Body>
                      <Row className="g-2 align-items-end">
                        <Col md={3}>
                          <Form.Group controlId={`merch-variant-sku-${index}`}>
                            <Form.Label>SKU</Form.Label>
                            <Form.Control
                              value={variant.sku}
                              onChange={(currentEvent) =>
                                updateMerchVariant(index, {
                                  sku: currentEvent.target.value,
                                })
                              }
                              disabled={isPublishedLimited}
                              required
                            />
                          </Form.Group>
                        </Col>

                        <Col md={3}>
                          <Form.Group controlId={`merch-variant-label-${index}`}>
                            <Form.Label>Label</Form.Label>
                            <Form.Control
                              value={variant.label}
                              onChange={(currentEvent) =>
                                updateMerchVariant(index, {
                                  label: currentEvent.target.value,
                                })
                              }
                              disabled={isPublishedLimited}
                              required
                            />
                          </Form.Group>
                        </Col>

                        <Col md={2}>
                          <Form.Group controlId={`merch-variant-stock-${index}`}>
                            <Form.Label>Stock</Form.Label>
                            <Form.Control
                              type="number"
                              min={0}
                              step={1}
                              value={variant.stock}
                              onChange={(currentEvent) =>
                                updateMerchVariant(index, {
                                  stock: currentEvent.target.value,
                                })
                              }
                              disabled={isPublishedLimited}
                              required
                            />
                          </Form.Group>
                        </Col>

                        <Col md={2}>
                          <Form.Group controlId={`merch-variant-price-delta-${index}`}>
                            <Form.Label>Price Delta</Form.Label>
                            <Form.Control
                              type="number"
                              step="0.01"
                              value={variant.priceDelta}
                              onChange={(currentEvent) =>
                                updateMerchVariant(index, {
                                  priceDelta: currentEvent.target.value,
                                })
                              }
                              disabled={isPublishedLimited}
                            />
                          </Form.Group>
                        </Col>

                        <Col md={2} className="d-flex justify-content-end">
                          <Button
                            variant="outline-danger"
                            type="button"
                            disabled={isPublishedLimited || merchVariants.length <= 1}
                            onClick={() => removeMerchVariant(index)}
                          >
                            Remove
                          </Button>
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                ))}

                <Button
                  variant="outline-primary"
                  type="button"
                  disabled={isPublishedLimited}
                  onClick={addMerchVariant}
                >
                  Add Variant
                </Button>
              </Card.Body>
            </Card>
          </Col>
        ) : null}
      </Row>

      <div className="mt-3 d-flex justify-content-end">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving..." : submitLabel}
        </Button>
      </div>
    </Form>
  );
}
