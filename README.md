# Weekly

A responsive personal budget app built with TypeScript, Next.js App Router, and React. Uses Firebase Authentication and Cloud Firestore for private per-account budgets and live synchronization, with validated JSON backup import/export.

## Run

Requires Node.js 20.9+ and pnpm (or npm).

```sh
pnpm install
pnpm dev
pnpm test
pnpm build
pnpm start
```

## Deploy to Vercel

Import `UzixGP/Budget-App` into Vercel and select the Next.js framework preset. The app is at the repository root: leave Root Directory as `.`. Use `pnpm install --frozen-lockfile` to install and `pnpm build` to build; leave the output directory at its Next.js default.

Before deploying, add these environment variables in Vercel, using the values from your local `.env.local`:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

The local `.env.local` file is intentionally not committed. After deployment, add the site's hostname to Firebase Authentication > Settings > Authorized domains. Publish `firestore.rules` in Firebase separately; a Vercel deployment does not publish database rules.

## Setup and calculations

- Weekly gross $1,193; withholding $243.72; deductions $0; net $949.28. Friday payday is an editable assumption.
- The handwritten list is draft data, not instructions. Unnamed amounts are labeled for confirmation; credit cards and NJIT have unknown amounts. Dates assume September 2026–January 2027. No historical paycheck dates were inferred from the payroll period screenshot.
- Reserve per payment = remaining amount / number of weekly paydays from the selected week start through the due date, rounded upward to a cent. Overdue balances require full funding now. Update "Already set aside" after moving money into a reserve; this app does not transfer funds or automatically accumulate reserves.
- Weekly available = current net salary minus bill reserves, tuition reserves, and purchases dated within the selected pay week. Missing amounts produce a provisional warning; a negative result is a shortfall. The donut displays relative allocations and does not include negative available funds.
- Marking a payment paid records its amount and actual date, clears its reserve, and leaves its schedule available for history. Due dates falling beyond the next month's length clamp to the last day; edit the next due date if needed. Recorded bill payments are retained in the balance history. Do not enter a reserved bill again as everyday spending.
- Planning views always use current salary and current payment state, not historical budget snapshots. Recorded paychecks retain original gross/tax/deduction amounts after salary edits.
- Annual tax totals sum recorded checks by payment-date year. The separate projection is current weekly withholding × 52, not taxes owed or a tax filing calculation.
- Cloud data is specific to each signed-in account. There is no bank connection or shared household access. Export backups regularly. The legacy browser budget must be imported explicitly after sign-in.

## Verification

`pnpm test` checks payday boundaries, reserve cent rounding, overdue funding, unknown amounts, and month-end date advancement. `pnpm build` performs the production build and TypeScript checking.

## Recurring commitments

Existing browser data and older backups receive a one-time update: NJIT is $1,600 monthly on the 15th with a fixed $400 weekly reserve; Mom's food payment is $200 and Dad's rent is $100 weekly, starting on Friday of the week the update is first opened. Saved balances and other entries are preserved. Export a backup before restoring an older file.

Add spending offers one-time, weekly, bi-weekly (14 days), and monthly recurrence anchored to the payment date. Monthly schedules clamp to shorter months and return to the original day afterward. Scheduled occurrences are included in each week's available balance, without creating duplicate stored purchases. Deleting a schedule removes all of its occurrences.

Tuition reserves are plans, not bank transfers. Edit Already set aside after transferring funds. The weekly reserve stops at the remaining goal; marking the monthly bill paid resets its saved balance and records that occurrence. If the deadline is near, the fixed $400 may require an additional catch-up contribution. Do not add the tuition transfer as spending as well, since it is already reserved.

Accounts and cloud sync use Firebase after the setup below is completed. Do not store passwords in the budget data or browser storage. Each family member can have a separate private budget; shared household access would require an additional sharing model.

## Firebase account setup

Project: `budget-app-172fd`.

1. In Firebase Console, open Build > Authentication > Get started. Enable the Email/Password provider (email-link sign-in is not required).
2. Open Build > Firestore Database > Create database. Choose Standard edition, the default database, a region near your users, and production mode if prompted.
3. Open the Firestore Rules tab, replace the editor contents with `firestore.rules`, and Publish. These rules permit access only to the signed-in user's `budgets/{uid}` document and require increasing revisions on updates. Do not use public test-mode rules.
4. Copy `.env.example` to `.env.local` and fill in the Firebase Web app configuration from Project settings > General > Your apps. This workspace's local configuration has already been filled in. `.env.local` is git-ignored. Public web configuration is embedded in the browser build; it is not a substitute for security rules. Never place a service-account private key in a NEXT_PUBLIC variable.
5. Under Authentication > Settings > Authorized domains, add `localhost` for local testing and your deployed app's domain.
6. Restart with `npm.cmd run dev`. Create your account and choose Import this browser's budget to bring in existing data. Use the same browser and origin where your old budget was saved. Other family members should choose Start an empty budget. A JSON backup can also be imported from Settings.
7. For Vercel, add the same four NEXT*PUBLIC_FIREBASE*\* environment variables before deploying, then rebuild. Local .env.local files are not uploaded automatically.

