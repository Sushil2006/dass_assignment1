import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ParticipantDashboard from "./pages/ParticipantDashboard";
import OrganizerDashboard from "./pages/OrganizerDashboard";
import CreateEventWizard from "./pages/organizer/CreateEventWizard";
import AdminHome from "./pages/admin/AdminHome";
import ManageOrganizers from "./pages/admin/ManageOrganizers";
import AppNav from "./components/AppNav";
import ProtectedRoute from "./components/ProtectedRoute";

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
        </Route>

        <Route element={<ProtectedRoute roles={["organizer"]} />}>
          <Route path="/organizer" element={<OrganizerDashboard />} />
          <Route path="/organizer/events/new" element={<CreateEventWizard />} />
        </Route>

        <Route element={<ProtectedRoute roles={["admin"]} />}>
          <Route path="/admin" element={<AdminHome />} />
          <Route path="/admin/organizers" element={<ManageOrganizers />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
