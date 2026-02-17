import { useState } from "react";
import { Button, ButtonGroup, Container } from "react-bootstrap";
import CreateEventWizard from "./organizer/CreateEventWizard";
import MyEvents from "./organizer/MyEvents";
import OrganizerProfile from "./organizer/OrganizerProfile";

type OrganizerView = "events" | "create" | "profile";

export default function OrganizerDashboard() {
  const [view, setView] = useState<OrganizerView>("events");

  // use local view switching so all organizer tools are reachable from /organizer
  return (
    <Container className="py-4">
      <div className="mb-3">
        <h1 className="h3 mb-1">Organizer Dashboard</h1>
        <p className="text-muted mb-0">Manage your events and update your organizer profile.</p>
      </div>

      <ButtonGroup className="mb-3">
        <Button
          variant={view === "events" ? "primary" : "outline-primary"}
          onClick={() => setView("events")}
        >
          My Events
        </Button>
        <Button
          variant={view === "create" ? "primary" : "outline-primary"}
          onClick={() => setView("create")}
        >
          Create Event
        </Button>
        <Button
          variant={view === "profile" ? "primary" : "outline-primary"}
          onClick={() => setView("profile")}
        >
          Profile
        </Button>
      </ButtonGroup>

      {view === "events" ? <MyEvents /> : null}
      {view === "create" ? <CreateEventWizard /> : null}
      {view === "profile" ? <OrganizerProfile /> : null}
    </Container>
  );
}
