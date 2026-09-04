import { ShieldCheck } from "lucide-react";
import type { AppSnapshot } from "../../../shared/ipc";
import { useAppShell } from "../../app/AppShellContext";
import { labelKhepreeStatus, labelPlanSlug } from "../../i18n";
import { EmptyState } from "../common/EmptyState";
import { formatMoney } from "../common/formatMoney";
import { MicroHelp } from "../help/MicroHelp";

export function KhepreeLicensePanel({ snapshot }: { snapshot: AppSnapshot }) {
  const { t, locale, run } = useAppShell();
  const offers = snapshot.khepree.offers ?? [];
  const hints = snapshot.khepree.catalogHint ?? [];

  return (
    <div className="panel">
      <div className="panelHead">
        <div>
          <h2 className="headingWithHelp">
            <span>{t("setup.licenseTitle")}</span>
            <MicroHelp tipId="connections.khepree" />
          </h2>
          <p>{t("setup.licenseSubtitle")}</p>
        </div>
        <ShieldCheck />
      </div>
      <div className="statusBox">
        <strong>{labelKhepreeStatus(t, snapshot.khepree.status)}</strong>
        <span>
          {snapshot.khepree.user
            ? `${snapshot.khepree.user.name} · ${snapshot.khepree.user.email}`
            : t("setup.noSession")}
        </span>
        {snapshot.khepree.planSlug ? (
          <span>{t("setup.plan", { plan: labelPlanSlug(t, snapshot.khepree.planSlug) })}</span>
        ) : null}
        {snapshot.khepree.productSlug ? (
          <span>{t("setup.product", { product: snapshot.khepree.productSlug })}</span>
        ) : null}
      </div>
      <div className="row">
        {snapshot.khepree.status !== "ACTIVE" ? (
          <button
            className="primary"
            onClick={() => void run(() => window.khepreeLivestreamAI.startKhepreeLogin())}
          >
            {t("setup.connect")}
          </button>
        ) : (
          <button
            className="ghost"
            onClick={() => void run(() => window.khepreeLivestreamAI.logoutKhepree())}
          >
            {t("setup.signOut")}
          </button>
        )}
        <button
          className="ghost"
          onClick={() => void run(() => window.khepreeLivestreamAI.openKhepreeProductPage())}
        >
          {t("setup.productPage")}
        </button>
        <button
          className="ghost"
          onClick={() => void run(() => window.khepreeLivestreamAI.openKhepreeBilling())}
        >
          {t("setup.billing")}
        </button>
      </div>

      <div className="panelHead" style={{ marginTop: 16 }}>
        <div>
          <h3>{t("setup.plansTitle")}</h3>
          <p>{t("setup.plansSubtitle")}</p>
        </div>
      </div>
      {offers.length > 0 ? (
        <div className="queue">
          {offers.map((offer) => (
            <div className="productRow" key={`${offer.planPublicId}:${offer.pricePublicId}`}>
              <div>
                <strong>{offer.name}</strong>
                <span>
                  {formatMoney(offer.priceAmount, offer.currency, locale)} · {offer.accessTermLabel}
                  {offer.isCurrent ? ` · ${t("setup.currentPlan")}` : ""}
                </span>
              </div>
              {offer.isUpgradeAvailable && !offer.isCurrent ? (
                <button
                  className="primary small"
                  onClick={() =>
                    void run(() =>
                      window.khepreeLivestreamAI.startKhepreeCheckout(
                        offer.planPublicId,
                        offer.pricePublicId
                      )
                    )
                  }
                >
                  {t("setup.buy")}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="queue">
          {hints.map((hint) => (
            <div className="productRow" key={hint.slug}>
              <strong>{labelPlanSlug(t, hint.slug)}</strong>
              <span>
                {hint.amountMinor === 0
                  ? t("setup.free")
                  : formatMoney(hint.amountMinor, hint.currency, locale)}{" "}
                · {t("setup.days", { days: hint.accessTermDays })}
              </span>
            </div>
          ))}
          {snapshot.khepree.status !== "AUTH_REQUIRED" && snapshot.khepree.status !== "BOOTING" ? (
            <button
              className="ghost small"
              onClick={() => void run(() => window.khepreeLivestreamAI.refreshKhepreeOffers())}
            >
              {t("setup.reloadPlans")}
            </button>
          ) : (
            <EmptyState text={t("setup.loginToBuy")} />
          )}
        </div>
      )}
    </div>
  );
}