If Firebase CLI is installed and signed into your project, rules can alternatively be published with `firebase deploy --only firestore:rules --project budget-app-172fd`.

Cloud budgets are loaded after sign-in and changes appear through a Firestore listener. Writes use revision-checked transactions: a conflicting edit is rejected instead of overwriting another device's changes. A failed change can be downloaded as a JSON backup. Editing is paused offline, and the app waits for a server-confirmed budget before enabling edits. Cloud data is not copied to persistent browser storage. Signing out removes the rendered budget. The original legacy localStorage backup is retained solely for explicit import.

The small-budget storage model uses one document per account (Firestore's document size limit applies). Large transaction histories should eventually move to individual record collections. Signup, sign-in, password reset, cross-device synchronization, and rules must be smoke-tested against the configured project after console setup is complete.


## Profile and navigation

Signup now asks for a full name, saved in Firebase Authentication. Existing accounts without a name complete their profile after signing in. Edit the name later in Settings > Your profile. The sidebar shows the first name and initial; click the profile button at the bottom to open Profile settings or Sign out. The top-left menu button toggles the sidebar, and Escape closes it. Mobile navigation closes after selecting a section.

Add/Edit payment supports one-time, weekly (7 days), biweekly (14 days), and monthly recurrence. Mark paid advances recurring payments by the chosen interval and clears the reserved balance. Existing monthly payments and backups remain supported. Payments remain outstanding until marked paid; recurring spending still uses its separate automatic schedule.


## Date-bounded schedules and running balances

Republish the current `firestore.rules` in Firebase Console before saving starting money or marking bills paid. The schema now permits `cash` (opening balance and period configuration) and `payments` (recorded bill-payment history). Authentication and per-user isolation are unchanged.

- Overview > Edit starting money and period cycle, or Settings > Starting money & period cycle: set a balance and its effective date. The balance is the money available at the **start** of that day, before any transactions on that date. Transactions before that date are already included and are not added again. Negative starting balances are supported.
- Choose the first period's inclusive start and end dates. Subsequent periods use the same number of days, with no overlap. Friday through Thursday is the default seven-day cycle; use the arrows to navigate. Paychecks still follow the payday selected in Settings.
- Payments and spending have a first date and optional inclusive end date. Weekly, biweekly, and monthly schedules stop at that end date. Monthly schedules clamp to short months and return to the original day afterward. An empty end date means ongoing. One-time spending occurs just once, regardless of its end date.
- Add spending with Repeat = One-time for gas or any individual purchase. The Spending tab shows the selected period, the saved entries/schedules (which can be edited), and recorded bill payments.
- Due this period only shows unpaid occurrences inside the selected range. Future due dates no longer contribute to this period's bill total. Older unpaid bills remain in Bills & payments.
- Mark paid records the selected occurrence as an actual payment **today** and clears its reserved balance. It no longer removes the bill or changes its original recurrence anchor. Recorded payment history survives deletion of its schedule. An occurrence already recorded as paid cannot be recorded twice. Do not also enter a bill payment as spending.
- Recorded balance = starting money + recorded paycheck net amounts - one-time purchases - bills marked paid, through today. Recurring spending remains a schedule, not confirmation of a transfer. This is a manually maintained balance, not a bank connection.
- Projected leftover = carried opening money + income - scheduled/recorded bill payments - purchases and recurring spending. A recorded paycheck replaces the salary estimate for its pay week. Recorded bills replace their scheduled occurrence; they are not charged again. Projected leftover automatically becomes the next period's opening amount.
- Savings reserved toward tuition are earmarks within your money, not additional cash outflows. The cash projection charges the tuition bill on its due date; the tuition panel still displays its weekly saving target.

Historical *projections* use current schedules and salary settings; editing those can revise projected carryover. Recorded balances use actual recorded events. Old versions did not retain paid-bill history, so set an accurate opening balance now rather than expecting the app to reconstruct past bank activity. Periods before the opening balance date have no assumed history. JSON backups include the new settings and payment records, and older backups remain readable.
