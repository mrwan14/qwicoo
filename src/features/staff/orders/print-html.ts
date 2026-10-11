/** Print an HTML document via a hidden iframe so the POS page does not navigate away. */

/** Resolves when the previous print iframe has been fully cleaned up. */
let printTail: Promise<void> = Promise.resolve();

/**
 * Opens the browser print dialog for an HTML document.
 * Resolves once `print()` has been called (dialog open). The iframe stays mounted
 * until the dialog closes — removing it earlier makes Chrome flash “Loading preview…”.
 */
export function printHtmlInIframe(html: string): Promise<void> {
  let resolveOpened!: () => void;
  let rejectOpened!: (error: Error) => void;
  const opened = new Promise<void>((resolve, reject) => {
    resolveOpened = resolve;
    rejectOpened = reject;
  });

  const closed = printTail.then(() => runPrintJob(html, resolveOpened, rejectOpened));
  printTail = closed.then(
    () => undefined,
    () => undefined,
  );

  return opened;
}

function runPrintJob(
  html: string,
  onOpened: () => void,
  onFailed: (error: Error) => void,
): Promise<void> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") {
      onFailed(new Error("Printing is only available in the browser"));
      resolve();
      return;
    }

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.setAttribute("title", "Print");
    // Off-screen with real size. opacity:0 / 0×0 / z-index:-1 break Chromium preview.
    iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:80mm;height:1200px;border:0;margin:0;padding:0;";

    let settled = false;
    let printTimer = 0;
    let opened = false;

    const cleanup = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(fallbackTimer);
      window.clearTimeout(printTimer);
      URL.revokeObjectURL(url);
      iframe.remove();
      resolve();
    };

    // Safety net if afterprint never fires (some engines when saving to PDF).
    const fallbackTimer = window.setTimeout(cleanup, 120_000);

    iframe.addEventListener(
      "load",
      () => {
        const win = iframe.contentWindow;
        if (!win) {
          onFailed(new Error("Could not open print frame"));
          cleanup();
          return;
        }

        win.addEventListener("afterprint", cleanup, { once: true });

        printTimer = window.setTimeout(() => {
          try {
            win.focus();
            win.print();
            opened = true;
            onOpened();
          } catch {
            onFailed(new Error("Could not open the print dialog"));
            cleanup();
          }
        }, 150);
      },
      { once: true },
    );

    iframe.addEventListener(
      "error",
      () => {
        onFailed(new Error("Could not load print frame"));
        cleanup();
      },
      { once: true },
    );

    document.body.appendChild(iframe);
    iframe.src = url;

    // If load never fires, fail rather than hang the POS.
    window.setTimeout(() => {
      if (!opened && !settled) {
        onFailed(new Error("Print preview timed out"));
        cleanup();
      }
    }, 10_000);
  });
}
