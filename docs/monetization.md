# Lingo monetization

## Product model

Lingo starts without ads. Free users receive A1 and 20 learning steps per day. Premium subscribers receive unlimited learning plus A2 and B1.

| Product | Entitlement plan | RevenueCat package |
| --- | --- | --- |
| Premium monthly | `premium_monthly` | `$rc_monthly` |
| Premium yearly | `premium_yearly` | `$rc_annual` |
| Premium lifetime | `premium_lifetime` | `$rc_lifetime` |

All three RevenueCat products grant the single `premium` entitlement. The lifetime product deliberately unlocks all Premium features permanently.

## RevenueCat and Stripe web checkout

Lingo uses a RevenueCat Web Purchase Link backed by Stripe Billing. The checkout link is not stored with a hard-coded user name. When an authenticated user selects a package, Lingo builds this URL dynamically:

```text
https://pay.rev.cat/<purchase-link-token>/<firebaseUid>/checkout?package_id=$rc_monthly
```

Use the purchase-link template only as the environment-variable value, without the Firebase UID and without `/checkout`:

```text
NEXT_PUBLIC_BILLING_ENABLED=true
NEXT_PUBLIC_REVENUECAT_BILLING_ENVIRONMENT=sandbox
NEXT_PUBLIC_REVENUECAT_PURCHASE_LINK_SANDBOX_TEMPLATE=https://pay.rev.cat/<sandbox-token>
```

Set the production template only after the sandbox test works. Never distribute the sandbox URL publicly: it permits test purchases without real money.

## Secure entitlement flow

The client never writes a Premium flag. RevenueCat sends a signed webhook to:

```text
https://<your-domain>/api/webhooks/revenuecat
```

The handler verifies the HMAC signature and optional authorization header, then writes the current state to:

`userEntitlements/{firebaseUid}`

```json
{
  "plan": "premium_yearly",
  "status": "active",
  "source": "revenuecat",
  "expiresAt": 1798761600000,
  "updatedAt": 1767225600000
}
```

Deploy the rules in `docs/firestore.rules`. The browser can read only its own entitlement; only a server using Firebase Admin credentials may create or change it.

### Required server environment variables

```text
REVENUECAT_WEBHOOK_AUTHORIZATION=<long-random-value>
REVENUECAT_WEBHOOK_SIGNING_SECRET=<RevenueCat-HMAC-secret>
REVENUECAT_PREMIUM_MONTHLY_PRODUCT_ID=<Stripe-product-id>
REVENUECAT_PREMIUM_YEARLY_PRODUCT_ID=<Stripe-product-id>
REVENUECAT_PREMIUM_LIFETIME_PRODUCT_ID=<Stripe-product-id>
FIREBASE_ADMIN_PROJECT_ID=<Firebase-project-id>
FIREBASE_ADMIN_CLIENT_EMAIL=<service-account-email>
FIREBASE_ADMIN_PRIVATE_KEY=<service-account-private-key-with-escaped-newlines>
```

In RevenueCat, add a webhook for both `SANDBOX` and `PRODUCTION`, enable HMAC signing, and set the same authorization value. Filter for lifecycle events, including `INITIAL_PURCHASE`, `RENEWAL`, `PRODUCT_CHANGE`, `UNCANCELLATION`, `EXPIRATION`, and `REFUND`.

Never expose the webhook signing secret, the RevenueCat secret key, Stripe secret keys, or Firebase Admin credentials to the browser or commit them to Git.

## Test sequence

1. Create a Sandbox Purchase Link in RevenueCat and set the sandbox URL template in the hosting environment.
2. Sign in to Lingo. The app automatically appends the Firebase user ID to the checkout URL.
3. Select a package and use Stripe's sandbox test card `4242 4242 4242 4242`.
4. Confirm the RevenueCat webhook arrives with `environment: SANDBOX`.
5. Reload Lingo. The `premium` entitlement should unlock unlimited learning and A2/B1.
6. Repeat for a cancellation and expiration/refund event before enabling production.

## Android / Google Play

For an Android app distributed through Google Play, Premium subscriptions and the lifetime product are digital products. Configure them with Google Play Billing and RevenueCat. Give RevenueCat the same Firebase UID as its App User ID and let the same verified webhook update `userEntitlements`. Do not link to Stripe checkout from the Play-distributed Android app.

## Advertising later

Do not add interstitials within learning cards or multiple-choice feedback. If ads are introduced, prefer optional rewarded ads after a completed lesson. Before enabling AdMob in the EEA, implement consent collection and a persistent privacy-options entry point; keep ad SDK initialization behind the consent flow.
