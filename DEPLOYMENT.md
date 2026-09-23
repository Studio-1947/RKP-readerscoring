# Production hardening checklist

Before deploying this release, set these server-only environment variables in the hosting provider. Never prefix them with `NEXT_PUBLIC_`.

- `SUPABASE_SERVICE_ROLE_KEY`: Supabase project service-role key; it is used only by server route handlers.
- `TRANSCRIPTION_PROOF_SECRET`: a new random 32-byte-or-longer secret used to sign short-lived verified-transcription proofs.
- `HEALTHCHECK_TOKEN`: a random token sent by the monitor as `Authorization: Bearer <token>`.
- Existing `SPEECHMATICS_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

Apply `supabase/migrations/008_server_verified_attempts.sql` to the linked production database before deploying. It removes browser insert permission for reading and quiz attempts; the new server routes use the service role to persist verified scores.

Configure a durable CDN/WAF rate limit as well: `/api/transcribe` should allow no more than 8 requests per IP per hour, and `/api/attempts/*` no more than 20 per IP per hour. The application includes an in-memory backstop, but serverless instances do not share that state.

The existing profile action now deletes the authenticated Supabase user, which cascades to the associated profile and attempts. Publish a reviewed privacy notice that states the data collected, retention period, deletion method, and Speechmatics as the transcription processor before public launch.
