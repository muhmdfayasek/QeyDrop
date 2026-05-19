import { createClient } from '@supabase/supabase-js'
import {
  LATEST_COLLECTION_LIMIT,
  SEARCH_RESULT_LIMIT,
  escapeIlikeValue,
  validateSearchQuery,
} from './search'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
  )
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '')

const baseCollectionQuery = () =>
  supabase
    .from('collections')
    .select(
      `
        id,
        keyword,
        created_at,
        links (
          id,
          collection_id,
          label,
          url
        )
      `,
    )

export const fetchLatestCollections = async ({ signal } = {}) => {
  const query = baseCollectionQuery()
  query.abortSignal?.(signal)

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(LATEST_COLLECTION_LIMIT)

  if (error) {
    throw error
  }

  return data ?? []
}

export const searchCollections = async (keyword, { signal } = {}) => {
  const validatedQuery = validateSearchQuery(keyword)

  if (validatedQuery.status !== 'valid') {
    return []
  }

  const query = baseCollectionQuery()
  query.abortSignal?.(signal)

  const { data, error } = await query
    .ilike('keyword', `%${escapeIlikeValue(validatedQuery.value)}%`)
    .order('created_at', { ascending: false })
    .limit(SEARCH_RESULT_LIMIT)

  if (error) {
    throw error
  }

  return data ?? []
}
