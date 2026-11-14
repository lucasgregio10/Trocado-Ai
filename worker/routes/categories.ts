import { Hono } from 'hono';
import { z } from 'zod';
import { getSupabaseClient } from '../lib/supabase';
import type { AppContextEnv } from '../types';

interface CategoryRow {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  is_default: boolean | number;
  created_at: string;
}

function mapCategoryRow(row: CategoryRow, expenseCount: number) {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at,
    expenseCount,
  };
}

const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida. Use o formato hexadecimal #RRGGBB.');

const createCategorySchema = z.object({
  name: z
    .string({ message: 'Informe o nome da categoria.' })
    .trim()
    .min(1, 'Informe o nome da categoria.')
    .max(40, 'O nome da categoria deve ter no máximo 40 caracteres.'),
  color: hexColorSchema.default('#10B981'),
  icon: z.string().trim().min(1).max(40).default('tag'),
});

const updateCategorySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'O nome da categoria não pode estar vazio.')
      .max(40, 'O nome da categoria deve ter no máximo 40 caracteres.')
      .optional(),
    color: hexColorSchema.optional(),
    icon: z.string().trim().min(1).max(40).optional(),
  })
  .refine((data) => data.name !== undefined || data.color !== undefined || data.icon !== undefined, {
    message: 'Informe ao menos um campo para atualizar.',
  });

export const categoriesRoutes = new Hono<AppContextEnv>();

categoriesRoutes.get('/categories', async (c) => {
  const userId = c.get('userId');
  const supabase = getSupabaseClient(c);

  const [catRes, expRes] = await Promise.all([
    supabase
      .from('categories')
      .select('id, user_id, name, color, icon, is_default, created_at')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true })
      .order('name', { ascending: true })
      .returns<CategoryRow[]>(),
    supabase
      .from('expenses')
      .select('category_id')
      .eq('user_id', userId)
      .returns<Array<{ category_id: string }>>(),
  ]);

  if (catRes.error || expRes.error) {
    console.error('[Categories List Error]', catRes.error?.code || expRes.error?.code);
    return c.json({ error: 'Não foi possível carregar as categorias.' }, 500);
  }

  const countMap = new Map<string, number>();
  for (const row of expRes.data ?? []) {
    countMap.set(row.category_id, (countMap.get(row.category_id) ?? 0) + 1);
  }

  return c.json({
    categories: (catRes.data ?? []).map((row) =>
      mapCategoryRow(row, countMap.get(row.id) ?? 0)
    ),
  });
});

categoriesRoutes.post('/categories', async (c) => {
  const userId = c.get('userId');
  const supabase = getSupabaseClient(c);

  let rawBody: unknown;
  try {
    rawBody = await c.req.json();
  } catch {
    return c.json({ error: 'Corpo da requisição inválido.' }, 400);
  }

  const parsed = createCategorySchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || 'Dados inválidos.' }, 400);
  }

  const { name, color, icon } = parsed.data;
  const normalizedName = name.trim().toLowerCase();

  const { data: existingCats, error: fetchErr } = await supabase
    .from('categories')
    .select('id, name')
    .eq('user_id', userId)
    .returns<Array<{ id: string; name: string }>>();

  if (fetchErr) {
    console.error('[Categories Duplicate Check Error]', fetchErr.code);
    return c.json({ error: 'Não foi possível criar a categoria.' }, 500);
  }

  if ((existingCats ?? []).some((cat) => cat.name.trim().toLowerCase() === normalizedName)) {
    return c.json({ error: 'Já existe uma categoria com este nome.' }, 409);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const { error: insertErr } = await supabase.from('categories').insert({
    id,
    user_id: userId,
    name,
    color,
    icon,
    is_default: false,
    created_at: now,
  });

  if (insertErr) {
    if (insertErr.code === '23505') {
      return c.json({ error: 'Já existe uma categoria com este nome.' }, 409);
    }
    console.error('[Categories Insert Error]', insertErr.code);
    return c.json({ error: 'Não foi possível criar a categoria.' }, 500);
  }

  return c.json(
    {
      category: {
        id,
        name,
        color,
        icon,
        isDefault: false,
        createdAt: now,
        expenseCount: 0,
      },
    },
    201
  );
});

