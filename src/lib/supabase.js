import { createClient } from '@supabase/supabase-js'

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
          label,
          url
        )
      `,
    )

export const fetchLatestCollections = async () => {
  const { data, error } = await baseCollectionQuery()
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    throw error
  }

  return data ?? []
}

export const searchCollections = async (keyword) => {
  const normalizedKeyword = keyword.trim()

  if (!normalizedKeyword) {
    return []
  }

  const { data, error } = await baseCollectionQuery()
    .ilike('keyword', `%${normalizedKeyword}%`)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return data ?? []
}
