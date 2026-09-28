-- Scholarship review changes flow through the Phase D submission/reopen RPCs.
-- No application route deletes a review directly. Retain rows and their audit trail.
revoke delete on public.reviews from authenticated;
