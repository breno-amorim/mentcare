-- MentCare (#18): bloqueio da conta após 3 senhas erradas, NO SERVIDOR.
--
-- Usa o "Password Verification Hook" do Supabase Auth, que só pode ser ativado nos planos
-- Team e Enterprise. No plano Free este arquivo NÃO deve ser aplicado como migração; ele fica
-- pronto para quando o projeto mudar de plano.
-- Ativação: rodar este SQL e depois Authentication > Auth Hooks > Password Verification Attempt
-- apontando para public.hook_password_verification_attempt.
--
-- Por que no servidor: um contador só na tela é contornado chamando a API de login direto.

create table if not exists public.auth_login_attempts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  failures int not null default 0,
  locked_until timestamptz
);

create or replace function public.hook_password_verification_attempt(event jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := (event ->> 'user_id')::uuid;
  v_valid boolean := (event ->> 'valid')::boolean;
  v_row public.auth_login_attempts;
  v_failures int;
  c_max int := 3;
  c_lock interval := interval '15 minutes';
  c_msg text := 'Conta bloqueada por segurança após 3 senhas erradas. Tente novamente em 15 minutos.';
begin
  select * into v_row from public.auth_login_attempts where user_id = v_user for update;

  -- Bloqueada: recusa até a senha correta.
  if v_row.locked_until is not null and v_row.locked_until > now() then
    return jsonb_build_object('decision', 'reject', 'message', c_msg, 'should_logout_user', false);
  end if;

  if v_valid then
    delete from public.auth_login_attempts where user_id = v_user;
    return jsonb_build_object('decision', 'continue');
  end if;

  -- Bloqueio vencido volta a contar do zero.
  v_failures := case when v_row.locked_until is not null then 1 else coalesce(v_row.failures, 0) + 1 end;

  insert into public.auth_login_attempts (user_id, failures, locked_until)
  values (v_user, v_failures, case when v_failures >= c_max then now() + c_lock end)
  on conflict (user_id) do update
    set failures = excluded.failures, locked_until = excluded.locked_until;

  if v_failures >= c_max then
    return jsonb_build_object('decision', 'reject', 'message', c_msg, 'should_logout_user', false);
  end if;
  return jsonb_build_object('decision', 'continue');
end
$$;

-- Só o serviço de Auth usa a tabela e a função; clientes nunca.
-- RLS ligado (o projeto liga automaticamente) e o supabase_auth_admin NÃO ignora RLS:
-- sem esta política o gancho não conseguiria ler nem gravar as tentativas.
alter table public.auth_login_attempts enable row level security;
drop policy if exists auth_admin_manages_attempts on public.auth_login_attempts;
create policy auth_admin_manages_attempts on public.auth_login_attempts
  for all to supabase_auth_admin
  using (true) with check (true);
revoke all on table public.auth_login_attempts from public, anon, authenticated;
grant all on table public.auth_login_attempts to supabase_auth_admin;
revoke all on function public.hook_password_verification_attempt(jsonb) from public, anon, authenticated;
grant execute on function public.hook_password_verification_attempt(jsonb) to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;
