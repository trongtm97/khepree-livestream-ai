import { createHash, randomUUID } from "node:crypto";
import type {
  DesktopActivateResponse,
  DesktopAuthExchangeResponse,
  DesktopCheckoutCreateResponse,
  DesktopMeResponse,
  DesktopPlansResponse,
  DesktopRefreshResponse
} from "../../shared/khepree-contracts";
import { DeviceIdentityService } from "./device-identity-service";

export class KhepreeApiClient {
  constructor(
    private readonly apiBase: string,
    private readonly deviceIdentity: DeviceIdentityService
  ) {}

  async exchange(input: {
    clientId: string;
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<DesktopAuthExchangeResponse> {
    return this.json("/desktop/auth/exchange", {
      method: "POST",
      body: {
        ...input,
        installationId: this.deviceIdentity.installationId,
        devicePublicKey: this.deviceIdentity.publicKeyPem,
        platform: process.platform
      }
    });
  }

  async refresh(sessionPublicId: string, refreshToken: string): Promise<DesktopRefreshResponse> {
    const path = "/desktop/auth/refresh";
    const body = { sessionPublicId, refreshToken };
    return this.json(path, {
      method: "POST",
      body: {
        ...body,
        deviceProof: this.buildProof("POST", path, body)
      }
    });
  }

  async activate(input: {
    clientId: string;
    accessToken: string;
    appVersion?: string;
  }): Promise<DesktopActivateResponse> {
    return this.json("/desktop/activate", {
      method: "POST",
      accessToken: input.accessToken,
      body: {
        clientId: input.clientId,
        installationId: this.deviceIdentity.installationId,
        devicePublicKey: this.deviceIdentity.publicKeyPem,
        platform: process.platform,
        appVersion: input.appVersion
      }
    });
  }

  async me(accessToken: string): Promise<DesktopMeResponse> {
    return this.json("/desktop/me", {
      method: "GET",
      accessToken
    });
  }

  async listPlans(accessToken: string, clientId: string, locale = "vi"): Promise<DesktopPlansResponse> {
    const qs = new URLSearchParams({ clientId, locale });
    return this.json(`/desktop/plans?${qs.toString()}`, {
      method: "GET",
      accessToken
    });
  }

  async createCheckout(input: {
    accessToken: string;
    clientId: string;
    planPublicId: string;
    pricePublicId: string;
    locale?: string;
  }): Promise<DesktopCheckoutCreateResponse> {
    return this.json("/desktop/checkout", {
      method: "POST",
      accessToken: input.accessToken,
      body: {
        clientId: input.clientId,
        planPublicId: input.planPublicId,
        pricePublicId: input.pricePublicId,
        locale: input.locale ?? "vi"
      }
    });
  }

  async checkoutStatus(
    accessToken: string,
    checkoutPublicId: string
  ): Promise<{ checkoutPublicId: string; status: string; orderStatus: string }> {
    return this.json(`/desktop/checkout/${encodeURIComponent(checkoutPublicId)}/status`, {
      method: "GET",
      accessToken
    });
  }

  async heartbeat(sessionPublicId: string, accessToken: string): Promise<{ state: string }> {
    const path = "/desktop/heartbeat";
    const body = { sessionPublicId };
    return this.json(path, {
      method: "POST",
      accessToken,
      body: {
        ...body,
        deviceProof: this.buildProof("POST", path, body)
      }
    });
  }

  async logout(sessionPublicId: string, accessToken: string): Promise<void> {
    await this.json("/desktop/auth/logout", {
      method: "POST",
      accessToken,
      body: { sessionPublicId }
    }).catch(() => undefined);
  }

  private buildProof(method: string, path: string, body: unknown) {
    const bodyJson = JSON.stringify(body);
    const timestamp = Date.now();
    const nonce = randomUUID();
    const bodySha256 = createHash("sha256").update(bodyJson).digest("hex");
    const canonical = [timestamp, nonce, method, path, bodySha256].join("\n");
    return {
      timestamp,
      nonce,
      signature: this.deviceIdentity.signCanonical(canonical),
      method,
      path,
      bodySha256
    };
  }

  private async json<T>(
    path: string,
    opts: { method: string; body?: unknown; accessToken?: string }
  ): Promise<T> {
    const res = await fetch(`${this.apiBase}${path}`, {
      method: opts.method,
      headers: {
        "content-type": "application/json",
        ...(opts.accessToken ? { authorization: `Bearer ${opts.accessToken}` } : {})
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
    });
    const text = await res.text();
    const raw = text ? JSON.parse(text) : {};
    if (!res.ok) {
      const code = raw?.error?.code ?? `HTTP_${res.status}`;
      throw new Error(code);
    }
    // Khepree API wraps success payloads as { data, meta }.
    return (raw && typeof raw === "object" && "data" in raw ? raw.data : raw) as T;
  }
}
