import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ParticipantDashboard from "./pages/ParticipantDashboard";
import OrganizerDashboard from "./pages/OrganizerDashboard";
import CreateEventWizard from "./pages/organizer/CreateEventWizard";
import OrganizerEventDetail from "./pages/organizer/EventDetail";
import OngoingEvents from "./pages/organizer/OngoingEvents";
import AdminHome from "./pages/admin/AdminHome";
import ManageOrganizers from "./pages/admin/ManageOrganizers";
import AppNav from "./components/AppNav";
import ProtectedRoute from "./components/ProtectedRoute";
import BrowseEvents from "./pages/participant/BrowseEvents";
import MyEvents from "./pages/participant/MyEvents";
import EventDetail from "./pages/participant/EventDetail";
import TicketDetail from "./pages/participant/TicketDetail";
import Organizers from "./pages/participant/Organizers";
import OrganizerDetail from "./pages/participant/OrganizerDetail";
import Profile from "./pages/participant/Profile";

export default function App() {
  return (
    <BrowserRouter>
      <AppNav />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route element={<ProtectedRoute roles={["participant"]} />}>
          <Route path="/participant" element={<ParticipantDashboard />} />
          <Route path="/participant/events" element={<BrowseEvents />} />
          <Route path="/participant/events/:eventId" element={<EventDetail />} />
          <Route path="/participant/my-events" element={<MyEvents />} />
          <Route path="/participant/tickets/:ticketId" element={<TicketDetail />} />
          <Route path="/participant/organizers" element={<Organizers />} />
          <Route path="/participant/organizers/:organizerId" element={<OrganizerDetail />} />
          <Route path="/participant/profile" element={<Profile />} />
        </Route>

        <Route element={<ProtectedRoute roles={["organizer"]} />}>
          <Route path="/organizer" element={<OrganizerDashboard />} />
          <Route path="/organizer/events/new" element={<CreateEventWizard />} />
          <Route path="/organizer/events/:eventId" element={<OrganizerEventDetail />} />
          <Route path="/organizer/ongoing" element={<OngoingEvents />} />
        </Route>

        <Route element={<ProtectedRoute roles={["admin"]} />}>
          <Route path="/admin" element={<AdminHome />} />
          <Route path="/admin/organizers" element={<ManageOrganizers />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
