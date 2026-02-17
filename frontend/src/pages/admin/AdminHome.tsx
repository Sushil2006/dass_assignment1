import { useEffect, useState } from "react";
import { Alert, Card, Col, Container, Row, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";
import { apiFetch } from "../../lib/api";

type OrganizerListResponse = {
  organizers?: Array<{ id: string }>;
};

export default function AdminHome() {
  const [organizerCount, setOrganizerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadOrganizerCount() {
      setLoading(true);
      setError(null);

      try {
        const res = await apiFetch("/api/admin/organizers");
        if (!res.ok) {
          throw new Error("Failed to load admin dashboard data");
        }

        const data = (await res.json()) as OrganizerListResponse;
        setOrganizerCount(data.organizers?.length ?? 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }

    void loadOrganizerCount();
  }, []);

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 mb-1">Admin Home</h1>
          <p className="text-muted mb-0">Manage organizers and monitor provisioning status.</p>
        </div>
        <Link to="/admin/organizers" className="btn btn-primary">
          Manage Organizers
        </Link>
      </div>

      {error ? <Alert variant="danger">{error}</Alert> : null}

      <Row className="g-3">
        <Col md={6} lg={4}>
          <Card className="h-100">
            <Card.Body>
              <Card.Subtitle className="text-muted mb-2">Organizers</Card.Subtitle>
              <Card.Title className="display-6 mb-0">
                {loading ? <Spinner animation="border" size="sm" /> : organizerCount}
              </Card.Title>
            </Card.Body>
          </Card>
        </Col>

        <Col md={6} lg={8}>
          <Card className="h-100">
            <Card.Body>
              <Card.Title>Next admin action</Card.Title>
              <Card.Text className="text-muted mb-3">
                Create organizer accounts and share generated credentials once.
              </Card.Text>
              <Link to="/admin/organizers" className="btn btn-outline-primary">
                Go to organizer management
              </Link>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
