import type { FeedbackPayload, FeedbackSubmission } from '../types/feedback'
import { getOrCreateSessionId } from './sessionId'
import { getSupabaseBrowserClient } from './supabaseClient'

/**
 * Insert row shape for `public.feedback_submissions` — must match DB columns
 * (see `supabase/migrations/20260214120000_feedback_submissions.sql`):
 * `selected_topics`, `selected_subtopics`, `comments` → jsonb;
 * `other_feedback` → text; `can_contact` → boolean; `email` → text nullable;
 * `session_id`, `source`, `environment` → text; omit `id`, `created_at` (defaults).
 * Inserts without `.select()` so INSERT … RETURNING is not blocked by missing SELECT RLS.
 */
type FeedbackSubmissionsInsert = {
  selected_topics: string[]
  selected_subtopics: Record<string, string[]>
  comments: Record<string, Record<string, string>>
  other_feedback: string
  can_contact: boolean
  email: string | null
  session_id: string
  source: string
  environment: string
}

/**
 * Persists feedback to Supabase `feedback_submissions`, then returns the same
 * shape the app already used for local debug state.
 */
export async function submitFeedback(
  payload: FeedbackPayload,
  areaTitlesInOrder: { id: string; title: string }[],
): Promise<FeedbackSubmission> {
  const client = getSupabaseBrowserClient()
  if (!client) {
    throw new Error(
      'Feedback could not be sent: this app is missing Supabase configuration.',
    )
  }

  const insertBody: FeedbackSubmissionsInsert = {
    selected_topics: areaTitlesInOrder.map((a) => a.title),
    selected_subtopics: payload.improvementsByArea,
    comments: payload.detailsByArea,
    other_feedback: payload.additionalFeedback,
    can_contact: payload.canContact,
    email: payload.email?.trim() ? payload.email.trim() : null,
    session_id: getOrCreateSessionId(),
    source: 'conference-prototype',
    environment: import.meta.env.VITE_APP_ENV || 'test',
  }

  // Strip undefined so PostgREST always gets valid JSON (nested objects).
  const row = JSON.parse(
    JSON.stringify(insertBody),
  ) as FeedbackSubmissionsInsert

  // Do not chain `.select()` here: INSERT … RETURNING is subject to SELECT RLS.
  // If only an INSERT policy exists, the whole request can fail with no row stored.
  const { error } = await client.from('feedback_submissions').insert(row)

  if (error) {
    // PostgREST / Supabase errors are plain objects; log every enumerable field + full reference.
    console.error('[submitFeedback] Supabase insert failed — insert payload:', row)
    console.error('[submitFeedback] Supabase insert failed — full error object:', error)
    console.error('[submitFeedback] Supabase insert failed — error fields:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    })
    console.error(
      '[submitFeedback] Supabase insert failed — JSON serialization:',
      JSON.stringify(error, Object.getOwnPropertyNames(error), 2),
    )
    throw new Error(
      error.message ||
        'We could not save your feedback. Please check your connection and try again.',
    )
  }

  const id: string = crypto.randomUUID()

  return {
    id,
    submittedAt: new Date().toISOString(),
    selectedAreas: payload.selectedAreas,
    improvementsByArea: payload.improvementsByArea,
    detailsByArea: payload.detailsByArea,
    additionalFeedback: payload.additionalFeedback,
    standaloneFeedback: payload.standaloneFeedback,
    email: payload.email,
    canContact: payload.canContact,
  }
}
