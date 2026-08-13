/**
 * Client-Side Message Translator Engine
 * Translates decrypted E2EE message payloads into target user languages.
 */

const SAMPLE_TRANSLATIONS = {
  es: {
    "Hello": "Hola",
    "Welcome": "Bienvenido",
    "How are you?": "¿Cómo estás?",
    "Ok": "De acuerdo",
    "Thanks": "Gracias"
  },
  fr: {
    "Hello": "Bonjour",
    "Welcome": "Bienvenue",
    "How are you?": "Comment allez-vous?",
    "Ok": "D'accord",
    "Thanks": "Merci"
  },
  hi: {
    "Hello": "नमस्ते",
    "Welcome": "स्वागत है",
    "How are you?": "आप कैसे हैं?",
    "Ok": "ठीक है",
    "Thanks": "धन्यवाद"
  }
};

/**
 * Translates message text to target language code (e.g., 'es', 'fr', 'hi', 'de')
 * @param {string} text 
 * @param {string} targetLang 
 * @returns {Promise<string>}
 */
export async function translateText(text, targetLang = 'es') {
  if (!text || typeof text !== 'string') return text;

  // 1. Try public MyMemory Translation API with fallback
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=autodetect|${targetLang}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data && data.responseData && data.responseData.translatedText) {
        return data.responseData.translatedText;
      }
    }
  } catch (err) {
    console.warn("External translation API fallback triggered");
  }

  // 2. Fallback dictionary check
  if (SAMPLE_TRANSLATIONS[targetLang] && SAMPLE_TRANSLATIONS[targetLang][text]) {
    return SAMPLE_TRANSLATIONS[targetLang][text];
  }

  return `[${targetLang.toUpperCase()}] ${text}`;
}
