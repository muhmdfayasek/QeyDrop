export const SEARCH_DEBOUNCE_MS = 300
export const MAX_SEARCH_LENGTH = 50
export const MIN_SEARCH_LENGTH = 4
export const LATEST_COLLECTION_LIMIT = 10
export const SEARCH_RESULT_LIMIT = 10

const SAFE_SEARCH_PATTERN = /^[A-Za-z0-9 _-]+$/
const UNSAFE_SEARCH_CHARACTERS = /[^A-Za-z0-9 _-]/g
const ILIKE_SPECIAL_CHARACTERS = /[\\%_]/g

export const sanitizeSearchInput = (value) =>
  (value ?? '').replace(UNSAFE_SEARCH_CHARACTERS, '').slice(0, MAX_SEARCH_LENGTH)

export const validateSearchQuery = (value) => {
  const trimmedValue = (value ?? '').trim()

  if (!trimmedValue) {
    return { status: 'empty', value: '' }
  }

  if (trimmedValue.length > MAX_SEARCH_LENGTH || !SAFE_SEARCH_PATTERN.test(trimmedValue)) {
    return { status: 'invalid', value: trimmedValue, message: 'Invalid search.' }
  }

  if (trimmedValue.length < MIN_SEARCH_LENGTH) {
    return { status: 'too-short', value: trimmedValue }
  }

  return { status: 'valid', value: trimmedValue }
}

export const escapeIlikeValue = (value) => value.replace(ILIKE_SPECIAL_CHARACTERS, '\\$&')
