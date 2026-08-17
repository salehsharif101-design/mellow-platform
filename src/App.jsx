import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'

import Welcome from './pages/public/Welcome.jsx'
import Admin from './pages/admin/Admin.jsx'
import Signup from './pages/public/Signup.jsx'
import Login from './pages/public/Login.jsx'
import ForgotPassword from './pages/public/ForgotPassword.jsx'
import ResetPassword from './pages/public/ResetPassword.jsx'
import Privacy from './pages/public/Privacy.jsx'
import RolePublic from './pages/public/RolePublic.jsx'
import CompanyProfile from './pages/public/CompanyProfile.jsx'
import NotFound from './pages/public/NotFound.jsx'

import CandidateDashboard from './pages/candidate/Dashboard.jsx'
import ProfileEdit from './pages/candidate/ProfileEdit.jsx'
import PublicProfile from './pages/candidate/PublicProfile.jsx'
import BrowseRoles from './pages/candidate/Roles.jsx'
import Applications from './pages/candidate/Applications.jsx'
import Shortlisted from './pages/candidate/Shortlisted.jsx'
import ProfileViews from './pages/candidate/ProfileViews.jsx'
import CandidateMessages from './pages/candidate/Messages.jsx'

import EmployerOnboarding from './pages/employer/Onboarding.jsx'
import EmployerEditProfile from './pages/employer/EditProfile.jsx'
import EmployerDashboard from './pages/employer/Dashboard.jsx'
import EmployerRoles from './pages/employer/Roles.jsx'
import RoleApplicants from './pages/employer/RoleApplicants.jsx'
import AllApplicants from './pages/employer/AllApplicants.jsx'
import NewRole from './pages/employer/NewRole.jsx'
import TalentFeed from './pages/employer/Talent.jsx'
import Shortlist from './pages/employer/Shortlist.jsx'
import ShortlistReview from './pages/employer/ShortlistReview.jsx'
import Messages from './pages/employer/Messages.jsx'

export default function App() {
  return (
    <Routes>
      {/* Standalone splash screen, no shared nav/footer */}
      <Route path="/" element={<Welcome />} />

      {/* Password-protected, intentionally never linked from the app nav */}
      <Route path="/admin" element={<Admin />} />

      <Route element={<Layout />}>
        {/* Auth */}
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/privacy" element={<Privacy />} />

        {/* Candidate profile is publicly shareable */}
        <Route path="/profile/:username" element={<PublicProfile />} />

        {/* Role pages are publicly shareable */}
        <Route path="/jobs/:slug" element={<RolePublic />} />

        {/* Company profile pages are publicly shareable */}
        <Route path="/company/:slug" element={<CompanyProfile />} />

        {/* Candidate dashboard */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute requireUserType="candidate">
              <CandidateDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/edit"
          element={
            <ProtectedRoute requireUserType="candidate">
              <ProfileEdit />
            </ProtectedRoute>
          }
        />
        <Route
          path="/roles"
          element={
            <ProtectedRoute requireUserType="candidate">
              <BrowseRoles />
            </ProtectedRoute>
          }
        />
        <Route
          path="/applications"
          element={
            <ProtectedRoute requireUserType="candidate">
              <Applications />
            </ProtectedRoute>
          }
        />
        <Route
          path="/shortlisted"
          element={
            <ProtectedRoute requireUserType="candidate">
              <Shortlisted />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile-views"
          element={
            <ProtectedRoute requireUserType="candidate">
              <ProfileViews />
            </ProtectedRoute>
          }
        />
        <Route
          path="/messages"
          element={
            <ProtectedRoute requireUserType="candidate">
              <CandidateMessages />
            </ProtectedRoute>
          }
        />

        {/* Employer dashboard */}
        <Route
          path="/employer/onboarding"
          element={
            <ProtectedRoute requireUserType="employer">
              <EmployerOnboarding />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employer/dashboard"
          element={
            <ProtectedRoute requireUserType="employer">
              <EmployerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employer/profile/edit"
          element={
            <ProtectedRoute requireUserType="employer">
              <EmployerEditProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employer/roles"
          element={
            <ProtectedRoute requireUserType="employer">
              <EmployerRoles />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employer/roles/:roleId/applicants"
          element={
            <ProtectedRoute requireUserType="employer">
              <RoleApplicants />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employer/applicants"
          element={
            <ProtectedRoute requireUserType="employer">
              <AllApplicants />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employer/roles/new"
          element={
            <ProtectedRoute requireUserType="employer">
              <NewRole />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employer/talent"
          element={
            <ProtectedRoute requireUserType="employer">
              <TalentFeed />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employer/shortlist"
          element={
            <ProtectedRoute requireUserType="employer">
              <Shortlist />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employer/shortlist/review"
          element={
            <ProtectedRoute requireUserType="employer">
              <ShortlistReview />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employer/messages"
          element={
            <ProtectedRoute requireUserType="employer">
              <Messages />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
