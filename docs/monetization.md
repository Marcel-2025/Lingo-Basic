# Lingo monetization

## Product model

Lingo starts without ads. Free users receive A1 and 20 learning steps per day. Premium subscribers receive unlimited learning plus A2 and B1. A separate one-time `ad_free_lifetime` product only removes future optional advertising; it does not unlock Premium content.

| Product | Entitlement plan | Platform |
| --- | --- | --- |
| Premium monthly | `premium_monthly` | Stripe web checkout / Google Play subscription |
| Premium yearly | `premium_yearly` | Stripe web checkout / Google Play subscription |
| Ad-free forever | `ad_free_lifetime` | Stripe web checkout / Google Play one-time product |

## Secure entitlement flow

The client never writes a Premium flag. A verified billing backend writes this Firestore document:

`userEntitlements/{firebaseUid}`

```json
{
  "plan": "premium_yearly",
  "status": "active",
  "source": "stripe",
  "expiresAt": 1798761600000,
  "updatedAt": 1767225600000
}
```

Allowed values:

- `plan`: `free`, `premium_monthly`, `premium_yearly`, `ad_free_lifetime`
- `status`: `active`, `trialing`, `cancelled`, `expired`, `unknown`
- `source`: `none`, `stripe`, `google_play`, `revenuecat`

Deploy the rules in `docs/firestore.rules`. The browser can read only its own entitlement; only a server using Firebase Admin credentials may create or change it.

## Stripe web checkout

1. Create monthly, yearly and one-time products in Stripe.
2. Create a protected server-side Stripe webhook. It must verify Stripe's webhook signature, identify the matching Firebase user, and update `userEntitlements/{uid}` with Firebase Admin SDK credentials.
3. Configure these public Payment Link URLs in the hosting provider only after the webhook is live:

```text
NEXT_PUBLIC_BILLING_ENABLED=true
NEXT_PUBLIC_STRIPE_PREMIUM_MONTHLY_CHECKOUT_URL=
NEXT_PUBLIC_STRIPE_PREMIUM_YEARLY_CHECKOUT_URL=
NEXT_PUBLIC_STRIPE_AD_FREE_LIFETIME_CHECKOUT_URL=
```

Never expose `STRIPE_SECRET_KEY`, Firebase Admin credentials or webhook secrets to the browser or commit them to Git.

## Android / Google Play

For an Android app distributed through Google Play, Premium subscriptions and the ad-free purchase are digital products. Configure them with Google Play Billing (or a provider such as RevenueCat that verifies Google Play purchases) and let its verified server webhook write the same entitlement document. Do not link to Stripe checkout from the Play-distributed Android app.

The current UI intentionally does not initiate an Android purchase until Google Play Billing or RevenueCat is connected. This avoids charging users before verified entitlements are available.

## Advertising later

Do not add interstitials within learning cards or multiple-choice feedback. If ads are introduced, prefer optional rewarded ads after a completed lesson. Before enabling AdMob in the EEA, implement consent collection and a persistent privacy-options entry point; keep ad SDK initialization behind the consent flow.
