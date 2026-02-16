import { Container, Nav, Navbar } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { logout } from "../lib/auth";
import { useAuth } from "../lib/authState";

export default function AppNav() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  async function onLogout() {
    try {
      await logout();
    } finally {
      navigate("/login", { replace: true });
    }
  }

  const canSeeParticipant =
    user?.role === "participant" || user?.role === "admin";
  const canSeeOrganizer = user?.role === "organizer" || user?.role === "admin";
  const canSeeAdmin = user?.role === "admin";

  return (
    <Navbar bg="light" expand="lg" className="border-bottom">
      <Container fluid>
        <Navbar.Brand as={Link} to="/">
          DASS
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="main-nav" />
        <Navbar.Collapse id="main-nav">
          <Nav className="me-auto">
            {!loading && !user ? (
              <>
                <Nav.Link as={Link} to="/login">
                  Login
                </Nav.Link>
                <Nav.Link as={Link} to="/signup">
                  Signup
                </Nav.Link>
              </>
            ) : null}

            {!loading && user && canSeeParticipant ? (
              <Nav.Link as={Link} to="/participant">
                Participant
              </Nav.Link>
            ) : null}

            {!loading && user && canSeeOrganizer ? (
              <Nav.Link as={Link} to="/organizer">
                Organizer
              </Nav.Link>
            ) : null}

            {!loading && user && canSeeAdmin ? (
              <Nav.Link as={Link} to="/admin">
                Admin
              </Nav.Link>
            ) : null}
          </Nav>

          <Nav>
            {!loading && user ? (
              <Nav.Link
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  void onLogout();
                }}
              >
                Logout
              </Nav.Link>
            ) : null}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}
