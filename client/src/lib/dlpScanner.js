/**
 * Client-Side Data Loss Prevention (DLP) Secret Scanner
 * Scans input text before client-side AES-256 encryption to prevent
 * accidental leakage of sensitive keys, tokens, or PII into chat channels.
 */

const SECRET_PATTERNS = [
  {
    name: "AWS Access Key",
    regex: /\b(AKIA[0-9A-Z]{16})\b/g,
    replacement: "[REDACTED_AWS_KEY]"
  },
  {
    name: "Generic API Key / Token",
    regex: /\b(sk_live_[0-9a-zA-Z]{24,32}|sk_test_[0-9a-zA-Z]{24,32}|ghp_[0-9a-zA-Z]{36}|glpat-[0-9a-zA-Z\-]{20,})\b/g,
    replacement: "[REDACTED_API_TOKEN]"
  },
  {
    name: "RSA / Private Key",
    regex: /-----BEGIN (RSA|EC|OPENSSH|PRIVATE) KEY-----[\s\S]*?-----END \1 KEY-----/g,
    replacement: "[REDACTED_PRIVATE_KEY]"
  },
  {
    name: "JWT Token",
    regex: /\beyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*\b/g,
    replacement: "[REDACTED_JWT_TOKEN]"
  },
  {
    name: "Database Connection URI",
    regex: /\b(mongodb(\+srv)?|postgres|postgresql|mysql):\/\/[^\s"']+/g,
    replacement: "[REDACTED_DB_URI]"
  }
];

/**
 * High-entropy string detector for unidentified arbitrary secret tokens
 */
function isHighEntropyToken(str) {
  if (str.length < 24 || str.includes(' ')) return false;
  // Calculate Shannon entropy
  const charCounts = {};
  for (const char of str) {
    charCounts[char] = (charCounts[char] || 0) + 1;
  }
  let entropy = 0;
  for (const char in charCounts) {
    const p = charCounts[char] / str.length;
    entropy -= p * Math.log2(p);
  }
  // Standard English text has entropy ~3.5-4.5. High-entropy random tokens are > 4.7
  return entropy > 4.75;
}

/**
 * Main scan function
 * @param {string} text - User input string
 * @returns { object } { hasSecrets: boolean, findings: Array, cleanText: string }
 */
export function scanForSecrets(text) {
  if (!text || typeof text !== 'string') {
    return { hasSecrets: false, findings: [], cleanText: text || '' };
  }

  const findings = [];
  let cleanText = text;

  // 1. Scan against predefined regex rules
  for (const pattern of SECRET_PATTERNS) {
    const matches = text.match(pattern.regex);
    if (matches) {
      matches.forEach(match => {
        findings.push({
          type: pattern.name,
          match: match,
          replacement: pattern.replacement
        });
      });
      cleanText = cleanText.replace(pattern.regex, pattern.replacement);
    }
  }

  // 2. Scan words for high-entropy tokens if not already caught
  const words = text.split(/\s+/);
  for (const word of words) {
    const cleanWord = word.replace(/[^a-zA-Z0-9_\-\.\=\+]/g, '');
    if (cleanWord.length >= 24 && isHighEntropyToken(cleanWord)) {
      const alreadyFound = findings.some(f => f.match.includes(cleanWord));
      if (!alreadyFound) {
        findings.push({
          type: "High-Entropy Secret Token",
          match: cleanWord,
          replacement: "[REDACTED_SECRET]"
        });
        cleanText = cleanText.replace(cleanWord, "[REDACTED_SECRET]");
      }
    }
  }

  return {
    hasSecrets: findings.length > 0,
    findings,
    cleanText
  };
}
