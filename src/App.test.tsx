import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HashRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { AuthProvider } from './app/AuthContext'
import { ToastProvider } from './app/ToastContext'
import { getBackend, setBackend } from './data/backend'
import { createMemoryBackend } from './data/memoryBackend'
import { clearSnapshot } from './data/snapshot'
import { resetDb } from './services/store'

function renderApp() {
  return render(
    <HashRouter>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </HashRouter>,
  )
}

async function signIn(email: string, password = 'mentcare123') {
  const user = userEvent.setup()
  renderApp()
  await user.type(await screen.findByLabelText('E-mail'), email)
  await user.type(screen.getByLabelText('Senha'), password)
  await user.click(screen.getByRole('button', { name: /entrar na plataforma/i }))
  return user
}

/** Clica num item do menu lateral (evita ambiguidade com links duplicados na página). */
async function goTo(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  const nav = await screen.findByRole('navigation', { name: 'Menu principal' })
  await user.click(within(nav).getByRole('link', { name }))
}

beforeEach(() => {
  setBackend(createMemoryBackend())
  clearSnapshot()
  resetDb()
})

describe('acesso', () => {
  it('mostra erro genérico para senha incorreta e não entra', async () => {
    await signIn('mariana@email.com', 'senha-errada')
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha inválidos.')
    expect(screen.queryByText(/Olá, Mariana/)).not.toBeInTheDocument()
  })

  it('cadastra paciente com CPF válido e já entra logado', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(await screen.findByRole('tab', { name: 'Criar conta' }))
    await user.type(screen.getByLabelText('Nome completo'), 'João Teste')
    await user.type(screen.getByLabelText('CPF'), '390.533.447-05')
    await user.type(screen.getByLabelText('Data de nascimento'), '1990-05-20')
    await user.type(screen.getByLabelText('E-mail'), 'joao.teste@email.com')
    await user.type(screen.getByLabelText(/^Senha$/), 'Senha-forte-1')
    await user.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(await screen.findByText(/Olá, João/)).toBeInTheDocument()
  })

  it('rejeita CPF inválido no cadastro', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(await screen.findByRole('tab', { name: 'Criar conta' }))
    await user.type(screen.getByLabelText('Nome completo'), 'João Teste')
    await user.type(screen.getByLabelText('CPF'), '111.111.111-11')
    await user.type(screen.getByLabelText('Data de nascimento'), '1990-05-20')
    await user.type(screen.getByLabelText('E-mail'), 'joao.teste@email.com')
    await user.type(screen.getByLabelText(/^Senha$/), 'Senha-forte-1')
    await user.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(await screen.findByText(/dígitos verificadores/)).toBeInTheDocument()
    expect(screen.getByLabelText('CPF')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Nome completo')).toHaveAttribute('aria-invalid', 'false')
  })

  it('destaca em vermelho todos os campos errados e o que falta na senha', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(await screen.findByRole('tab', { name: 'Criar conta' }))
    await user.type(screen.getByLabelText(/^Senha$/), 'fraca')
    await user.clear(screen.getByLabelText('Cidade'))
    await user.click(screen.getByRole('button', { name: 'Criar conta' }))
    for (const label of ['Nome completo', 'CPF', 'Data de nascimento', 'E-mail', 'Cidade']) {
      expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true')
    }
    expect(screen.getByText(/A senha precisa de: 8 ou mais caracteres/)).toBeInTheDocument()
    // Ao corrigir um campo, o vermelho dele some.
    await user.type(screen.getByLabelText('Cidade'), 'Santos')
    expect(screen.getByLabelText('Cidade')).toHaveAttribute('aria-invalid', 'false')
  })
})

describe('T4 · e-mail inválido é recusado na hora (#17)', () => {
  it('marca o campo em vermelho ao sair dele, antes de tentar entrar', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(await screen.findByLabelText('E-mail'), 'mariana@email')
    await user.tab()
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('E-mail inválido. Use o formato nome@dominio.com.')).toBeInTheDocument()
  })

  it('não consulta o servidor quando o e-mail é inválido', async () => {
    const signIn = vi.spyOn(getBackend(), 'signIn')
    const user = userEvent.setup()
    renderApp()
    await user.type(await screen.findByLabelText('E-mail'), 'mariana@')
    await user.type(screen.getByLabelText('Senha'), 'mentcare123')
    await user.click(screen.getByRole('button', { name: /entrar na plataforma/i }))
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true')
    expect(signIn).not.toHaveBeenCalled()
    expect(screen.queryByText(/Olá, Mariana/)).not.toBeInTheDocument()
  })

  it('o vermelho some ao corrigir e o login funciona', async () => {
    const user = userEvent.setup()
    renderApp()
    const email = await screen.findByLabelText('E-mail')
    await user.type(email, 'mariana@email')
    await user.tab()
    expect(email).toHaveAttribute('aria-invalid', 'true')
    await user.type(email, '.com')
    expect(email).toHaveAttribute('aria-invalid', 'false')
    await user.type(screen.getByLabelText('Senha'), 'mentcare123')
    await user.click(screen.getByRole('button', { name: /entrar na plataforma/i }))
    expect(await screen.findByText(/Olá, Mariana/)).toBeInTheDocument()
  })
})

