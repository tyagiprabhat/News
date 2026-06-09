export function buildTranslatePrompt(text: string, targetLanguage: string, sourceLanguage?: string): string {
  const from = sourceLanguage ? `from ${sourceLanguage} ` : '';
  return `Translate the following news text ${from}into ${targetLanguage}. Preserve proper nouns, place names, and organization names. Return only the translation, no notes or explanations.\n\n${text}`;
}
