/** Mantém apenas os dígitos do CPF. */
export function normalizeCpf(value: string): string {
  return value.replace(/\D/g, '')
}

function checkDigit(digits: string, length: number): number {
  let sum = 0
  for (let i = 0; i < length; i++) {
    sum += Number(digits[i]) * (length + 1 - i)
  }
  const rest = (sum * 10) % 11
  return rest === 10 ? 0 : rest
}

/** Valida CPF (formato e dígitos verificadores). Aceita com ou sem máscara. */
export function isValidCpf(value: string): boolean {
  const cpf = normalizeCpf(value)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  return checkDigit(cpf, 9) === Number(cpf[9]) && checkDigit(cpf, 10) === Number(cpf[10])
}
