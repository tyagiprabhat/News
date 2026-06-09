export function buildSummarizePrompt(
  title: string,
  snippet: string | undefined,
  source: string,
  targetLanguage?: string,
): string {
  const langInstruction =
    targetLanguage && targetLanguage.toLowerCase() !== 'english'
      ? `Write the summary directly in ${targetLanguage} — do not write in English first.`
      : 'Write in English.';

  return `Write a punchy, engaging 60-word news summary in InShorts style. Start directly with the most important fact — no "this article says", no fluff. Be factual and vivid. Aim for exactly 60 words. ${langInstruction}

Source: ${source}
Headline: ${title}
${snippet ? `Content: ${snippet}` : ''}`;
}
