import type { AppLocale } from "../../../shared/locale";
import { intlLocale } from "../../i18n";

export function formatMoney(amountMinor: number, currency: string, locale: AppLocale): string {
  try {
    return new Intl.NumberFormat(intlLocale(locale), {
      style: "currency",
      currency,
      maximumFractionDigits: 0
    }).format(amountMinor);
  } catch {
    return `${amountMinor.toLocaleString(intlLocale(locale))} ${currency}`;
  }
}
