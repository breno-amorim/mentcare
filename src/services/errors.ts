/** Erro de regra de negócio com mensagem segura para exibir ao usuário. */
export class AppError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AppError'
  }
}

export const errorMessage = (e: unknown): string =>
  e instanceof AppError || e instanceof Error ? e.message : 'Algo deu errado. Tente novamente.'
