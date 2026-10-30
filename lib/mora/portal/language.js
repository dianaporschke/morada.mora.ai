/** A preference, never an authority or a request to translate customer evidence. */
export function portalLanguageInstructions(value='de'){
 const language={de:'German (Switzerland; use ss instead of ß)',en:'English',fr:'French'}[value]||'German (Switzerland; use ss instead of ß)';
 return `Preferred portal language: ${language}. Write the conversational reply in this language unless the customer explicitly requests a different language; honour that language request. This preference applies also to reply repairs. Keep all safety rules, capability limits, source quotes, record IDs and original customer facts unchanged. Evidence quotes must remain exact copies in their original language. Use the established canonical equipment IDs where applicable; never translate a source quote. Language choice never changes access rights.`;
}
