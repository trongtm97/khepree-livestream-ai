import { app } from "electron";
import { KHEPREE_LIVESTREAM_CATALOG } from "../../shared/khepree-catalog";

const PRODUCTION = {
  apiBase: "https://api.khepree.com/api/v1",
  accountBase: "https://account.khepree.com",
  website: "https://khepree.com",
  clientId: KHEPREE_LIVESTREAM_CATALOG.clientId,
  productSlug: KHEPREE_LIVESTREAM_CATALOG.productSlug,
  redirectUri: KHEPREE_LIVESTREAM_CATALOG.redirectUri,
  accessFeatureKey: KHEPREE_LIVESTREAM_CATALOG.accessFeatureKey,
  productPath: KHEPREE_LIVESTREAM_CATALOG.productPath
} as const;

export function getKhepreeConfig() {
  const packaged = app.isPackaged;
  return {
    ...PRODUCTION,
    apiBase: packaged ? PRODUCTION.apiBase : (process.env.KHEPREE_API_BASE ?? PRODUCTION.apiBase),
    accountBase: packaged ? PRODUCTION.accountBase : (process.env.KHEPREE_ACCOUNT_BASE ?? PRODUCTION.accountBase),
    website: packaged ? PRODUCTION.website : (process.env.KHEPREE_WEBSITE ?? PRODUCTION.website),
    clientId: packaged ? PRODUCTION.clientId : (process.env.KHEPREE_CLIENT_ID ?? PRODUCTION.clientId),
    productSlug: packaged ? PRODUCTION.productSlug : (process.env.KHEPREE_PRODUCT_SLUG ?? PRODUCTION.productSlug),
    signingPublicKey: process.env.KHEPREE_LICENSE_SIGNING_PUBLIC_KEY ?? "",
    signingKeyId: process.env.KHEPREE_LICENSE_SIGNING_KEY_ID ?? "k1",
    devMock: !packaged && process.env.KHEPREE_DEV_MOCK === "1"
  };
}

export function productPublicUrl(website: string, productPath: string): string {
  return `${website.replace(/\/$/, "")}${productPath}`;
}
