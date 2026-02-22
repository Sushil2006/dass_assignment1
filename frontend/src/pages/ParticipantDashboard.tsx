import { Card, Col, Container, Row } from "react-bootstrap";
import { Link } from "react-router-dom";

export default function ParticipantDashboard() {
  return (
    <Container className="py-4">
      <div className="mb-3">
        <h1 className="h3 mb-1">Participant Dashboard</h1>
        <p className="text-muted mb-0">Browse events, manage participations, and open tickets.</p>
      </div>

      <Row className="g-3">
        <Col md={6}>
          <Card className="h-100 border">
            <Card.Body>
              <Card.Title>Browse Events</Card.Title>
              <Card.Text className="text-muted">
                Search events, view trending, and open full event detail.
              </Card.Text>
              <Link className="btn btn-primary btn-sm" to="/participant/events">
                Open Browse
              </Link>
            </Card.Body>
          </Card>
        </Col>

        <Col md={6}>
          <Card className="h-100 border">
            <Card.Body>
              <Card.Title>My Events</Card.Title>
              <Card.Text className="text-muted">
                View upcoming, normal, merchandise, completed, and cancelled/rejected tabs.
              </Card.Text>
              <Link className="btn btn-outline-primary btn-sm" to="/participant/my-events">
                Open My Events
              </Link>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
