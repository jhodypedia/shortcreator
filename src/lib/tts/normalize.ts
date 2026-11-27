const numberWords = ["nol", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan"];
export function normalizeIndonesianSpeech(text: string): string {
  return text
    .replace(/\b(\d{1,2})\b/g, (digits) => digits.split("").map((digit) => numberWords[Number(digit)]).join(" "))
    .replace(/\b(Rp)\.?\s*(\d+)/gi, (_, _rp: string, amount: string) => `rupiah ${amount.split("").map((digit: string) => numberWords[Number(digit)]).join(" ")}`)
    .replace(/\b(dr|drs|prof|sd|smp|sma)\./gi, (match) => ({ "dr.": "dokter", "drs.": "sarjana", "prof.": "profesor", "sd.": "es de", "smp.": "es em pe", "sma.": "es em a" }[match.toLowerCase()] ?? match))
    .replace(/\s+/g, " ").replace(/\s+([,.!?])/g, "$1").trim();
}

export function splitNaturalChunks(text: string, maxChars = 450): string[] {
  const sentences = text.match(/[^.!?]+[.!?]*/g)?.map((part) => part.trim()).filter(Boolean) ?? [text];
  const result: string[] = []; let current = "";
  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      const words = sentence.split(/\s+/);
      for (const word of words) { if (`${current} ${word}`.trim().length > maxChars && current) { result.push(current.trim()); current = ""; } current += `${word} `; }
    } else if (`${current} ${sentence}`.trim().length > maxChars && current) { result.push(current.trim()); current = `${sentence} `; }
    else current += `${sentence} `;
  }
  if (current.trim()) result.push(current.trim());
  return result;
}
