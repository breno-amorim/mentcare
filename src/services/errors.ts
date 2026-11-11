/** Erro de regra de negócio com mensagem segura para exibir ao usuário. */
export class AppError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AppError'
  }
}

export const errorMessage = (e: unknown): string =>
  e instanceof AppError || e instanceof Error ? e.message : 'Algo deu errado. Tente novamente.'

/** Erro ligado a um campo específico do formulário (destacado em vermelho). */
export class FieldError extends AppError {
  readonly field: string
  constructor(field: string, message: string) {
    super(message)
    this.field = field
    this.name = 'FieldError'
  }
}