describe('T5 · bloqueio após 3 senhas erradas na tela (#18)', () => {
  it('mostra as tentativas restantes e, na 3ª, o bloqueio; nem a senha certa entra', async () => {
    const user = userEvent.setup()
    renderApp()
    const email = await screen.findByLabelText('E-mail')
    const password = screen.getByLabelText('Senha')
    const submit = screen.getByRole('button', { name: /entrar na plataforma/i })
    await user.type(email, 'mariana@email.com')

    for (const [tentativa, esperado] of [
      ['errada-1', /Restam 2/],
      ['errada-2', /Restam 1/],
      ['errada-3', /Conta bloqueada/],
    ] as const) {
      await user.clear(password)
      await user.type(password, tentativa)
      await user.click(submit)
      expect(await screen.findByRole('alert')).toHaveTextContent(esperado)
    }

    await user.clear(password)
    await user.type(password, 'mentcare123')
    await user.click(submit)
    expect(await screen.findByRole('alert')).toHaveTextContent(/Conta bloqueada/)
    expect(screen.queryByText(/Olá, Mariana/)).not.toBeInTheDocument()
  })
})

describe('paciente', () => {
  it('busca uma clínica e agenda uma consulta', async () => {
    const user = await signIn('mariana@email.com')
    expect(await screen.findByText(/Olá, Mariana/)).toBeInTheDocument()

    await goTo(user, /Buscar clínicas/)
    expect(await screen.findByText('Clínica Bem Viver')).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Ver horários' })[0]!)
    await user.click(screen.getByRole('button', { name: 'Confirmar agendamento' }))

    expect(await screen.findByText('Histórico de consultas')).toBeInTheDocument()
    expect(screen.getAllByText('Agendada')).toHaveLength(2)
    expect(screen.getByText('Consulta agendada com sucesso!')).toBeInTheDocument()
  })

  it('filtra por SUS e mostra só clínicas que aceitam SUS', async () => {
    const user = await signIn('mariana@email.com')
    await goTo(user, /Buscar clínicas/)
    await user.clear(screen.getByLabelText('Cidade'))
    await user.selectOptions(screen.getByLabelText('Convênio / modalidade'), 'SUS')
    await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
    expect(screen.getByText('Instituto Horizonte')).toBeInTheDocument()
    expect(screen.getByText('Espaço Acolher')).toBeInTheDocument()
    expect(screen.queryByText('Clínica Bem Viver')).not.toBeInTheDocument()
  })

  it('não acessa rotas de outro perfil', async () => {
    await signIn('mariana@email.com')
    await screen.findByText(/Olá, Mariana/)
    window.location.hash = '#/agenda'
    await waitFor(() => expect(window.location.hash).toBe('#/'))
    expect(screen.getByRole('navigation', { name: 'Menu principal' })).toHaveTextContent(
      'Buscar clínicas',
    )
    expect(screen.queryByText('Agenda de atendimentos')).not.toBeInTheDocument()
  })
})

describe('profissional', () => {
  it('registra a evolução e a consulta passa a realizada', async () => {
    const user = await signIn('ana@mentcare.com')
    await goTo(user, /Minha agenda/)
    await user.click(await screen.findByRole('button', { name: 'Registrar evolução' }))
    await user.type(
      screen.getByLabelText('Evolução / observações clínicas'),
      'Paciente colaborativa, boa adesão.',
    )
    await user.click(screen.getByRole('button', { name: 'Salvar registro' }))
    expect(
      await screen.findByText('Evolução registrada e consulta marcada como realizada.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar evolução' })).not.toBeInTheDocument()
  })

  it('adiciona adendo sem alterar o registro original', async () => {
    const user = await signIn('ana@mentcare.com')
    await goTo(user, /Prontuários/)
    const original = await screen.findByText(/Primeira sessão \(dado fictício\)/)
    await user.click(screen.getByRole('button', { name: 'Adicionar adendo' }))
    await user.type(screen.getByLabelText('Complemento datado'), 'Retorno agendado.')
    await user.click(screen.getByRole('button', { name: 'Salvar adendo' }))
    expect(await screen.findByText('Retorno agendado.')).toBeInTheDocument()
    expect(original).toBeInTheDocument()
  })

  it('profissional de outra clínica não vê o prontuário da Ana', async () => {
    await signIn('rafael@mentcare.com')
    await userEvent.click(await screen.findByRole('link', { name: /Prontuários/ }))
    expect(await screen.findByText('Nenhum registro disponível')).toBeInTheDocument()
  })
})

describe('gestor', () => {
  it('cadastra profissional com senha própria', async () => {
    const user = await signIn('gestao@mentcare.com')
    await goTo(user, /Profissionais/)
    await user.click(await screen.findByRole('button', { name: '+ Adicionar profissional' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText('Nome completo'), 'Carla Nunes')
    await user.type(within(dialog).getByLabelText('E-mail'), 'carla@mentcare.com')
    await user.type(within(dialog).getByLabelText(/Senha inicial/), 'senha-forte-1')
    await user.click(within(dialog).getByRole('button', { name: 'Cadastrar' }))
    expect(await screen.findByText('Carla Nunes')).toBeInTheDocument()
  })

  it('gestor não vê prontuários', async () => {
    await signIn('gestao@mentcare.com')
    await screen.findByText('Painel da clínica')
    expect(screen.queryByRole('link', { name: /Prontuário/ })).not.toBeInTheDocument()
  })
})
