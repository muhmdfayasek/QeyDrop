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

const COLLECTION_SELECT = `
  id,
  keyword,
  created_at,
  links (
    id,
    collection_id,
    label,
    url
  )
`

const baseCollectionQuery = () =>
  supabase
    .from('collections')
    .select(COLLECTION_SELECT)

const withAbortSignal = (query, signal) => {
  query.abortSignal?.(signal)
  return query
}

const normalizeEmail = (value) => (value ?? '').trim().toLowerCase()

export const fetchLatestCollections = async ({ signal } = {}) => {
  const query = withAbortSignal(baseCollectionQuery(), signal)

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

  const query = withAbortSignal(baseCollectionQuery(), signal)

  const { data, error } = await query
    .ilike('keyword', `%${escapeIlikeValue(validatedQuery.value)}%`)
    .order('created_at', { ascending: false })
    .limit(SEARCH_RESULT_LIMIT)

  if (error) {
    throw error
  }

  return data ?? []
}

export const fetchAdminCollections = async ({ signal } = {}) => {
  const query = withAbortSignal(baseCollectionQuery(), signal)

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return data ?? []
}

export const getCurrentSession = () => supabase.auth.getSession()

export const onAuthStateChange = (callback) => supabase.auth.onAuthStateChange(callback)

export const signInAsAdmin = async (email, password) => {
  const normalizedEmail = normalizeEmail(email)

  if (!normalizedEmail) {
    throw new Error('Email is required.')
  }

  if (!(password ?? '').trim()) {
    throw new Error('Password is required.')
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  })

  if (error) {
    throw error
  }

  return data.session
}

export const signOutAdmin = async () => {
  const { error } = await supabase.auth.signOut()

  if (error) {
    throw error
  }
}

export const isCurrentUserAdmin = async ({ userId, email }) => {
  const normalizedEmail = normalizeEmail(email)

  if (!userId || !normalizedEmail) {
    return false
  }

  const { data, error } = await supabase.rpc('is_admin_login_user', {
    p_user_id: userId,
    p_email: normalizedEmail,
  })

  if (error) {
    throw error
  }

  return Boolean(data)
}

export const saveCollection = async ({ collectionId = null, keyword, links }) => {
  const { data, error } = await supabase.rpc('save_collection', {
    p_collection_id: collectionId,
    p_keyword: keyword,
    p_links: links,
  })

  if (error) {
    throw error
  }

  return data
}

export const deleteCollection = async (collectionId) => {
  const { error } = await supabase.rpc('delete_collection', {
    p_collection_id: collectionId,
  })

  if (error) {
    throw error
  }
}