categoriesRoutes.put('/categories/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const supabase = getSupabaseClient(c);

  const { data: existing, error: findErr } = await supabase
    .from('categories')
    .select('id, user_id, name, color, icon, is_default, created_at')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle<CategoryRow>();

  if (findErr) {
    console.error('[Category Find Error]', findErr.code);
    return c.json({ error: 'Não foi possível atualizar a categoria.' }, 500);
  }

  if (!existing) {
    return c.json({ error: 'Categoria não encontrada.' }, 404);
  }

  let rawBody: unknown;
  try {
    rawBody = await c.req.json();
  } catch {
    return c.json({ error: 'Corpo da requisição inválido.' }, 400);
  }

  const parsed = updateCategorySchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || 'Dados inválidos.' }, 400);
  }

  const nextName = parsed.data.name ?? existing.name;
  const nextColor = parsed.data.color ?? existing.color;
  const nextIcon = parsed.data.icon ?? existing.icon;

  if (parsed.data.name !== undefined) {
    const normalizedNext = nextName.trim().toLowerCase();
    const { data: userCats } = await supabase
      .from('categories')
      .select('id, name')
      .eq('user_id', userId)
      .neq('id', id)
      .returns<Array<{ id: string; name: string }>>();

    if ((userCats ?? []).some((cat) => cat.name.trim().toLowerCase() === normalizedNext)) {
      return c.json({ error: 'Já existe outra categoria com este nome.' }, 409);
    }
  }

  const { error: updateErr } = await supabase
    .from('categories')
    .update({ name: nextName, color: nextColor, icon: nextIcon })
    .eq('id', id)
    .eq('user_id', userId);

  if (updateErr) {
    if (updateErr.code === '23505') {
      return c.json({ error: 'Já existe outra categoria com este nome.' }, 409);
    }
    console.error('[Category Update Error]', updateErr.code);
    return c.json({ error: 'Não foi possível atualizar a categoria.' }, 500);
  }

  const { count } = await supabase
    .from('expenses')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('category_id', id);

  return c.json({
    category: {
      id: existing.id,
      name: nextName,
      color: nextColor,
      icon: nextIcon,
      isDefault: Boolean(existing.is_default),
      createdAt: existing.created_at,
      expenseCount: count ?? 0,
    },
  });
});

categoriesRoutes.delete('/categories/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const supabase = getSupabaseClient(c);

  const { data: existing, error: findErr } = await supabase
    .from('categories')
    .select('id, is_default')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle<{ id: string; is_default: boolean | number }>();

  if (findErr) {
    console.error('[Category Delete Lookup Error]', findErr.code);
    return c.json({ error: 'Não foi possível remover a categoria.' }, 500);
  }

  if (!existing) {
    return c.json({ error: 'Categoria não encontrada.' }, 404);
  }

  if (Boolean(existing.is_default)) {
    return c.json(
      { error: 'Categorias padrão não podem ser apagadas, apenas renomeadas.' },
      400
    );
  }

  let moveToId = c.req.query('moveTo')?.trim() || '';
  if (!moveToId) {
    try {
      const body = (await c.req.json()) as Record<string, unknown>;
      if (typeof body?.moveToCategoryId === 'string') {
        moveToId = body.moveToCategoryId.trim();
      } else if (typeof body?.moveTo === 'string') {
        moveToId = body.moveTo.trim();
      }
    } catch {
      // Optional body on DELETE
    }
  }

  const { count: expenseCountRaw, error: countErr } = await supabase
    .from('expenses')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('category_id', id);

  if (countErr) {
    console.error('[Category Delete Count Error]', countErr.code);
    return c.json({ error: 'Não foi possível verificar as despesas da categoria.' }, 500);
  }

  const expenseCount = expenseCountRaw ?? 0;

  if (expenseCount > 0) {
    if (!moveToId) {
      return c.json(
        {
          error:
            'Esta categoria possui despesas. Escolha outra categoria para mover essas despesas antes de apagar.',
          requiresMove: true,
          expenseCount,
        },
        409
      );
    }

    if (moveToId === id) {
      return c.json({ error: 'Escolha uma categoria diferente para mover as despesas.' }, 400);
    }

    const { data: targetCategory } = await supabase
      .from('categories')
      .select('id')
      .eq('id', moveToId)
      .eq('user_id', userId)
      .maybeSingle<{ id: string }>();

    if (!targetCategory) {
      return c.json({ error: 'Categoria de destino não encontrada.' }, 404);
    }

    const now = new Date().toISOString();
    const { error: moveErr } = await supabase
      .from('expenses')
      .update({ category_id: moveToId, updated_at: now })
      .eq('user_id', userId)
      .eq('category_id', id);

    if (moveErr) {
      console.error('[Category Move Expenses Error]', moveErr.code);
      return c.json({ error: 'Não foi possível mover as despesas da categoria.' }, 500);
    }

    await supabase.from('budgets').delete().eq('user_id', userId).eq('category_id', id);
    const { error: delErr } = await supabase
      .from('categories')
      .delete()
      .eq('user_id', userId)
      .eq('id', id);

    if (delErr) {
      console.error('[Category Delete Error]', delErr.code);
      return c.json({ error: 'Não foi possível remover a categoria.' }, 500);
    }

    return c.json({ ok: true, id, movedExpensesCount: expenseCount, movedTo: moveToId });
  }

  await supabase.from('budgets').delete().eq('user_id', userId).eq('category_id', id);
  const { error: delErr } = await supabase
    .from('categories')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);

  if (delErr) {
    console.error('[Category Delete Error]', delErr.code);
    return c.json({ error: 'Não foi possível remover a categoria.' }, 500);
  }

  return c.json({ ok: true, id, movedExpensesCount: 0 });
});
