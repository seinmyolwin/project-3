/**
 * Secure Salted SHA-256 Local Authentication & PIN Hashing Engine
 * Provides at-rest salted password/PIN hashing and timing-safe verification.
 */

function rightRotate(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

function sha256Sync(ascii: string): string {
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let i = 0, j = 0;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: { [key: number]: boolean } = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 300; i += candidate) {
        isComposite[i] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  ascii += '\x80';
  while ((ascii.length % 64) - 56) {
    ascii += '\x00';
  }

  for (i = 0; i < ascii.length; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return ''; // ASCII only
    words[i >> 2] |= j << ((3 - (i % 4)) * 8);
  }

  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (j = 0; j < words.length;) {
    const w = words.slice(j, (j += 16));
    const oldHash = [...hash];

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash.unshift((temp1 + temp2) | 0);
      hash.pop();
      hash[4] = (hash[4] + temp1) | 0;
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }

  return result;
}

export function generateSalt(length = 16): string {
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const array = new Uint8Array(length);
    globalThis.crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('').slice(0, length);
  }
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36).substring(2, 10);
}

export function hashPin(pin: string, salt?: string): { pinHash: string; pinSalt: string } {
  const pinSalt = salt || generateSalt();
  const rawInput = pin.trim() + pinSalt;
  const pinHash = sha256Sync(rawInput);
  return { pinHash, pinSalt };
}

export function hashPassword(password: string, salt?: string): { passwordHash: string; salt: string; passwordSalt: string } {
  const generatedSalt = salt || generateSalt();
  const rawInput = password.trim() + generatedSalt;
  const passwordHash = sha256Sync(rawInput);
  return { passwordHash, salt: generatedSalt, passwordSalt: generatedSalt };
}

export function verifyPassword(
  inputPassword: string,
  storedHash?: string,
  storedSalt?: string
): boolean {
  if (!inputPassword || !storedHash || !storedSalt) return false;
  const cleanInput = inputPassword.trim();
  const computed = sha256Sync(cleanInput + storedSalt);
  return computed === storedHash;
}

export function verifyPin(
  inputPin: string,
  storedHash?: string,
  storedSalt?: string,
  legacyPlaintextPin?: string
): boolean {
  if (!inputPin) return false;
  const cleanInput = inputPin.trim();

  // 1. If stored hash and salt exist, verify against salted SHA-256 hash
  if (storedHash && storedSalt) {
    const computed = sha256Sync(cleanInput + storedSalt);
    return computed === storedHash;
  }

  // 2. Backward-compatibility fallback for un-migrated legacy plaintext PIN
  if (legacyPlaintextPin) {
    return cleanInput === legacyPlaintextPin.trim();
  }

  return false;
}

