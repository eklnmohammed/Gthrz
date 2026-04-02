import { spacing } from "@/src/theme/spacing";

/** Horizontal padding for hero + form columns — source of truth for Create/Edit event screens. */
export const EVENT_FORM_HERO_PADDING_H = spacing.xxl;

/** Rounded corners on the square cover card. */
export const EVENT_FORM_HERO_RADIUS = 24;

/** Extra scroll padding above sticky footer (matches primary button area). */
export const EVENT_FORM_SCROLL_BOTTOM_EXTRA = 100;

export function eventFormScrollPaddingBottom(ctaBottom: number): number {
  return EVENT_FORM_SCROLL_BOTTOM_EXTRA + ctaBottom;
}
