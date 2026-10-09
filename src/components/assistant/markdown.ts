/** Escape HTML, then bold, lists, and breaks. Never leaves raw HTML or stray `**`. */

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inlineMarkdown(escaped: string): string {
  const bold = escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  return bold.replace(/\*\*/g, "");
}

/** Returns safe HTML for an assistant answer body. */
export function renderAssistantMarkdown(raw: string): string {
  const escaped = escapeHtml(raw);
  const lines = escaped.split(/\r?\n/);
  const parts: string[] = [];
  let list: string[] = [];

  function flushList() {
    if (list.length === 0) return;
    parts.push(`<ul>${list.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`);
    list = [];
  }

  for (const line of lines) {
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      list.push(bullet[1] ?? "");
      continue;
    }
    flushList();
    if (line.trim() === "") {
      parts.push("<br />");
      continue;
    }
    parts.push(`<p>${inlineMarkdown(line)}</p>`);
  }
  flushList();
  return parts.join("");
}
