import type { ReactNode } from "react";
import { Badge, Button, Card, Stack } from "react-bootstrap";

export type EventType = "NORMAL" | "MERCH";
export type EventStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "ONGOING"
  | "CLOSED"
  | "COMPLETED";

export type EventCardData = {
  id: string;
  name: string;
  description: string;
  type: EventType;
  tags: string[];
  status: EventStatus | string;
  displayStatus?: EventStatus | string;
  startDate: string;
  endDate: string;
  eligibility?: string;
  regFee?: number;
  canRegister?: boolean;
  registrations24h?: number;
};

type EventCardProps = {
  event: EventCardData;
  onOpenDetail?: (eventId: string) => void;
  actions?: ReactNode;
};

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
}

function statusVariant(status: string):
  | "secondary"
  | "success"
  | "warning"
  | "dark"
  | "primary" {
  if (status === "DRAFT") return "secondary";
  if (status === "PUBLISHED") return "primary";
  if (status === "ONGOING") return "success";
  if (status === "CLOSED") return "warning";
  return "dark";
}

export default function EventCard({ event, onOpenDetail, actions }: EventCardProps) {
  const shownStatus = event.displayStatus ?? event.status;

  return (
    <Card className="h-100 border">
      <Card.Body>
        {/* keep key event identity info grouped at the top */}
        <Stack direction="horizontal" gap={2} className="mb-2 flex-wrap">
          <Badge bg="info">{event.type}</Badge>
          <Badge bg={statusVariant(String(shownStatus))}>{shownStatus}</Badge>
          {typeof event.registrations24h === "number" ? (
            <Badge bg="warning" text="dark">
              {event.registrations24h} regs (24h)
            </Badge>
          ) : null}
        </Stack>

        <Card.Title className="h5 mb-2">{event.name}</Card.Title>
        <Card.Text className="text-muted mb-2">{event.description}</Card.Text>

        {/* show schedule and rules in a compact summary block */}
        <div className="small text-muted mb-2">
          <div>
            <strong>Starts:</strong> {formatDate(event.startDate)}
          </div>
          <div>
            <strong>Ends:</strong> {formatDate(event.endDate)}
          </div>
          <div>
            <strong>Eligibility:</strong> {event.eligibility ?? "all"}
          </div>
          <div>
            <strong>Fee:</strong> {typeof event.regFee === "number" ? event.regFee : 0}
          </div>
        </div>

        {event.tags.length > 0 ? (
          <Stack direction="horizontal" gap={2} className="mb-3 flex-wrap">
            {event.tags.map((tag) => (
              <Badge key={`${event.id}-${tag}`} bg="light" text="dark" className="border">
                {tag}
              </Badge>
            ))}
          </Stack>
        ) : null}

        {typeof onOpenDetail === "function" ? (
          <Button
            variant="outline-primary"
            size="sm"
            onClick={() => {
              onOpenDetail(event.id);
            }}
          >
            View details
          </Button>
        ) : null}

        {event.canRegister === false ? (
          <div className="small text-danger mt-2">Registration currently unavailable.</div>
        ) : null}

        {actions ? <div className="mt-3 d-flex gap-2 flex-wrap">{actions}</div> : null}
      </Card.Body>
    </Card>
  );
}
