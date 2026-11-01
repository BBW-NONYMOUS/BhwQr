-- =============================================================================
-- Rotation of the profile encryption key (docs/phase-2-architecture/04-operations-and-security.md §3).
-- Procedure (SQL editor, as postgres):
--   1. select vault.create_secret('<new 32-byte base64 key>', 'profile_encryption_key_next');
--   2. select public.rotate_profile_encryption_key('profile_encryption_key_next');
--      -> re-encrypts every contact number / address with the new key and makes it current
--         (the old value is replaced in 'profile_encryption_key'; the temporary secret is removed).
-- Runs in one transaction: if anything fails, nothing changes.
-- =============================================================================

create or replace function public.rotate_profile_encryption_key(p_new_secret_name text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old text := public.pii_key();
  v_new text;
  v_count int;
  v_current_id uuid;
begin
  select ds.decrypted_secret into v_new from vault.decrypted_secrets ds where ds.name = p_new_secret_name;
  if v_new is null then
    raise exception 'Vault secret % not found', p_new_secret_name;
  end if;
  if v_new = v_old then
    raise exception 'The new key is the same as the current key';
  end if;

  perform public.set_audit_context('rotate_profile_encryption_key');
  update public.profiles
  set contact_number_enc = case when contact_number_enc is null then null
        else extensions.pgp_sym_encrypt(extensions.pgp_sym_decrypt(contact_number_enc, v_old), v_new, 'cipher-algo=aes256') end,
      address_enc = case when address_enc is null then null
        else extensions.pgp_sym_encrypt(extensions.pgp_sym_decrypt(address_enc, v_old), v_new, 'cipher-algo=aes256') end
  where contact_number_enc is not null or address_enc is not null;
  get diagnostics v_count = row_count;

  select s.id into v_current_id from vault.secrets s where s.name = 'profile_encryption_key';
  perform vault.update_secret(v_current_id, v_new);
  delete from vault.secrets where name = p_new_secret_name;

  return v_count;
end;
$$;

revoke all on function public.rotate_profile_encryption_key(text) from public, anon, authenticated;
