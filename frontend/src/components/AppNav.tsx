import { useCallback, useEffect } from "react";
import { Container, Nav, Navbar } from "react-bootstrap";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getMe, logout, type AuthUser } from "../lib/auth";
import { useAuth } from "../lib/authState";

type NavItem = {
  label: string;
  to: string;
};

const roleMenus: Record<AuthUser["role"], NavItem[]> = {
  participant: [
    { label: "Dashboard", to: "/participant" },
    { label: "Browse Events", to: "/participant" },
    { label: "Clubs/Organizers", to: "/participant" },
    { label: "Profile", to: "/participant" },
  ],
  organizer: [
    { label: "Dashboard", to: "/organizer" },
    { label: "Create Event", to: "/organizer" },
    { label: "Ongoing Events", to: "/organizer" },
    { label: "Profile", to: "/organizer" },
  ],
  admin: [
    { label: "Dashboard", to: "/admin" },
    { label: "Manage Clubs/Organizers", to: "/admin/organizers" },
    { label: "Password Reset Requests", to: "/admin" },
  ],
};

export default function AppNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading, setUser } = useAuth();

  const syncNavRole = useCallback(async (_pathname: string) => {
    try {
      const me = await getMe();
      setUser(me);
    } catch {
      setUser(null);
    }
  }, [setUser]);

  useEffect(() => {
    void syncNavRole(location.pathname);
  }, [location.pathname, syncNavRole]);

  async function onLogout() {
    try {
      await logout();
    } finally {
      setUser(null);
      navigate("/login", { replace: true });
    } 
  }

  // Compute role menu once the user is known.
  const menuItems = user ? roleMenus[user.role] : [];

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
                  Participant Signup
                </Nav.Link>
              </>
            ) : null}

            {!loading && user
              ? menuItems.map((item) => (
                  <Nav.Link
                    key={`${item.label}-${item.to}`}
                    as={Link}
                    to={item.to}
                  >
                    {item.label}
                  </Nav.Link>
                ))
              : null}
          </Nav>

          <Nav>
            {!loading && user ? (
              <Nav.Link
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  // Keep logout async-safe from click handler.
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
