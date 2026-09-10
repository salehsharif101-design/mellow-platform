// Pure constants/helpers for the async video interviewing feature — no
// supabase import, no env var reads, so this is safe to import from both
// client pages and api/ serverless functions (see pipelineStages.js's own
// comment on why that distinction matters for anything imported into
// api/email.js).

export const QUESTION_LIMIT = 2
export const ANSWER_WINDOW_DAYS = 3
export const QUESTION_TEXT_MAX_LENGTH = 300
const DAY_MS = 24 * 60 * 60 * 1000

// Whole days remaining before a pending question's answer window closes,
// counting down 3/2/1/0 as each full day elapses. elapsedMs is clamped to
// >= 0 before flooring — a negative value (asked_at reading as fractionally
// "later than now", e.g. right after insert before a client's clock catches
// up) would otherwise floor to -1 and push the result up to 4.
export function daysLeftToAnswer(askedAt) {
  const elapsedMs = Math.max(0, Date.now() - new Date(askedAt).getTime())
  const elapsedDays = Math.floor(elapsedMs / DAY_MS)
  return Math.max(0, ANSWER_WINDOW_DAYS - elapsedDays)
}

// True once a still-pending question is past its 3-day window — used both
// to decide what the UI shows right now (before the daily cron has caught
// up and flipped status to 'expired' in the database) and by the cron
// itself to find rows that need exactly that update.
export function isPastDeadline(askedAt) {
  return Date.now() - new Date(askedAt).getTime() > ANSWER_WINDOW_DAYS * DAY_MS
}

// True once a question's answer window has closed, whichever way the
// caller happens to have the row: an already-cron-flipped 'expired' status,
// or a still-'pending' row the cron hasn't reached yet.
function isEffectivelyClosed(question) {
  return question.status === 'expired' || (question.status === 'pending' && isPastDeadline(question.asked_at))
}

// Whether a new question can be asked for this candidate right now, and
// why not if it can't — shared by RoleApplicants and ShortlistReview so the
// "second question only unlocks once the first is answered or expired"
// rule and its tooltip copy can't drift between the two pages.
export function getAskQuestionAvailability(questions) {
  if (questions.length >= QUESTION_LIMIT) {
    return { canAsk: false, reason: 'You have used both questions for this talent.' }
  }
  if (questions.length === 1 && questions[0].status === 'pending' && !isEffectivelyClosed(questions[0])) {
    return { canAsk: false, reason: 'Waiting for the candidate to answer your first question.' }
  }
  return { canAsk: true, reason: '' }
}
