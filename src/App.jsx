import { Routes, Route } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import PageLoading from './components/PageLoading.jsx'
import Layout from './components/Layout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'

const Welcome = lazy(() => import('./pages/public/Welcome.jsx'))
const Admin = lazy(() => import('./pages/admin/Admin.jsx'))
const Signup = lazy(() => import('./pages/public/Signup.jsx'))
const Login = lazy(() => import('./pages/public/Login.jsx'))
const ForgotPassword = lazy(() => import('./pages/public/ForgotPassword.jsx'))
const ResetPassword = lazy(() => import('./pages/public/ResetPassword.jsx'))
const Privacy = lazy(() => import('./pages/public/Privacy.jsx'))
const Terms = lazy(() => import('./pages/public/Terms.jsx'))
const Guide = lazy(() => import('./pages/public/Guide.jsx'))
const RolePublic = lazy(() => import('./pages/public/RolePublic.jsx'))
const CompanyProfile = lazy(() => import('./pages/public/CompanyProfile.jsx'))
const HireConfirmed = lazy(() => import('./pages/public/HireConfirmed.jsx'))
const ThanksForLettingUsKnow = lazy(() => import('./pages/public/ThanksForLettingUsKnow.jsx'))
const HireAccepted = lazy(() => import('./pages/public/HireAccepted.jsx'))
const NotThisTime = lazy(() => import('./pages/public/NotThisTime.jsx'))
const HireIndex = lazy(() => import('./pages/public/HireIndex.jsx'))
const HireLocationRole = lazy(() => import('./pages/public/HireLocationRole.jsx'))
const JobsIndex = lazy(() => import('./pages/public/JobsIndex.jsx'))
const JobsLocation = lazy(() => import('./pages/public/JobsLocation.jsx'))
const NotFound = lazy(() => import('./pages/public/NotFound.jsx'))
const AnswerQuestion = lazy(() => import('./pages/public/AnswerQuestion.jsx'))

const CandidateDashboard = lazy(() => import('./pages/candidate/Dashboard.jsx'))
const ProfileEdit = lazy(() => import('./pages/candidate/ProfileEdit.jsx'))
const PublicProfile = lazy(() => import('./pages/candidate/PublicProfile.jsx'))
const BrowseRoles = lazy(() => import('./pages/candidate/Roles.jsx'))
const Applications = lazy(() => import('./pages/candidate/Applications.jsx'))
const Shortlisted = lazy(() => import('./pages/candidate/Shortlisted.jsx'))
const ProfileViews = lazy(() => import('./pages/candidate/ProfileViews.jsx'))
const CandidateMessages = lazy(() => import('./pages/candidate/Messages.jsx'))

const EmployerOnboarding = lazy(() => import('./pages/employer/Onboarding.jsx'))
const EmployerEditProfile = lazy(() => import('./pages/employer/EditProfile.jsx'))
const EmployerDashboard = lazy(() => import('./pages/employer/Dashboard.jsx'))
const EmployerRoles = lazy(() => import('./pages/employer/Roles.jsx'))
const RoleApplicants = lazy(() => import('./pages/employer/RoleApplicants.jsx'))
const AllApplicants = lazy(() => import('./pages/employer/AllApplicants.jsx'))
const NewRole = lazy(() => import('./pages/employer/NewRole.jsx'))
const TalentFeed = lazy(() => import('./pages/employer/Talent.jsx'))
const Shortlist = lazy(() => import('./pages/employer/Shortlist.jsx'))
const ShortlistReview = lazy(() => import('./pages/employer/ShortlistReview.jsx'))
const RejectedTalent = lazy(() => import('./pages/employer/RejectedTalent.jsx'))
const Messages = lazy(() => import('./pages/employer/Messages.jsx'))
const Team = lazy(() => import('./pages/employer/Team.jsx'))
const TeamAccept = lazy(() => import('./pages/employer/TeamAccept.jsx'))

export default function App() {
  return (
    <Suspense fallback={<PageLoading />}>
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
          <Route path="/terms" element={<Terms />} />
          <Route path="/guide" element={<Guide />} />

          {/* Candidate profile is publicly shareable */}
          <Route path="/profile/:username" element={<PublicProfile />} />

          {/* SEO landing pages — static paths registered ahead of the dynamic
              /jobs/:slug below so a location page can never be shadowed by a
              same-named role slug. */}
          <Route path="/hire" element={<HireIndex />} />
          <Route path="/hire/:location/:role" element={<HireLocationRole />} />
          <Route path="/jobs" element={<JobsIndex />} />
          <Route path="/jobs/bahrain" element={<JobsLocation location="bahrain" />} />
          <Route path="/jobs/uae" element={<JobsLocation location="uae" />} />
          <Route path="/jobs/saudi-arabia" element={<JobsLocation location="saudi-arabia" />} />

          {/* Role pages are publicly shareable */}
          <Route path="/jobs/:slug" element={<RolePublic />} />

          {/* Company profile pages are publicly shareable */}
          <Route path="/company/:slug" element={<CompanyProfile />} />

          {/* Public — the answer_token itself is the credential, same idea as
              /employer/team/accept below. Works for a logged-out candidate
              too. */}
          <Route path="/answer-question/:token" element={<AnswerQuestion />} />

          {/* Post-meeting follow-up loop — reached from email links, no
              session required. */}
          <Route path="/hire-confirmed" element={<HireConfirmed />} />
          <Route path="/still-deciding" element={<ThanksForLettingUsKnow />} />
          <Route path="/hire-accepted" element={<HireAccepted />} />
          <Route path="/hire-declined" element={<ThanksForLettingUsKnow />} />
          <Route path="/not-this-time" element={<NotThisTime />} />

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
          {/* Landing target for a newly confirmed (or just signed-up) candidate
              — see Login.jsx's confirmedParam routing and Signup.jsx's
              immediate-session path. Same component as /profile/edit, just
              forced into wizard mode so a first, hash-less visit doesn't fall
              through to the real edit form (ProfileEdit.jsx's own
              showEditProfileForm comment explains why that's the default for
              a plain /profile/edit visit). */}
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute requireUserType="candidate">
                <ProfileEdit forceWizard />
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
            path="/employer/rejected"
            element={
              <ProtectedRoute requireUserType="employer">
                <RejectedTalent />
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
          <Route
            path="/employer/team"
            element={
              <ProtectedRoute requireUserType="employer">
                <Team />
              </ProtectedRoute>
            }
          />
          {/* Public — the invite token itself is the credential; the person
              accepting it may not have an account yet. */}
          <Route path="/employer/team/accept" element={<TeamAccept />} />

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
