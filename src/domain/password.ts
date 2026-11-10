export const MIN_PASSWORD_LENGTH = 8
const ITERATIONS = 100_000

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
const fromHex = (hex: string) =>
  Uint8Array.from(hex.match(/.{2}/g) ?? [], (h) => Number.parseInt(h, 16))

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) {
    throw new Error(
      'Este navegador precisa de contexto seguro (HTTPS ou localhost) para proteger senhas.',
    )
  }
  const key = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    256,
  )
  return toHex(new Uint8Array(bits))
}

/** Formato: pbkdf2$<iterações>$<salt hex>$<hash hex> (salt aleatório por senha). */
export async function hashPassword(password: string): Promise<string> {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16))
  return `pbkdf2$${ITERATIONS}$${toHex(salt)}$${await derive(password, salt, ITERATIONS)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterations, salt, hash] = stored.split('$')
  if (scheme !== 'pbkdf2' || !iterations || !salt || !hash) return false
  const candidate = await derive(password, fromHex(salt), Number(iterations))
  return timingSafeEqual(candidate, hash)
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export function validatePassword(password: string): string | null {
  return password.length >= MIN_PASSWORD_LENGTH
    ? null
    : `A senha precisa ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`
}
