# MentCare

Plataforma web de acompanhamento psicológico que conecta pacientes a clínicas e hospitais (rede privada e SUS/CAPS), com busca por convênio, agendamento online e prontuário eletrônico compartilhado.

## Elevator pitch

Para **pacientes que precisam de acompanhamento psicológico** e não sabem onde encontrar atendimento que aceite seu convênio ou que seja pelo SUS, o **MentCare** é uma **plataforma web de saúde mental** que reúne busca de clínicas, agendamentos e prontuário em um só lugar. Diferente de **ligar clínica por clínica e carregar o histórico em papel ou em sistemas isolados**, o nosso **mostra na hora quem atende o paciente e mantém o histórico acessível ao paciente e ao profissional que o acompanha**.

## Problema

- O paciente perde tempo ligando para várias clínicas para descobrir se aceitam seu convênio, se atendem pelo SUS e se têm horário.
- O histórico de acompanhamento fica espalhado: ao trocar de profissional ou clínica, o paciente recomeça do zero.
- Clínicas e hospitais não têm um canal simples para receber agendamentos e acompanhar a satisfação dos pacientes.

## Público (tipos de usuário)

| Papel                 | Quem é                                                                              |
| --------------------- | ----------------------------------------------------------------------------------- |
| **Paciente**          | Pessoa que busca ou já faz acompanhamento psicológico/psiquiátrico                  |
| **Profissional**      | Psicólogo ou psiquiatra vinculado a uma clínica, que atende e registra o prontuário |
| **Gestor da clínica** | Responsável pelo cadastro da clínica/hospital, convênios aceitos e profissionais    |

## Proposta de valor

O paciente encontra atendimento compatível com seu convênio em minutos e leva seu histórico com ele.

## Funcionalidades essenciais (Must)

1. Busca de clínicas filtrando por convênio, particular ou SUS
2. Agendamento de consulta online com profissional da clínica
3. Prontuário eletrônico: profissional registra a evolução de cada sessão

## Fora de escopo (Won't — este semestre)

- Teleconsulta por vídeo
- Integração real com sistemas do SUS (e-SUS, CNES) — dados de clínicas SUS serão cadastrados manualmente
- Pagamento dentro da plataforma (comissão e assinatura B2B ficam só no modelo de negócio)
- Prescrição digital de medicamentos
- Aplicativo mobile nativo (será web responsivo)

## Indicadores de sucesso

- Paciente conclui um agendamento (busca → confirmação) em **até 3 minutos** em teste com usuários.
- **80%** das consultas realizadas na Review têm registro de evolução no prontuário.

## Equipe

| Integrante           | Papel Scrum              |
| -------------------- | ------------------------ |
| Breno Amorim Candido | Product Owner            |
| Fernando Albernaz    | Scrum Master e Developer |
| Gabriel Muniz Sodre  | Developer                |

## Matriz RACI

R = Responsável · A = Aprovador · C = Consultado · I = Informado

| Atividade                            | PO (Breno) | Scrum Master (Fernando) | Developers (Fernando, Gabriel) | Professor |
| ------------------------------------ | ---------- | ----------------------- | ------------------------------ | --------- |
| Definir visão e objetivo do produto  | A / R      | C                       | C                              | I         |
| Escrever e ordenar o Product Backlog | A / R      | C                       | C                              | I         |
| Escrever critérios de aceite         | A          | I                       | R                              | I         |
| Estimar itens (Planning Poker)       | C          | R (facilita)            | A / R                          | I         |
| Definir o escopo da sprint           | C          | C                       | A / R                          | I         |
| Implementar e testar                 | I          | I                       | A / R                          | I         |
| Revisar pull requests                | I          | I                       | A / R                          | C         |
| Aceitar o incremento na Review       | A          | I                       | R                              | C         |
| Avaliar a entrega (nota A2/A3)       | I          | I                       | I                              | A / R     |

> Como a equipe tem três pessoas, Fernando acumula Scrum Master e Developer. Breno (PO) não vota no Planning Poker.

## Escala de estimativa da equipe

| Pontos | Referência no MentCare                                         |
| ------ | -------------------------------------------------------------- |
| 2      | Listar as próximas consultas do paciente logado                |
| 3      | Cadastro de paciente com validação de CPF e e-mail             |
| 5      | Agendar consulta (tela + regra de horário + gravação no banco) |

## Definition of Done

- [ ] Critérios de aceite da história atendidos
- [ ] Código revisado em pull request por outro Developer
- [ ] Testes passando
- [ ] Sem bugs críticos abertos
- [ ] Issue movida para **Concluído** no quadro

## Backlog

As histórias estão nas [Issues](../../issues) e ordenadas no quadro do GitHub Projects (colunas: Backlog, Pronto para sprint, Em andamento, Em revisão, Concluído).

## Como rodar o projeto

Requisitos: [Node.js LTS](https://nodejs.org) (v22 ou superior).

```bash
npm install        # instala dependências
npm run dev        # servidor de desenvolvimento em http://localhost:5173
npm test           # testes (Vitest)
npm run typecheck  # checagem de tipos (TypeScript strict)
npm run lint       # lint (oxlint)
npm run build      # build de produção em dist/
```

### Estrutura

```
src/domain/   regras puras e testadas (CPF, política de 24h, datas locais)
legacy/       protótipo V1 em HTML único (referência; rodar com python legacy/serve.py)
```

Stack: React + TypeScript (strict) + Vite + Vitest. Backend planejado: Supabase (Auth, Postgres, Row Level Security).
