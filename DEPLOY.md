# Cebu Current: setup and deployment guide

Cebu Current is a Next.js local-news website for Cebu City and Cebu Province. It links to original Cebu reporting, refreshes headlines from the SunStar Cebu feed, and keeps verified article links available if that feed is temporarily unavailable. Supabase adds reader accounts, email confirmation, three-attempt/five-minute sign-in protection, in-site account alerts, and an administrator activity view. Login alerts stay inside the website; no Resend account or email alert service is used.

Use a separate GitHub repository, Supabase account and project, Vercel account and project, and production URL for Cebu Current. This keeps its reader accounts, security data, settings, and deployments independent from Bohol Beacon.

## What you will need

- Git and a GitHub account.
- A separate Vercel account for Cebu Current.
- A separate Supabase account and project for Cebu Current.
- An email address you control for the first admin account.
- A custom SMTP provider if you want reliable confirmation email delivery for public sign-ups. Supabase email confirmation is separate from the in-site security alerts.

## 1. Create a private GitHub repository

1. Open [github.com/new](https://github.com/new) and sign in.
2. Name the repository cebu-current and select **Private**.
3. Leave the options to add a README, .gitignore, and license turned off. This folder already contains those files.
4. Create the repository and leave its page open.
5. Open PowerShell and enter:

   ```powershell
   Set-Location "C:\Users\Min\Documents\Codex\2026-11-08\le\outputs\Cebu-Current"
   git init -b main
   git add .
   git commit -m "Create Cebu Current local news site"
   git remote add origin https://github.com/YOUR-GITHUB-NAME/cebu-current.git
   git push -u origin main
   ```

6. Replace YOUR-GITHUB-NAME with your GitHub username on the git remote line.
7. If Git asks you to sign in, complete GitHub’s prompt.
8. Refresh the repository page. You should see app, lib, supabase, package.json, proxy.ts, and DEPLOY.md.

The included .gitignore excludes .env files, dependencies, and build output. Never commit a real Supabase secret key.

## 2. Create a separate Supabase project

1. Open [Supabase](https://supabase.com/dashboard) and sign in to the separate Supabase account you will use for Cebu Current.
2. Create a new Supabase project for Cebu Current. Choose an Asia region near the Philippines and save the database password privately.
3. In **Project Settings → API Keys** or the project’s **Connect** dialog, copy:
   - Project URL
   - Publishable key (sb_publishable_…)
   - Secret key (sb_secret_…)
4. Keep the secret key private. It belongs only in the Vercel server-side variable named SUPABASE_SECRET_KEY.
5. In Supabase, open **SQL Editor → New query**.
6. Open this project’s supabase/schema.sql, copy the whole file, paste it into the query, and select **Run**.
7. Confirm that the query completes. It creates private Cebu security tables, row-level security policies, and the database functions used by the sign-in protection.
8. Open **Authentication → Sign In / Providers → Email** and enable email/password sign-in and email confirmation.

This separate Supabase project keeps Cebu Current reader accounts and login-alert records independent from Bohol Beacon.

## 3. Create a separate Vercel project

1. Open [Vercel](https://vercel.com/dashboard) and sign in to the separate Vercel account you will use for Cebu Current.
2. Select **Add New → Project** and import your private cebu-current GitHub repository into this account.
3. Keep the detected Next.js framework and the project root as ./.
4. Before deploying, add these environment variables. Select **Production**, **Preview**, and **Development** when Vercel offers environment choices.

   | Variable | Value |
   | --- | --- |
   | NEXT_PUBLIC_SUPABASE_URL | Supabase Project URL |
   | NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Supabase publishable key |
   | SUPABASE_SECRET_KEY | Supabase secret key |
   | ADMIN_EMAILS | The exact email address you will use for the Cebu Current admin account |

5. Double-check the variable names, especially that the secret key does not begin with NEXT_PUBLIC_.
6. Select **Deploy** and wait until Vercel reports **Ready**.
7. Open the production deployment and copy its public URL.

When you change Vercel environment variables later, create a new deployment for the changes to take effect.

## 4. Set Supabase redirect URLs

1. In Supabase, open **Authentication → URL Configuration**.
2. Add the exact Vercel production callback URL under **Redirect URLs** by appending /auth/callback, for example:
   https://cebu-current-yourname.vercel.app/auth/callback
3. Select **Save changes**.
4. Set **Site URL** to the new Cebu Current production URL.
5. Add a Vercel Preview redirect pattern only if you plan to test sign-up on preview URLs. Keep it limited to this separate Vercel account’s preview domains.

## 5. Set up confirmation email

1. Supabase email confirmation must be enabled for reader sign-up.
2. For a class/demo project, try a sign-up with an inbox you control and check Inbox, Spam, and Promotions.
3. Supabase’s default sender is rate-limited. For reliable public sign-ups, configure a custom SMTP provider under Supabase Authentication settings and use a sender address you control.
4. Confirmation email is used only to verify ownership during sign-up. Failed-login alerts remain inside Cebu Current.

## 6. Create and check the administrator

1. Open the Vercel production URL.
2. Select **Reader sign in → Create an account**.
3. Enter the admin email listed in ADMIN_EMAILS and choose a unique password of at least 10 characters.
4. Open the confirmation email and click its verification link. It should return you to Cebu Current.
5. Sign in with the same email and password.
6. The header should now show **Newsroom** and **My alerts**. Select **Newsroom** to open the administrator activity view.
7. If **Newsroom** is missing, check that ADMIN_EMAILS matches the verified account email exactly. Update the variable in Vercel and redeploy.

To add another administrator, add the verified email to ADMIN_EMAILS, separated by a comma. Newsroom access can view IP and browser/device hints for recorded attempts, so keep this list restricted.

## 7. Try the login protection with accounts you control

Use a dedicated test account, not your admin email.

1. Keep the admin account signed in in one browser profile.
2. In another browser profile, create and verify a reader test account, then sign in to it and open **My alerts**.
3. Use a third browser profile or a private window as the test attacker. Enter the test account email with an incorrect password once, then repeat twice more.
4. After the third failure, the test account should be paused for five minutes. A fourth attempt during the pause should be blocked.
5. Check **Newsroom** in the admin profile for the failed, locked, and blocked events.
6. Check **My alerts** in the reader profile. While the reader is signed in, the alert list refreshes about every 12 seconds.
7. After the pause expires, sign in successfully to clear that account’s failed-attempt counter.

Different tabs in one browser profile share the same site sign-in state. Use separate browser profiles for admin, reader, and test attacker.

## What the security activity can and cannot show

- Attempts are associated with the email typed into the sign-in form. The database lockout is per email and lasts five minutes after three failed password attempts.
- The app records the request IP when Vercel supplies it and estimates a location from IP headers. City/region estimates can be wrong or missing.
- Device details come from a browser user-agent string and can be inaccurate or spoofed.
- Websites cannot read a visitor’s MAC address.
- If a reader is signed out during an attempt, the event remains in Supabase and appears in their in-site alerts after they sign in. There is no offline push or email alert.
- Admin access is checked on the server against the ADMIN_EMAILS allowlist. A reader can access only alerts for their own signed-in account.
- The five-minute lock is per email. A person who knows an email can intentionally cause a temporary pause, so use this as a controlled class demo and test only accounts you own or are authorized to assess.
