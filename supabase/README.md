# Banco de dados (Supabase)

Migrações SQL do MentCare. **O banco só muda por estes arquivos**, nunca por cliques soltos no painel,
para que tudo fique versionado e revisável.

## Como aplicar (SQL Editor do Supabase)

1. Painel do projeto > **SQL Editor** > **New query**.
2. Cole e execute, **nesta ordem**, o conteúdo de cada arquivo em `migrations/`:
   1. `20261110000001_schema.sql` (tabelas, índices, imutabilidade do prontuário)
   2. `20261110000002_functions.sql` (cadastro, agendamento, prontuário, avaliações)
   3. `20261110000003_rls.sql` (RLS e permissões)
3. Em **Table Editor**, confirme que todas as tabelas aparecem com RLS ligado.
4. Em **Database > Advisors**, rode os verificadores de segurança e corrija o que aparecer.

## Como funciona a hierarquia

| Papel          | Como é obtido                                                        | Pode                                                                               |
| -------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `patient`      | Todo cadastro público                                                | Agendar, cancelar/remarcar (24h), ler o próprio prontuário, avaliar                |
| `professional` | Promovido por um gestor (função de servidor) ou pelo dono do projeto | Agenda própria, registrar evolução e adendos nas próprias consultas                |
| `manager`      | Promovido pelo dono do projeto                                       | Administrar só a própria clínica, profissionais e horários. **Não lê prontuários** |

O papel **nunca** vem do navegador nem dos metadados do cadastro. Um usuário logado não consegue
alterar o próprio papel, clínica ou especialidade (permissão de coluna + gatilho).

## Criando o primeiro gestor (uma vez)

1. **Authentication > Users > Add user**: crie o e-mail do gestor (marque "Auto Confirm User").
2. No SQL Editor (roda como dono do projeto, então pode promover contas):

```sql
update public.profiles
set role = 'manager'
where id = (select id from auth.users where email = 'gestor@exemplo.com');
```

3. Ao entrar, o gestor cadastra a clínica pelo app (função `create_clinic`).

## Promovendo um profissional (provisório, até existir o convite por e-mail)

```sql
update public.profiles
set role = 'professional', clinic_id = '<id da clínica>', specialty = 'Psicologia'
where id = (select id from auth.users where email = 'profissional@exemplo.com');
```

O fluxo definitivo será um convite por e-mail feito por uma Edge Function (a única que usa a
`service_role`, guardada só nos segredos do Supabase).

## Bloqueio após 3 senhas erradas (#18)

| Onde                  | Como funciona                                                                               | Estado                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Modo demonstração     | `src/services/auth.ts`: 3 senhas erradas bloqueiam o e-mail por 15 minutos                  | Ativo                                                                  |
| Supabase (servidor)   | `optional/password_lockout_hook.sql`: gancho _Password Verification Hook_ com a mesma regra | **Pronto, não ativado**: o gancho só existe nos planos Team/Enterprise |
| Supabase (plano Free) | Limite de tentativas por IP do próprio Supabase Auth; o app mostra "Muitas tentativas"      | Ativo                                                                  |

O bloqueio precisa ser no servidor: um contador só na tela é contornado chamando a API de login
direto. Enquanto o projeto estiver no plano Free, a proteção por conta não existe no Supabase; para
reforçar sem mudar de plano, ative **CAPTCHA** em Authentication > Attack Protection.

Para ativar (plano Team+): rode `optional/password_lockout_hook.sql` no SQL Editor e, em
Authentication > Auth Hooks, aponte _Password Verification Attempt_ para
`public.hook_password_verification_attempt`.

## Testes

`supabase/tests/rls.test.ts` aplica as migrações num Postgres real (PGlite) e verifica as políticas
simulando cada papel, inclusive tentativas de ataque (escalonamento de privilégio, leitura cruzada de
prontuário, alteração de registros clínicos, agendamento fora das regras).

```bash
npm test
```

## LGPD (pendente)

Dados de saúde são dados sensíveis. Antes de uso com dados reais: base legal e consentimento, política de
retenção e exclusão, trilha de auditoria de acessos ao prontuário e revisão jurídica. Os registros clínicos
são imutáveis por desenho, então pedidos de exclusão precisam de um procedimento próprio.
