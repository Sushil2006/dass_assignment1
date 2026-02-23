import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, Col, Container, Form, Row, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";
import { apiFetch } from "../../lib/api";
import ChangePassword from "../common/ChangePassword";

type ParticipantProfile = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  participantType: "iiit" | "non-iiit" | null;
  collegeOrOrganization: string;
  contactNumber: string;
  interests: string[];
  followedOrganizerIds: string[];
  onboardingCompleted: boolean;
  createdAt: string;
};

type ParticipantProfileResponse = {
  profile?: ParticipantProfile;
};

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data?.error?.message || "Request failed";
  } catch {
    return "Request failed";
  }
}

function interestsToText(values: string[]): string {
  return values.join(", ");
}

function parseInterestsFromText(raw: string): string[] {
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingOnboarding, setSavingOnboarding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [profileId, setProfileId] = useState("");
  const [email, setEmail] = useState("");
  const [participantType, setParticipantType] = useState<ParticipantProfile["participantType"]>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [collegeOrOrganization, setCollegeOrOrganization] = useState("");
  const [interestsText, setInterestsText] = useState("");
  const [followedOrganizerIds, setFollowedOrganizerIds] = useState<string[]>([]);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch("/api/participants/me/profile");
      if (!res.ok) throw new Error(await readErrorMessage(res));

      const data = (await res.json()) as ParticipantProfileResponse;
      const profile = data.profile;
      if (!profile) throw new Error("Profile not found");

      setProfileId(profile.id);
      setEmail(profile.email);
      setParticipantType(profile.participantType);
      setFirstName(profile.firstName ?? "");
      setLastName(profile.lastName ?? "");
      setContactNumber(profile.contactNumber ?? "");
      setCollegeOrOrganization(profile.collegeOrOrganization ?? "");
      setInterestsText(interestsToText(profile.interests ?? []));
      setFollowedOrganizerIds(profile.followedOrganizerIds ?? []);
      setOnboardingCompleted(Boolean(profile.onboardingCompleted));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch("/api/participants/me/profile", {
        method: "PATCH",
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          contactNumber: contactNumber.trim(),
          collegeOrOrganization: collegeOrOrganization.trim(),
          interests: parseInterestsFromText(interestsText),
        }),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));

      const data = (await res.json()) as ParticipantProfileResponse;
      const profile = data.profile;
      if (!profile) throw new Error("Profile not found");

      setFirstName(profile.firstName ?? "");
      setLastName(profile.lastName ?? "");
      setContactNumber(profile.contactNumber ?? "");
      setCollegeOrOrganization(profile.collegeOrOrganization ?? "");
      setInterestsText(interestsToText(profile.interests ?? []));
      setFollowedOrganizerIds(profile.followedOrganizerIds ?? []);
      setOnboardingCompleted(Boolean(profile.onboardingCompleted));
      setSuccess("Profile updated successfully.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  async function completeOnboarding() {
    setSavingOnboarding(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch("/api/participants/me/onboarding", {
        method: "POST",
        body: JSON.stringify({
          interests: parseInterestsFromText(interestsText),
          followedOrganizerIds,
        }),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));

      const data = (await res.json()) as ParticipantProfileResponse;
      const profile = data.profile;
      if (!profile) throw new Error("Profile not found");

      setInterestsText(interestsToText(profile.interests ?? []));
      setFollowedOrganizerIds(profile.followedOrganizerIds ?? []);
      setOnboardingCompleted(Boolean(profile.onboardingCompleted));
      setSuccess("Onboarding preferences saved.");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to save onboarding",
      );
    } finally {
      setSavingOnboarding(false);
    }
  }

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h1 className="h3 mb-1">Participant Profile</h1>
          <p className="text-muted mb-0">
            Update profile details, interests, and onboarding preferences.
          </p>
        </div>
        <Link to="/participant/organizers" className="btn btn-outline-secondary">
          Manage Followed Organizers
        </Link>
      </div>

      {error ? <Alert variant="danger">{error}</Alert> : null}
      {success ? <Alert variant="success">{success}</Alert> : null}

      {loading ? (
        <div className="d-flex align-items-center gap-2">
          <Spinner animation="border" size="sm" />
          <span>Loading profile...</span>
        </div>
      ) : (
        <Row className="g-3">
          <Col lg={7}>
            <Card className="border">
              <Card.Body>
                <Card.Title className="h5 mb-3">Profile Info</Card.Title>
                <Form onSubmit={saveProfile}>
                  <Row className="g-3">
                    <Col md={6}>
                      <Form.Group controlId="participant-profile-id">
                        <Form.Label>Profile ID (read-only)</Form.Label>
                        <Form.Control value={profileId} readOnly disabled />
                      </Form.Group>
                    </Col>

                    <Col md={6}>
                      <Form.Group controlId="participant-email">
                        <Form.Label>Email (read-only)</Form.Label>
                        <Form.Control value={email} readOnly disabled />
                      </Form.Group>
                    </Col>

                    <Col md={6}>
                      <Form.Group controlId="participant-type">
                        <Form.Label>Participant Type (read-only)</Form.Label>
                        <Form.Control value={participantType ?? "-"} readOnly disabled />
                      </Form.Group>
                    </Col>

                    <Col md={6}>
                      <Form.Group controlId="participant-first-name">
                        <Form.Label>First Name</Form.Label>
                        <Form.Control
                          value={firstName}
                          onChange={(currentEvent) =>
                            setFirstName(currentEvent.target.value)
                          }
                          required
                        />
                      </Form.Group>
                    </Col>

                    <Col md={6}>
                      <Form.Group controlId="participant-last-name">
                        <Form.Label>Last Name</Form.Label>
                        <Form.Control
                          value={lastName}
                          onChange={(currentEvent) =>
                            setLastName(currentEvent.target.value)
                          }
                          required
                        />
                      </Form.Group>
                    </Col>

                    <Col md={6}>
                      <Form.Group controlId="participant-contact">
                        <Form.Label>Contact Number</Form.Label>
                        <Form.Control
                          value={contactNumber}
                          onChange={(currentEvent) =>
                            setContactNumber(currentEvent.target.value)
                          }
                          placeholder="optional"
                        />
                      </Form.Group>
                    </Col>

                    <Col md={6}>
                      <Form.Group controlId="participant-college-org">
                        <Form.Label>College / Organization</Form.Label>
                        <Form.Control
                          value={collegeOrOrganization}
                          onChange={(currentEvent) =>
                            setCollegeOrOrganization(currentEvent.target.value)
                          }
                          placeholder="optional"
                        />
                      </Form.Group>
                    </Col>

                    <Col xs={12}>
                      <Form.Group controlId="participant-interests">
                        <Form.Label>Interests (comma separated)</Form.Label>
                        <Form.Control
                          value={interestsText}
                          onChange={(currentEvent) =>
                            setInterestsText(currentEvent.target.value)
                          }
                          placeholder="ai, design, robotics"
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  <div className="mt-3 d-flex justify-content-end">
                    <Button type="submit" disabled={saving}>
                      {saving ? "Saving..." : "Save Profile"}
                    </Button>
                  </div>
                </Form>
              </Card.Body>
            </Card>
          </Col>

          <Col lg={5}>
            <Card className="border mb-3">
              <Card.Body>
                <Card.Title className="h5 mb-2">Onboarding</Card.Title>
                <div className="text-muted small mb-3">
                  Save interests + followed organizers as onboarding preferences.
                </div>
                <div className="small mb-2">
                  <strong>Status:</strong>{" "}
                  {onboardingCompleted ? "completed" : "not completed"}
                </div>
                <div className="small mb-3">
                  <strong>Followed Organizers:</strong> {followedOrganizerIds.length}
                </div>
                <Button
                  variant="outline-primary"
                  disabled={savingOnboarding}
                  onClick={() => {
                    void completeOnboarding();
                  }}
                >
                  {savingOnboarding ? "Saving..." : "Save Onboarding"}
                </Button>
              </Card.Body>
            </Card>

            <ChangePassword username={email} />
          </Col>
        </Row>
      )}
    </Container>
  );
}
