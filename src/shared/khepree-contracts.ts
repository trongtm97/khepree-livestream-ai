import type { LivestreamPlanSlug } from "./khepree-catalog";

export type FeatureValue =
  | { valueType: "boolean"; booleanValue: boolean }
  | { valueType: "integer"; integerValue: number }
  | { valueType: "string"; stringValue: string };

export interface SignedLease {
  payload: {
    version: 1;
    jti: string;
    subject: string;
    licenseId: string;
    entitlementId: string;
    productId: string;
    productSlug: string;
    plan: string;
    deviceId: string;
    featureSnapshotVersion: number;
    features: Record<string, FeatureValue>;
    iat: number;
    exp: number;
  };
  signature: string;
  keyId: string;
}

export interface DesktopAuthExchangeResponse {
  sessionPublicId: string;
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
  devicePublicId?: string;
  user?: { publicId: string; email: string; name: string };
  lease?: SignedLease;
  entitlement?: DesktopEntitlementSummary | null;
}

export interface DesktopRefreshResponse {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
  lease?: SignedLease;
}

export interface DesktopEntitlementSummary {
  entitlementPublicId: string;
  productSlug: string | null;
  planSlug: string | null;
  status: string;
  expiresAt: string | null;
  features: Array<{ key: string; value: FeatureValue }>;
}

export interface DesktopMeResponse {
  sessionPublicId: string;
  user: { publicId: string; email: string; name: string };
  client: { clientId: string; displayName: string; productSlug: string | null; status: string };
  product?: { productId: string; slug: string | null };
  entitlement: DesktopEntitlementSummary | null;
  plan?: {
    planPublicId: string | null;
    planSlug: string | null;
    name: string;
    billingType: string;
    accessTermDays: number | null;
    accessTermLabel: string;
  } | null;
  device: { devicePublicId: string; status: string } | null;
  billing?: {
    hasActiveSubscription: boolean;
    checkoutAvailable: boolean;
    pendingPayment: boolean;
    accessTermLabel?: string | null;
  };
  allowedActions?: {
    checkout: boolean;
    upgrade: boolean;
    manageDevices: boolean;
    refreshEntitlement: boolean;
  };
  urls?: {
    manageDevices: string;
    accountBilling: string;
    checkout?: string;
  };
}

export interface DesktopPurchasablePlan {
  planPublicId: string;
  pricePublicId: string;
  planSlug: string | null;
  name: string;
  priceAmount: number;
  currency: string;
  accessTermLabel: string;
  isCurrent: boolean;
  isUpgradeAvailable: boolean;
}

export interface DesktopPlansResponse {
  currentPlanId: string | null;
  plans: DesktopPurchasablePlan[];
}

export interface DesktopCheckoutCreateResponse {
  checkoutPublicId: string;
  handoffUrl: string;
  status: string;
}

export interface DesktopActivateResponse {
  lease?: SignedLease;
  devicePublicId?: string;
  entitlement?: DesktopEntitlementSummary;
  features?: Array<{ key: string; value: FeatureValue }>;
}

export type KhepreeAccessStatus =
  | "BOOTING"
  | "AUTH_REQUIRED"
  | "VALIDATING_SESSION"
  | "ACTIVE"
  | "ENTITLEMENT_MISSING"
  | "ENTITLEMENT_EXPIRED"
  | "ENTITLEMENT_SUSPENDED"
  | "DEVICE_REMOVED"
  | "DEVICE_BLOCKED"
  | "OFFLINE_COLD_START"
  | "ERROR";

export interface KhepreePublicState {
  status: KhepreeAccessStatus;
  user?: { name: string; email: string };
  planSlug?: string;
  productSlug?: string;
  productUrl?: string;
  features: Record<string, boolean | number | string>;
  offers?: DesktopPurchasablePlan[];
  catalogHint?: Array<{
    slug: LivestreamPlanSlug;
    nameVi: string;
    amountMinor: number;
    currency: string;
    accessTermDays: number;
  }>;
  checkoutAvailable?: boolean;
  message?: string;
}
