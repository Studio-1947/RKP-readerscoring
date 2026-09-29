-- reader_passages, admin_quizzes, admin_quiz_questions and moderation_flags have RLS
-- enabled with no policies (see 012_admin_console.sql). That is intentional: every
-- read/write goes through the service-role client in app/api/content/* and
-- app/api/admin/*, and these tables must stay invisible to the anon/authenticated
-- client. Documenting that intent explicitly so a future migration doesn't "fix"
-- the missing policies by opening them up.
comment on table public.reader_passages is
  'Service-role only. RLS enabled with no policies by design — read via /api/content/passages and written via /api/admin/content, never directly from the browser client.';
comment on table public.admin_quizzes is
  'Service-role only. RLS enabled with no policies by design — read via /api/content/quiz and written via /api/admin/content, never directly from the browser client.';
comment on table public.admin_quiz_questions is
  'Service-role only. RLS enabled with no policies by design — read via /api/content/quiz and written via /api/admin/content, never directly from the browser client.';
comment on table public.moderation_flags is
  'Service-role only. RLS enabled with no policies by design — read/written exclusively via /api/admin/* routes using requireAdmin(), never directly from the browser client.';
