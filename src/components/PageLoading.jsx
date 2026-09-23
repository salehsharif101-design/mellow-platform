// Shared fallback for a page's initial "still fetching" gate — every one of
// these used to just `return null`, leaving a fully blank white screen (no
// spinner, no logo, nothing) for however long that fetch took, most visibly
// on ResetPassword.jsx's hardcoded 4-second wait. Centered spinner, same
// `.spinner` class and markup AnswerQuestion.jsx's own loading state already
// used, just pulled out so every page-level loading gate renders the same
// thing instead of nothing.
export default function PageLoading() {
  return (
    <div className="section" style={{ display: 'flex', justifyContent: 'center', padding: '80px 20px' }}>
      <div className="spinner" role="status" aria-label="Loading" />
    </div>
  )
}
