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
// floored at 0 rather than going negative once the deadline has passed —
// callers needing "is it actually expired" should check isExpired below
// instead of relying on this hitting 0.
export function daysLeftToAnswer(askedAt) {
  const deadlineMs = new Date(askedAt).getTime() + ANSWER_WINDOW_DAYS * DAY_MS
  return Math.max(0, Math.ceil((deadlineMs - Date.now()) / DAY_MS))
}

// True once a still-pending question is past its 3-day window — used both
// to decide what the UI shows right now (before the daily cron has caught
// up and flipped status to 'expired' in the database) and by the cron
// itself to find rows that need exactly that update.
export function isPastDeadline(askedAt) {
  return Date.now() - new Date(askedAt).getTime() > ANSWER_WINDOW_DAYS * DAY_MS
}
