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

/** Formata enquanto digita: 52998224725 -> 529.982.247-25 (aceita entrada parcial). */
export function formatCpf(value: string): string {
  const d = normalizeCpf(value).slice(0, 11)
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}
