import {
  LATEST_COLLECTION_LIMIT,
  SEARCH_RESULT_LIMIT,
  validateSearchQuery,
} from '../lib/search'

export const DATA_SOURCE_NAME = 'Static JSON Version'
export const supportsAdminPanel = false
export const ADMIN_PANEL_UNAVAILABLE_MESSAGE =
  'Static JSON Version does not support the admin panel. Edit public/data/links.json instead.'

const JSON_DATA_PATH = '/data/links.json'

let collectionsCache = null
let collectionsPromise = null

const createAbortError = () => new DOMException('The operation was aborted.', 'AbortError')

const waitForAbort = (signal) =>
  new Promise((_, reject) => {
    if (!signal) {
      return
    }

    if (signal.aborted) {
      reject(createAbortError())
      return
    }

    signal.addEventListener('abort', () => reject(createAbortError()), { once: true })
  })

const withAbortSignal = (promise, signal) => {
  if (!signal) {
    return promise
  }

  return Promise.race([promise, waitForAbort(signal)])
}

const normalizeLink = (link, collectionId, index) => ({
  id: link?.id ?? `${collectionId}-link-${index}`,
  collection_id: collectionId,
  label: typeof link?.label === 'string' ? link.label : '',
  url: typeof link?.url === 'string' ? link.url : '',
})

const normalizeCollection = (collection, index) => {
  const keyword = typeof collection?.keyword === 'string' ? collection.keyword : ''
  const createdAt =
    typeof collection?.created_at === 'string' ? collection.created_at : ''
  const id = collection?.id ?? `${keyword || 'collection'}-${createdAt || index}-${index}`

  return {
    id,
    keyword,
    created_at: createdAt,
    links: Array.isArray(collection?.links)
      ? collection.links.map((link, linkIndex) => normalizeLink(link, id, linkIndex))
      : [],
  }
}

const sortCollectionsByNewest = (collections) =>
  [...collections].sort((left, right) => {
    const leftTimestamp = Date.parse(left.created_at ?? '') || 0
    const rightTimestamp = Date.parse(right.created_at ?? '') || 0

    return rightTimestamp - leftTimestamp
  })

const fetchCollectionsFromJson = async () => {
  const response = await fetch(JSON_DATA_PATH, {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to load ${JSON_DATA_PATH}.`)
  }

  const payload = await response.json()

  if (!Array.isArray(payload)) {
    throw new Error(`${JSON_DATA_PATH} must contain a JSON array.`)
  }

  return sortCollectionsByNewest(payload.map(normalizeCollection))
}

const loadCollections = ({ signal } = {}) => {
  if (collectionsCache) {
    return Promise.resolve(collectionsCache)
  }

  if (!collectionsPromise) {
    collectionsPromise = fetchCollectionsFromJson()
      .then((collections) => {
        collectionsCache = collections
        return collections
      })
      .catch((error) => {
        collectionsPromise = null
        throw error
      })
  }

  return withAbortSignal(collectionsPromise, signal)
}

const createUnsupportedError = () => new Error(ADMIN_PANEL_UNAVAILABLE_MESSAGE)

export const fetchLatestCollections = async ({ signal } = {}) => {
  const collections = await loadCollections({ signal })
  return collections.slice(0, LATEST_COLLECTION_LIMIT)
}

export const searchCollections = async (keyword, { signal } = {}) => {
  const validatedQuery = validateSearchQuery(keyword)

  if (validatedQuery.status !== 'valid') {
    return []
  }

  const collections = await loadCollections({ signal })
  const normalizedKeyword = validatedQuery.value.toLowerCase()

  return collections
    .filter((collection) => collection.keyword.toLowerCase().includes(normalizedKeyword))
    .slice(0, SEARCH_RESULT_LIMIT)
}

export const fetchAdminCollections = async ({ signal } = {}) => loadCollections({ signal })

export const getCurrentSession = async () => ({
  data: { session: null },
  error: null,
})

export const onAuthStateChange = () => ({
  data: {
    subscription: {
      unsubscribe() {},
    },
  },
})

export const signInAsAdmin = async () => {
  throw createUnsupportedError()
}

export const signOutAdmin = async () => {}

export const isCurrentUserAdmin = async () => false

export const saveCollection = async () => {
  throw createUnsupportedError()
}

export const deleteCollection = async () => {
  throw createUnsupportedError()
}
