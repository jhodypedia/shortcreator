import { isMotionReduced } from "@/lib/device-performance";

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void | Promise<void>) => { finished: Promise<void> };
};

export function navigateWithViewTransition(href: string) {
  const doc = document as ViewTransitionDocument;
  if (isMotionReduced() || !window.matchMedia("(pointer:fine)").matches || !doc.startViewTransition) {
    window.location.assign(href);
    return;
  }
  doc.startViewTransition(() => window.location.assign(href));
}
