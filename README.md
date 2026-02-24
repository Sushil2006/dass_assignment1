# Felicity Event Management System

MERN-based felicity event management system for participants, organizers, and admin.

## Stack
- Frontend: React + Vite + TypeScript + React-Bootstrap
- Backend: Node.js + Express + TypeScript
- Database: MongoDB Atlas

## Deployment
- Frontend: https://dass-assignment1-frontend.onrender.com/
- Backend: https://dass-assignment1-ujic.onrender.com/

## Advanced Features

### Tier A
- `13.1.2 Merchandise Payment Approval Workflow`  
  Reason: Extends existing merch purchase flow with organizer-side verification, pending/approved/rejected lifecycle, stock update on approval, and ticket/email issuance on approval.
- `13.1.3 QR Scanner & Attendance Tracking`  
  Reason: Builds on existing ticket QR payloads to provide scan-based attendance, duplicate-scan protection, manual override for exceptions, and attendance audit trail.

### Tier B
- `13.2.2 Organizer Password Reset Workflow`  
  Reason: This feature aligns with the assignment's admin-controlled organizer credential model by adding a complete request-review-approve/reject lifecycle with status tracking and reset history.
- Note: Only 1 Tier-B feature is implemented in this submission.

### Tier C (Selected)
- `13.3.2 Add to Calendar Integration`  
  Reason: Low-coupling enhancement using existing event/registration data (`.ics` export + Google/Outlook links + reminder options), useful for participants with minimal workflow risk.

## Run Locally

### Prerequisites
- Node.js 20+
- MongoDB instance

### Environment Variables (backend)
Create `backend/.env` from the example file and edit values

## Run commands
```bash
# install dependencies
# terminal 1
cd backend
npm install

# terminal 2
cd frontend
npm install

# run in 2 terminals
# terminal 1
cd backend
npm run dev

# terminal 2
cd frontend
npm run dev
```
