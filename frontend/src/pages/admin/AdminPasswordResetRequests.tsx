import { Card, Container } from "react-bootstrap";
import { Link } from "react-router-dom";

export default function AdminPasswordResetRequests() {
  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 mb-1">Password Reset Requests</h1>
          <p className="text-muted mb-0">
            Review organizer password reset requests and their statuses.
          </p>
        </div>
        <Link to="/admin" className="btn btn-outline-secondary">
          Back to admin home
        </Link>
      </div>

      <Card className="border">
        <Card.Body>
          <div className="text-muted mb-0">
            No password reset requests available right now.
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
}
