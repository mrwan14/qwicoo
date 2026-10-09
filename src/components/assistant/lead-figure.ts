export type LeadFigure = { figure: string; summary: string };

const EGP = /\bEGP\s*[\d,]+(?:\.\d+)?\b|\b[\d,]+(?:\.\d+)?\s*EGP\b/i;
const STANDALONE = /\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b|\b\d+(?:\.\d+)?\b/;

/** First EGP amount, or a standalone number, pulled out as the lead figure. */
export function extractLeadFigure(text: string): LeadFigure | null {
  const match = text.match(EGP) ?? text.match(STANDALONE);
  if (!match || match.index == null) return null;
  const figure = match[0].trim();
  const summary = `${text.slice(0, match.index)}${text.slice(match.index + match[0].length)}`
    .replace(/\s+/g, " ")
    .replace(/^[:\-–,.\s]+|[:\-–,.\s]+$/g, "")
    .trim();
  if (!summary) return null;
  return { figure, summary };
}
