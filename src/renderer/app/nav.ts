import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Clapperboard,
  LayoutDashboard,
  MessageCircle,
  Mic2,
  Package,
  Plug,
  Radio,
  ScrollText,
  Settings
} from "lucide-react";
import type { MessageKey } from "../i18n";
import type { AppTab } from "./types";

export type NavItem = {
  id: AppTab;
  icon: LucideIcon;
  labelKey: MessageKey;
  headerKey: MessageKey;
  /** When true, page explains the feature but does not pretend it works. */
  comingSoon: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  {
    id: "overview",
    icon: LayoutDashboard,
    labelKey: "nav.overview",
    headerKey: "header.overview",
    comingSoon: false
  },
  {
    id: "live",
    icon: Radio,
    labelKey: "nav.live",
    headerKey: "header.live",
    comingSoon: false
  },
  {
    id: "comments",
    icon: MessageCircle,
    labelKey: "nav.comments",
    headerKey: "header.comments",
    comingSoon: false
  },
  {
    id: "products",
    icon: Package,
    labelKey: "nav.products",
    headerKey: "header.products",
    comingSoon: false
  },
  {
    id: "script",
    icon: Clapperboard,
    labelKey: "nav.script",
    headerKey: "header.script",
    comingSoon: true
  },
  {
    id: "avatar",
    icon: Mic2,
    labelKey: "nav.avatar",
    headerKey: "header.avatar",
    comingSoon: true
  },
  {
    id: "connections",
    icon: Plug,
    labelKey: "nav.connections",
    headerKey: "header.connections",
    comingSoon: false
  },
  {
    id: "history",
    icon: ScrollText,
    labelKey: "nav.history",
    headerKey: "header.history",
    comingSoon: false
  },
  {
    id: "settings",
    icon: Settings,
    labelKey: "nav.settings",
    headerKey: "header.settings",
    comingSoon: false
  },
  {
    id: "help",
    icon: BookOpen,
    labelKey: "nav.help",
    headerKey: "header.help",
    comingSoon: false
  }
];

export function getNavItem(tab: AppTab): NavItem {
  return NAV_ITEMS.find((item) => item.id === tab) ?? NAV_ITEMS[0]!;
}
