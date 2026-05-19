import { useEffect, useRef, useState } from 'react'
import { fetchLatestCollections, searchCollections } from './lib/supabase'
import {
  MAX_SEARCH_LENGTH,
  MIN_SEARCH_LENGTH,
  SEARCH_DEBOUNCE_MS,
  sanitizeSearchInput,
  validateSearchQuery,
} from './lib/search'

const isAbortError = (error) => error?.name === 'AbortError'

function App() {
  const [query, setQuery] = useState('')
  const [latestCollections, setLatestCollections] = useState([])
  const [searchResults, setSearchResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [searchError, setSearchError] = useState('')
  const [validationMessage, setValidationMessage] = useState('')
  const searchCacheRef = useRef({})
  const activeSearchRequestRef = useRef(0)
  const validatedQuery = validateSearchQuery(query)
  const isSearchingView = validatedQuery.status === 'valid'
  const displayedCollections = isSearchingView ? searchResults : latestCollections
  const helperMessage =
    validationMessage ||
    (validatedQuery.status === 'too-short'
      ? `Type at least ${MIN_SEARCH_LENGTH} characters to search.`
      : '')
  const visibleError = isSearchingView ? searchError : loadError

  useEffect(() => {
    let isActive = true
    const abortController = new AbortController()

    const loadLatestCollections = async () => {
      setLoading(true)
      setLoadError('')

      try {
        const data = await fetchLatestCollections({ signal: abortController.signal })
        if (!isActive) {
          return
        }

        setLatestCollections(data)
      } catch (fetchError) {
        if (!isActive || isAbortError(fetchError)) {
          return
        }

        console.error('Failed to load latest collections.', fetchError)
        setLoadError('Unable to load collections right now.')
      } finally {
        if (isActive) {
          setLoading(false)
        }
      }
    }

    loadLatestCollections()

    return () => {
      isActive = false
      abortController.abort()
    }
  }, [])

  useEffect(() => {
    activeSearchRequestRef.current += 1
    const requestId = activeSearchRequestRef.current

    if (validatedQuery.status !== 'valid') {
      return undefined
    }

    const cacheKey = validatedQuery.value.toLowerCase()
    const abortController = new AbortController()

    const timer = window.setTimeout(async () => {
      if (searchCacheRef.current[cacheKey]) {
        if (requestId !== activeSearchRequestRef.current) {
          return
        }

        setSearchResults(searchCacheRef.current[cacheKey])
        setSearching(false)
        return
      }

      setSearching(true)
      setSearchError('')

      try {
        const data = await searchCollections(validatedQuery.value, {
          signal: abortController.signal,
        })
        if (requestId !== activeSearchRequestRef.current) {
          return
        }

        searchCacheRef.current[cacheKey] = data
        setSearchResults(data)
      } catch (searchError) {
        if (requestId !== activeSearchRequestRef.current || isAbortError(searchError)) {
          return
        }

        console.error('Search request failed.', searchError)
        setSearchError('Unable to search right now.')
      } finally {
        if (requestId === activeSearchRequestRef.current) {
          setSearching(false)
        }
      }
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
      abortController.abort()
    }
  }, [validatedQuery.status, validatedQuery.value])

  const handleQueryChange = (event) => {
    const nextValue = event.target.value
    const sanitizedValue = sanitizeSearchInput(nextValue)
    const nextValidatedQuery = validateSearchQuery(sanitizedValue)

    setQuery(sanitizedValue)
    setSearchError('')
    setValidationMessage(nextValue === sanitizedValue ? '' : 'Invalid search.')

    if (sanitizedValue !== query) {
      setSearching(nextValidatedQuery.status === 'valid')
      setSearchResults([])
    }
  }

  return (
    <main className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)]">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-10 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-[var(--border-soft)] bg-[var(--surface-strong)] px-5 py-6 shadow-glow sm:px-8 sm:py-8">
          <div className="pointer-events-none absolute inset-0 hero-glow" />
          <div className="relative space-y-5">
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-[0.32em] text-[var(--text-muted)]">
                QeyDrop Link Directory
              </p>
              <div className="space-y-2">
                <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl">
                  Find the latest creator keywords and open every useful link in one place.
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-[var(--text-muted)] sm:text-base">
                  Search updates instantly or browse the 10 newest collections.
                </p>
              </div>
            </div>

            <label className="block">
              <span className="sr-only">Search keywords</span>
              <input
                type="search"
                value={query}
                onChange={handleQueryChange}
                placeholder="Search keyword..."
                maxLength={MAX_SEARCH_LENGTH}
                className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--app-text)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--border-strong)] focus:ring-2 focus:ring-[var(--ring)]"
              />
            </label>

            {helperMessage ? (
              <p
                className={`text-sm ${
                  validationMessage ? 'text-red-200' : 'text-[var(--text-muted)]'
                }`}
              >
                {helperMessage}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-muted)]">
              <span>{isSearchingView ? 'Matching keywords' : 'Latest 10 keywords'}</span>
              {(loading || searching) && (
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent)]" />
                  {loading ? 'Loading collections...' : 'Searching...'}
                </span>
              )}
            </div>
          </div>
        </section>

        <section className="mt-8">
          {visibleError ? (
            <div className="rounded-3xl border border-red-400/40 bg-red-500/10 px-5 py-4 text-sm text-red-200">
              {visibleError}
            </div>
          ) : null}

          {!visibleError && !loading && !searching && displayedCollections.length === 0 ? (
            <div className="rounded-3xl border border-[var(--border-soft)] bg-[var(--surface)] px-5 py-8 text-center shadow-glow">
              <p className="text-lg font-medium">
                {isSearchingView ? 'No matching keywords found.' : 'No collections available yet.'}
              </p>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                {isSearchingView
                  ? 'Try a shorter keyword or clear the search to see the latest entries.'
                  : 'Add a few collections in Supabase and they will appear here.'}
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {displayedCollections.map((collection) => (
              <article
                key={collection.id}
                className="group rounded-3xl border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-glow transition hover:-translate-y-0.5 hover:border-[var(--border-strong)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-[var(--text-muted)]">
                      Keyword
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                      {collection.keyword}
                    </h2>
                  </div>
                </div>

                <ul className="mt-5 space-y-3">
                  {(collection.links ?? []).map((link) => (
                    <li key={link.id} className="rounded-2xl border border-[var(--border-soft)] px-4 py-3">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-sm text-blue-600 underline decoration-blue-400/60 underline-offset-2 transition hover:text-blue-700 dark:text-blue-400 dark:decoration-blue-300/50 dark:hover:text-blue-300"
                      >
                        <span className="font-medium">{link.label}</span>
                        <span className="mx-2 text-[var(--text-muted)]">{'→'}</span>
                        <span className="break-all text-blue-500">{link.url}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}

export default App
