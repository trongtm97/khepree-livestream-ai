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
}

export interface DesktopRefreshResponse {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
  lease?: SignedLease;
}

export interface DesktopMeResponse {
  sessionPublicId: string;
  user: { publicId: string; email: string; name: string };
  client: { clientId: string; displayName: string; productSlug: string | null; status: string };
  entitlement: {
    entitlementPublicId: string;
    productSlug: string | null;
    planSlug: string | null;
    status: string;
    expiresAt: string | null;
    features: Array<{ key: string; value: FeatureValue }>;
  } | null;
  device: { devicePublicId: string; status: string } | null;
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
  features: Record<string, boolean | number | string>;
  message?: string;
}
