import { Hono } from 'hono';
import { z } from 'zod';
import { getSupabaseClient } from '../lib/supabase';
import type { AppContextEnv } from '../types';

const DEFAULT_CATEGORIES: Array<{ name: string; color: string; icon: string }> = [
  { name: 'Alimentação', color: '#F97316', icon: 'utensils' },
  { name: 'Transporte', color: '#3B82F6', icon: 'car' },
  { name: 'Educação', color: '#8B5CF6', icon: 'graduation-cap' },
  { name: 'Lazer', color: '#EC4899', icon: 'party-popper' },
  { name: 'Saúde', color: '#EF4444', icon: 'heart-pulse' },
  { name: 'Moradia', color: '#EAB308', icon: 'home' },
  { name: 'Outros', color: '#64748B', icon: 'circle-ellipsis' },
];

interface ProfileRow {
  user_id: string;
  email: string;
  display_name: string;
  theme: 'light' | 'dark' | 'system';
  created_at: string;
}

interface CategoryRow {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  is_default: boolean | number;
  created_at: string;
}

function mapProfile(row: ProfileRow) {
  return {
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    theme: row.theme,
    createdAt: row.created_at,
  };
}

function mapCategory(row: CategoryRow) {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at,
  };
}

function extractDisplayName(metadata: Record<string, unknown>, email: string): string {
  const candidates = [metadata.display_name, metadata.full_name, metadata.name];
  for (const val of candidates) {
    if (typeof val === 'string' && val.trim().length > 0) {
      return val.trim().slice(0, 80);
    }
  }
  if (email && email.includes('@')) {
    return email.split('@')[0].slice(0, 80);
  }
  return 'Usuário';
}

const updateMeSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, 'Informe um nome de exibição.')
      .max(80, 'O nome de exibição deve ter no máximo 80 caracteres.')
      .optional(),
    theme: z
      .enum(['light', 'dark', 'system'], {
        message: 'Tema inválido. Use light, dark ou system.',
      })
      .optional(),
  })
  .refine((data) => data.displayName !== undefined || data.theme !== undefined, {
    message: 'Informe ao menos um campo para atualizar.',
  });

export const meRoutes = new Hono<AppContextEnv>();

meRoutes.get('/me', async (c) => {
  const userId = c.get('userId');
  const email = c.get('userEmail');
  const metadata = c.get('userMetadata');
  const supabase = getSupabaseClient(c);
  const now = new Date().toISOString();
  const initialName = extractDisplayName(metadata, email);

  const { data: existingProfile, error: profileFetchErr } = await supabase
    .from('profiles')
    .select('user_id, email, display_name, theme, created_at')
    .eq('user_id', userId)
    .maybeSingle<ProfileRow>();

  if (profileFetchErr) {
    console.error('[Me Profile Fetch Error]', profileFetchErr.code);
    return c.json({ error: 'Não foi possível carregar o perfil do usuário.' }, 500);
  }

  let profileRow = existingProfile;

  if (!profileRow) {
    const { data: insertedProfile, error: insertErr } = await supabase
      .from('profiles')
      .upsert(
        {
          user_id: userId,
          email,
          display_name: initialName,
          theme: 'dark',
          created_at: now,
        },
        { onConflict: 'user_id' }
      )
      .select('user_id, email, display_name, theme, created_at')
      .single<ProfileRow>();

    if (insertErr || !insertedProfile) {
      console.error('[Me Profile Upsert Error]', insertErr?.code);
      return c.json({ error: 'Não foi possível carregar o perfil do usuário.' }, 500);
    }
    profileRow = insertedProfile;
  } else if (profileRow.email !== email || !profileRow.display_name) {
    const nextName = profileRow.display_name || initialName;
    const { data: updatedProfile } = await supabase
      .from('profiles')
      .update({ email, display_name: nextName })
      .eq('user_id', userId)
      .select('user_id, email, display_name, theme, created_at')
      .single<ProfileRow>();

    if (updatedProfile) {
      profileRow = updatedProfile;
    }
  }

  const { count: categoryCount, error: countErr } = await supabase
    .from('categories')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (countErr) {
    console.error('[Me Categories Count Error]', countErr.code);
    return c.json({ error: 'Não foi possível carregar as categorias.' }, 500);
  }

  if ((categoryCount ?? 0) === 0) {
    const seedRows = DEFAULT_CATEGORIES.map((cat) => ({
      id: crypto.randomUUID(),
      user_id: userId,
      name: cat.name,
      color: cat.color,
      icon: cat.icon,
      is_default: true,
      created_at: now,
    }));

    const { error: seedErr } = await supabase.from('categories').insert(seedRows);
    if (seedErr && seedErr.code !== '23505') {
      console.error('[Me Categories Seed Error]', seedErr.code);
      return c.json({ error: 'Não foi possível inicializar suas categorias.' }, 500);
    }
  }

  const { data: categoriesRows, error: catListErr } = await supabase
    .from('categories')
    .select('id, user_id, name, color, icon, is_default, created_at')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })
    .order('name', { ascending: true })
    .returns<CategoryRow[]>();

  if (catListErr) {
    console.error('[Me Categories List Error]', catListErr.code);
    return c.json({ error: 'Não foi possível carregar as categorias.' }, 500);
  }

  return c.json({
    profile: mapProfile(profileRow),
    categories: (categoriesRows ?? []).map(mapCategory),
    receiptsEnabled: c.env.RECEIPTS_ENABLED === 'true' && Boolean(c.env.RECEIPTS),
  });
});

meRoutes.put('/me', async (c) => {
  const userId = c.get('userId');
  const email = c.get('userEmail');
  const metadata = c.get('userMetadata');
  const supabase = getSupabaseClient(c);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Corpo da requisição inválido.' }, 400);
  }

  const parsed = updateMeSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Dados inválidos.';
    return c.json({ error: firstError }, 400);
  }

  const { displayName, theme } = parsed.data;
  const now = new Date().toISOString();
  const fallbackName = extractDisplayName(metadata, email);

  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('user_id, display_name, theme')
    .eq('user_id', userId)
    .maybeSingle<Pick<ProfileRow, 'user_id' | 'display_name' | 'theme'>>();

  if (!existingProfile) {
    const { data: created, error: createErr } = await supabase
      .from('profiles')
      .upsert(
        {
          user_id: userId,
          email,
          display_name: displayName ?? fallbackName,
          theme: theme ?? 'dark',
          created_at: now,
        },
        { onConflict: 'user_id' }
      )
      .select('user_id, email, display_name, theme, created_at')
      .single<ProfileRow>();

    if (createErr || !created) {
      console.error('[Me Update Upsert Error]', createErr?.code);
      return c.json({ error: 'Não foi possível salvar o perfil.' }, 500);
    }
    return c.json({ profile: mapProfile(created) });
  }

  const updateFields: Partial<Pick<ProfileRow, 'display_name' | 'theme'>> = {};
  if (displayName !== undefined) updateFields.display_name = displayName;
  if (theme !== undefined) updateFields.theme = theme;

  const { data: updated, error: updateErr } = await supabase
    .from('profiles')
    .update(updateFields)
    .eq('user_id', userId)
    .select('user_id, email, display_name, theme, created_at')
    .single<ProfileRow>();

  if (updateErr || !updated) {
    console.error('[Me Update Error]', updateErr?.code);
    return c.json({ error: 'Perfil não encontrado.' }, 404);
  }

  return c.json({ profile: mapProfile(updated) });
});
