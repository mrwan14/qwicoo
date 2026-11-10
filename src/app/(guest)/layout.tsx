import type { ReactNode } from "react";

import { GuestDocumentFonts } from "@/features/guest/document-fonts";
import { guestFontClassName } from "@/features/guest/guest-fonts";

/** Guest-route fonts only — IBM Plex Sans and IBM Plex Sans Arabic. Does not affect staff or landing. */
export default function GuestLayout({ children }: { children: ReactNode }) {
  return <GuestDocumentFonts className={guestFontClassName}>{children}</GuestDocumentFonts>;
}
