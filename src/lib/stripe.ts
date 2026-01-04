import Stripe from "stripe";

// Only initialize Stripe if the secret key is available
// This allows the app to build without Stripe configured
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-12-15.clover",
      typescript: true,
    })
  : null as unknown as Stripe;

// Price ID for the premium plan (400円/月)
export const PREMIUM_PRICE_ID = process.env.STRIPE_PREMIUM_PRICE_ID || "";

export const PLANS = {
  free: {
    name: "無料プラン",
    price: 0,
    features: [
      "口座3つまで",
      "基本的なレポート",
      "取引記録",
    ],
    limits: {
      accounts: 3,
    },
  },
  premium: {
    name: "プレミアム",
    price: 400,
    features: [
      "口座無制限",
      "すべてのレポート",
      "パートナー共有",
      "定期取引",
      "クイック入力",
    ],
    limits: {
      accounts: Infinity,
    },
  },
} as const;

export type PlanType = keyof typeof PLANS;
