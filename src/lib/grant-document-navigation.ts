import type { ReviewDocument } from "./review-domain";

export type DocumentPopup = {
  location: { replace: (url: string) => void };
  opener: unknown;
  close: () => void;
};
type DocumentBrowser = {
  open: (url: string, target: string, features?: string) => DocumentPopup | null;
};

// Supporting documents never navigate away from the current application URL.
// Open the private-document window during the click, before awaiting its signed URL.
export async function openGrantDocument(
  document: ReviewDocument,
  applicationId: string,
  browser: DocumentBrowser,
  sign: (path: string) => Promise<string>,
) {
  if (document.url) {
    const url = document.url.startsWith("/practice-document?")
      ? `/practice-document?${new URLSearchParams({
          kind:
            new URL(document.url, "https://portal.invalid").searchParams.get("kind") ??
            "lara_documentation",
          applicationId,
        })}`
      : document.url;
    browser.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  if (!document.storagePath) throw new Error("No document link is available.");
  const popup = browser.open("about:blank", "_blank");
  if (!popup) throw new Error("Allow document pop-ups for this portal, then try again.");
  popup.opener = null;
  try {
    popup.location.replace(await sign(document.storagePath));
  } catch (error) {
    popup.close();
    throw error;
  }
}
