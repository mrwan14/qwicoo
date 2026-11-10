/** Public sales contact. Shown on the landing page and the legal pages. */
export const CONTACT = {
  phone: "01274005584",
  phoneDisplay: "0127 400 5584",
  phoneHref: "tel:+201274005584",
  email: "marwanabdelwahab9@gmail.com",
  whatsappNumber: "201274005584",
} as const;

export function whatsappHref(message: string): string {
  return `https://wa.me/${CONTACT.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

/** The hero's "Ask Qwicoo" button opens the floating chat through this window event. */
export const OPEN_ASSISTANT_EVENT = "qw:open-assistant";

export function landingPath(locale: "en" | "ar", hash = ""): string {
  return `/?lang=${locale}${hash}`;
}
