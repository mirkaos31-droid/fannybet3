# Supabase auto-confirm signup (no email confirmation)

This project includes an optional Supabase Edge Function that lets you create users server-side with their email auto-confirmed (`email_confirm: true`). Use this if you want sign-ups to not require email confirmation.

⚠️ Security: this function uses your project's `service_role` key and must be kept secret. Only deploy to a trusted environment and enable rate-limiting / captcha if exposing publicly.

## Files added
- `supabase/functions/no_confirm_signup/index.ts` — Edge Function that calls `supabase.auth.admin.createUser({ email_confirm: true })` with the `service_role` key.

## Deployment steps
1. Install Supabase CLI and login: `npm i -g supabase` then `supabase login`.
2. Deploy the function: from repository root run:

   supabase functions deploy no_confirm_signup --project-ref <your-project-ref>

3. Set required environment variables for the function (in the Supabase dashboard or via CLI):

   - `SUPABASE_URL` (your project URL)
   - `SUPABASE_SERVICE_ROLE_KEY` (your project's service role key — keep it secret)

   Using CLI (example):

   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service_role_key>

4. (Optional) Secure the function (rate limiting, require a captcha or some key) to prevent abuse.

## Using from the client
`src/services/gameService.ts` includes `signUpNoConfirm(username, email, password)` which will:

1. Invoke the `no_confirm_signup` function.
2. If successful, sign the user in with `supabase.auth.signInWithPassword` and return the user info.

Replace `gameService.signUp(...)` with `gameService.signUpNoConfirm(...)` where desired.

> Note: The default `LoginView` UI now includes an **"Auto-confirm email (dev only)"** checkbox during signup which, when checked, will call `signUpNoConfirm`. **Only enable this after you deploy and secure the Edge Function.**

## Alternative
If you want to globally disable confirmations for all signups, you can also go to Supabase Dashboard -> Authentication -> Providers -> turn off `Confirm email`. This is the quickest option but affects the entire project.

---
If you want, I can:
- Add an optional environment flag to the frontend to switch to `signUpNoConfirm` automatically.
- Harden the function (captcha, rate-limiting, basic abuse protection) before you deploy it publicly.
