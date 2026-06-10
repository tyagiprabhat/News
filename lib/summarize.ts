export function buildSummarizePrompt(
  title: string,
  snippet: string | undefined,
  source: string,
  targetLanguage?: string,
  wordCount = 60,
): string {
  const langInstruction =
    targetLanguage && targetLanguage.toLowerCase() !== 'english'
      ? `Write the summary directly in ${targetLanguage} — do not write in English first.`
      : 'Write in English.';

  return `Write a punchy, engaging ${wordCount}-word news summary in InShorts style. Start directly with the most important fact — no "this article says", no fluff. Be factual and vivid. Aim for exactly ${wordCount} words. ${langInstruction}

Source: ${source}
Headline: ${title}
${snippet ? `Content: ${snippet}` : ''}`;
}
