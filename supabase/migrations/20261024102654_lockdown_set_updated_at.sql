/*
# Lock down set_updated_at trigger function

The `set_updated_at()` SECURITY DEFINER trigger helper is only used as a
BEFORE UPDATE trigger on profiles. It should not be callable as an RPC by
any role via the Data API. Revoke EXECUTE from PUBLIC and anon, and grant
it only where needed (not needed by authenticated either — it runs through
the trigger, not via RPC).

## Security changes
- REVOKE EXECUTE ON FUNCTION set_updated_at() FROM PUBLIC, anon, authenticated.
*/

REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM authenticated;