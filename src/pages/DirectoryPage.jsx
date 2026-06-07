import { useEffect, useRef, useState } from 'react'
import { FaCheck, FaRegCopy } from 'react-icons/fa6'
import { fetchLatestCollections, searchCollections, supportsAdminPanel } from '../data/activeDataSource'
import { SOCIAL_LINKS } from '../data/socialLinks'
import { MAX_SEARCH_LENGTH, MIN_SEARCH_LENGTH, SEARCH_DEBOUNCE_MS, sanitizeSearchInput, validateSearchQuery } from '../lib/search'

const isAbortError = (error) => error?.name === 'AbortError'
const COPY_RESET_MS = 1600

// Remove the below line if you don't want the repo link in your page
const GITHUB_REPO_URL = 'https://github.com/muhmdfayasek/QeyDrop'

const formatCollectionCopyText = (collection) => {
  const keyword = collection.keyword?.trim() ?? ''
  const linkBlocks = (collection.links ?? [])
    .map((link) => {
      const label = link.label?.trim() ?? ''
      const url = link.url?.trim() ?? ''

      return [label, url].filter(Boolean).join('\n')
    })
    .filter(Boolean)

  return [keyword, ...linkBlocks].filter(Boolean).join('\n\n')
}

const fallbackCopyText = (text) => {
  if (typeof document === 'undefined') {
    return false
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '0'
  textarea.style.left = '-9999px'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)

  const selection = document.getSelection()
  const existingRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null

  textarea.focus()
  textarea.select()
  textarea.setSelectionRange(0, textarea.value.length)

  let copied
  try {
    copied = document.execCommand('copy')
  } catch {
    copied = false
  }

  document.body.removeChild(textarea)

  if (selection && existingRange) {
    selection.removeAllRanges()
    selection.addRange(existingRange)
  }

  return copied
}

const writeToClipboard = async (text) => {
  if (!text) {
    return false
  }

  try {
    if (globalThis.navigator?.clipboard?.writeText) {
      await globalThis.navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    return fallbackCopyText(text)
  }

  return fallbackCopyText(text)
}

function DirectoryPage() {
  const [query, setQuery] = useState('')
  const [latestCollections, setLatestCollections] = useState([])
  const [searchResults, setSearchResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [searchError, setSearchError] = useState('')
  const [validationMessage, setValidationMessage] = useState('')
  const [copiedCollectionId, setCopiedCollectionId] = useState(null)
  const searchCacheRef = useRef({})
  const activeSearchRequestRef = useRef(0)
  const copiedTimerRef = useRef(null)
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
      } catch (searchRequestError) {
        if (
          requestId !== activeSearchRequestRef.current ||
          isAbortError(searchRequestError)
        ) {
          return
        }

        console.error('Search request failed.', searchRequestError)
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

  useEffect(
    () => () => {
      if (copiedTimerRef.current) {
        window.clearTimeout(copiedTimerRef.current)
      }
    },
    [],
  )

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

  const handleCopyCard = async (collection) => {
    const text = formatCollectionCopyText(collection)
    const didCopy = await writeToClipboard(text)

    if (!didCopy) {
      return
    }

    if (copiedTimerRef.current) {
      window.clearTimeout(copiedTimerRef.current)
    }

    setCopiedCollectionId(collection.id)
    copiedTimerRef.current = window.setTimeout(() => {
      setCopiedCollectionId(null)
    }, COPY_RESET_MS)
  }

  return (
    <main className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)]">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-32 pt-10 sm:px-6 sm:pb-36 lg:px-8">
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
                  : 'Source is empty'}
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
                  <button
                    type="button"
                    aria-label="Copy card content"
                    onClick={() => handleCopyCard(collection)}
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--border-soft)] px-2 py-1 text-xs text-[var(--text-muted)] transition hover:border-[var(--border-strong)] hover:text-[var(--app-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  >
                    {copiedCollectionId === collection.id ? (
                      <FaCheck className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      <FaRegCopy className="h-3 w-3" aria-hidden="true" />
                    )}
                    <span>{copiedCollectionId === collection.id ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <ul className="mt-6 space-y-4">
                  {(collection.links ?? []).map((link) => (
                    <li
                      key={link.id}
                      className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] px-4 py-3.5 transition hover:border-[var(--border-strong)]"
                    >
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-xl text-blue-600 outline-none transition hover:text-blue-700 focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                      >
                        <span className="block text-sm font-semibold tracking-tight">
                          {link.label}
                        </span>
                        <span className="mt-1.5 block break-all text-xs leading-5 underline decoration-current underline-offset-2 opacity-90 sm:text-[13px] text-blue-400 hover:text-blue-300">
                          {link.url}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <footer className="mt-auto pt-12 text-center text-xs text-[var(--text-muted)] sm:pt-14">
          <div className="flex items-center justify-center gap-4">
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center transition hover:text-[var(--app-text)]"
            >
              View Source
            </a>
            {supportsAdminPanel ? (
              <a
                href="/admin"
                className="inline-flex items-center justify-center transition hover:text-[var(--app-text)]"
              >
                Admin
              </a>
            ) : null}
          </div>
          <p className="mt-2">Made with love ❤️</p>
        </footer>
      </div>

      <nav
        aria-label="Social links"
        className="dock-shell fixed left-1/2 z-20 w-[calc(100%-1.5rem)] max-w-max -translate-x-1/2"
      >
        <div className="dock-glass flex items-center justify-center gap-1 rounded-full border border-[var(--dock-border)] px-2 py-2 sm:gap-2 sm:px-3">
          {SOCIAL_LINKS.map(({ label, href, icon: Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${label}`}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-muted)] opacity-80 transition duration-200 hover:scale-[1.04] hover:opacity-100 hover:text-[var(--app-text)] sm:h-11 sm:w-11"
            >
              <Icon className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
            </a>
          ))}
        </div>
      </nav>
    </main>
  )
}

export default DirectoryPage
