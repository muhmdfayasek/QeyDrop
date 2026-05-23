import { useEffect, useEffectEvent, useState } from 'react'
import {
  deleteCollection,
  fetchAdminCollections,
  getCurrentSession,
  isCurrentUserAdmin,
  onAuthStateChange,
  saveCollection,
  signInAsAdmin,
  signOutAdmin,
} from '../lib/supabase'

const createEmptyLink = () => ({ label: '', url: '' })

const createEmptyDraft = () => ({
  id: null,
  keyword: '',
  links: [createEmptyLink()],
})

const normalizeEmail = (value) => (value ?? '').trim().toLowerCase()

const buildDraftFromCollection = (collection) => ({
  id: collection.id,
  keyword: collection.keyword,
  links:
    collection.links?.length > 0
      ? collection.links.map(({ label, url }) => ({ label, url }))
      : [createEmptyLink()],
})

const prepareLinksForSave = (links) => {
  const normalizedLinks = links.map(({ label, url }) => ({
    label: (label ?? '').trim(),
    url: (url ?? '').trim(),
  }))

  const hasPartialLink = normalizedLinks.some(
    ({ label, url }) => (label && !url) || (!label && url),
  )

  if (hasPartialLink) {
    throw new Error('Each link needs both a label and a URL.')
  }

  const completeLinks = normalizedLinks.filter(({ label, url }) => label && url)

  if (completeLinks.length === 0) {
    throw new Error('Add at least one link before saving.')
  }

  return completeLinks
}

function AdminPage() {
  const [authReady, setAuthReady] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [collections, setCollections] = useState([])
  const [dataLoading, setDataLoading] = useState(false)
  const [dataError, setDataError] = useState('')
  const [draft, setDraft] = useState(createEmptyDraft)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deletingId, setDeletingId] = useState('')
  const [notice, setNotice] = useState('')
  const [inlineEdit, setInlineEdit] = useState({ id: '', keyword: '' })
  const [inlineSavingId, setInlineSavingId] = useState('')
  const [inlineError, setInlineError] = useState('')

  const resetDraft = () => {
    setDraft(createEmptyDraft())
    setSaveError('')
  }

  const resetInlineEdit = () => {
    setInlineEdit({ id: '', keyword: '' })
    setInlineError('')
  }

  const loadCollections = async () => {
    setDataLoading(true)
    setDataError('')

    try {
      const data = await fetchAdminCollections()
      setCollections(data)
    } catch (error) {
      console.error('Failed to load collections.', error)
      setDataError('Unable to load collections.')
    } finally {
      setDataLoading(false)
    }
  }

  const verifySession = useEffectEvent(async (session) => {
    if (!session?.user) {
      setIsAdmin(false)
      setCollections([])
      resetDraft()
      resetInlineEdit()
      setAuthReady(true)
      return
    }

    try {
      setEmail(normalizeEmail(session.user.email))
      const adminUser = await isCurrentUserAdmin({
        userId: session.user.id,
        email: session.user.email,
      })

      if (!adminUser) {
        await signOutAdmin().catch(() => {})
        setAuthError('Access denied for this account.')
        setIsAdmin(false)
        setAuthReady(true)
        return
      }

      setAuthError('')
      setIsAdmin(true)
      setAuthReady(true)
      await loadCollections()
    } catch (error) {
      console.error('Failed to verify session.', error)
      await signOutAdmin().catch(() => {})
      setAuthError('Unable to verify access right now.')
      setIsAdmin(false)
      setAuthReady(true)
    }
  })

  useEffect(() => {
    let isActive = true

    const bootstrap = async () => {
      try {
        const { data, error } = await getCurrentSession()

        if (!isActive) {
          return
        }

        if (error) {
          console.error('Failed to read current session.', error)
          setAuthError('Unable to check access right now.')
          setAuthReady(true)
          return
        }

        await verifySession(data.session)
      } catch (error) {
        if (!isActive) {
          return
        }

        console.error('Admin bootstrap failed.', error)
        setAuthError('Unable to open this page right now.')
        setAuthReady(true)
      }
    }

    bootstrap()

    const {
      data: { subscription },
    } = onAuthStateChange((_event, session) => {
      if (!isActive) {
        return
      }

      void verifySession(session)
    })

    return () => {
      isActive = false
      subscription.unsubscribe()
    }
  }, [])

  const handleLogin = async (event) => {
    event.preventDefault()

    if (!normalizeEmail(email)) {
      setAuthError('Email is required.')
      return
    }

    if (!password.trim()) {
      setAuthError('Password is required.')
      return
    }

    setAuthBusy(true)
    setAuthError('')
    setNotice('')

    try {
      await signInAsAdmin(email, password)
      setPassword('')
    } catch (error) {
      console.error('Sign in failed.', error)
      setAuthError('Unable to sign in. Check your credentials and try again.')
    } finally {
      setAuthBusy(false)
    }
  }

  const handleSignOut = async () => {
    setAuthBusy(true)
    setNotice('')
    setSaveError('')
    setInlineError('')

    try {
      await signOutAdmin()
    } catch (error) {
      console.error('Sign out failed.', error)
      setAuthError('Unable to sign out right now.')
    } finally {
      setAuthBusy(false)
    }
  }

  const handleKeywordChange = (event) => {
    const nextValue = event.target.value
    setDraft((currentDraft) => ({ ...currentDraft, keyword: nextValue }))
    setSaveError('')
  }

  const handleLinkChange = (index, field, value) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      links: currentDraft.links.map((link, linkIndex) =>
        linkIndex === index ? { ...link, [field]: value } : link,
      ),
    }))
    setSaveError('')
  }

  const handleAddLink = () => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      links: [...currentDraft.links, createEmptyLink()],
    }))
  }

  const handleRemoveLink = (index) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      links:
        currentDraft.links.length === 1
          ? [createEmptyLink()]
          : currentDraft.links.filter((_, linkIndex) => linkIndex !== index),
    }))
    setSaveError('')
  }

  const handleEditCollection = (collection) => {
    setDraft(buildDraftFromCollection(collection))
    resetInlineEdit()
    setNotice('')
    setSaveError('')
  }

  const handleSave = async (event) => {
    event.preventDefault()

    const trimmedKeyword = draft.keyword.trim()

    if (!trimmedKeyword) {
      setSaveError('Keyword is required.')
      return
    }

    let preparedLinks

    try {
      preparedLinks = prepareLinksForSave(draft.links)
    } catch (error) {
      setSaveError(error.message)
      return
    }

    setSaving(true)
    setSaveError('')
    setDataError('')
    setInlineError('')
    setNotice('')

    try {
      await saveCollection({
        collectionId: draft.id,
        keyword: trimmedKeyword,
        links: preparedLinks,
      })
      await loadCollections()
      resetDraft()
      setNotice(draft.id ? 'Collection updated.' : 'Collection created.')
    } catch (error) {
      console.error('Failed to save collection.', error)
      setSaveError('Unable to save collection. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (collection) => {
    const confirmed = window.confirm(`Delete "${collection.keyword}"?`)

    if (!confirmed) {
      return
    }

    setDeletingId(collection.id)
    setDataError('')
    setSaveError('')
    setInlineError('')
    setNotice('')

    try {
      await deleteCollection(collection.id)
      await loadCollections()

      if (draft.id === collection.id) {
        resetDraft()
      }

      if (inlineEdit.id === collection.id) {
        resetInlineEdit()
      }

      setNotice('Collection deleted.')
    } catch (error) {
      console.error('Failed to delete collection.', error)
      setDataError('Unable to delete collection. Try again.')
    } finally {
      setDeletingId('')
    }
  }

  const handleInlineStart = (collection) => {
    setInlineEdit({
      id: collection.id,
      keyword: collection.keyword ?? '',
    })
    setInlineError('')
    setNotice('')
  }

  const handleInlineSave = async (collection) => {
    const trimmedKeyword = inlineEdit.keyword.trim()

    if (!trimmedKeyword) {
      setInlineError('Keyword is required.')
      return
    }

    let preparedLinks

    try {
      preparedLinks = prepareLinksForSave(collection.links ?? [])
    } catch (error) {
      setInlineError(error.message)
      return
    }

    setInlineSavingId(collection.id)
    setDataError('')
    setInlineError('')
    setNotice('')

    try {
      await saveCollection({
        collectionId: collection.id,
        keyword: trimmedKeyword,
        links: preparedLinks,
      })
      await loadCollections()

      if (draft.id === collection.id) {
        setDraft((currentDraft) => ({ ...currentDraft, keyword: trimmedKeyword }))
      }

      resetInlineEdit()
      setNotice('Collection updated.')
    } catch (error) {
      console.error('Failed to update keyword.', error)
      setInlineError('Unable to update collection. Try again.')
    } finally {
      setInlineSavingId('')
    }
  }

  const renderTopBar = (
    <header className="relative overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] px-4 py-3 shadow-glow">
      <div className="pointer-events-none absolute inset-0 hero-glow opacity-70" />
      <div className="relative flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold tracking-tight">QeyDrop Admin</p>
          <p className="text-xs text-[var(--text-muted)]">
            {isAdmin ? 'Content management' : 'Private access only'}
          </p>
        </div>
        {isAdmin ? (
          <button
            type="button"
            onClick={handleSignOut}
            disabled={authBusy}
            className="inline-flex items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium transition hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {authBusy ? 'Signing out...' : 'Log out'}
          </button>
        ) : null}
      </div>
    </header>
  )

  return (
    <main className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)]">
      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        {renderTopBar}

        {!authReady ? (
          <section className="mt-4 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-5 text-sm text-[var(--text-muted)] shadow-glow">
            Checking access...
          </section>
        ) : null}

        {authReady && !isAdmin ? (
          <section className="mx-auto mt-8 w-full max-w-sm rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-glow sm:p-6">
            <h1 className="text-lg font-semibold tracking-tight">QeyDrop Admin</h1>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Private access only</p>

            <form onSubmit={handleLogin} className="mt-5 space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  Email
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="username"
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-strong)] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--border-strong)] focus:ring-2 focus:ring-[var(--ring)]"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  Password
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  placeholder="Password"
                  className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-strong)] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--border-strong)] focus:ring-2 focus:ring-[var(--ring)]"
                />
              </label>

              {authError ? (
                <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {authError}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={authBusy}
                className="inline-flex w-full items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {authBusy ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
          </section>
        ) : null}

        {authReady && isAdmin ? (
          <section className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <form
              onSubmit={handleSave}
              className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-glow sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold tracking-tight">
                    {draft.id ? 'Edit collection' : 'Create collection'}
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">Content details</p>
                </div>
                <button
                  type="button"
                  onClick={resetDraft}
                  className="inline-flex items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--surface-strong)] px-3 py-1.5 text-xs font-medium transition hover:border-[var(--border-strong)]"
                >
                  New
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-muted)]">
                    Keyword
                  </span>
                  <input
                    type="text"
                    value={draft.keyword}
                    onChange={handleKeywordChange}
                    placeholder="Keyword"
                    className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-strong)] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--border-strong)] focus:ring-2 focus:ring-[var(--ring)]"
                  />
                </label>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-muted)]">
                      Links
                    </h3>
                    <button
                      type="button"
                      onClick={handleAddLink}
                      className="inline-flex items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--surface-strong)] px-3 py-1.5 text-xs font-medium transition hover:border-[var(--border-strong)]"
                    >
                      Add link
                    </button>
                  </div>

                  <div className="space-y-2">
                    {draft.links.map((link, index) => (
                      <div
                        key={`${draft.id ?? 'new'}-${index}`}
                        className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-3"
                      >
                        <div className="grid gap-2 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_auto] sm:items-end">
                          <label className="block">
                            <span className="mb-1.5 block text-xs text-[var(--text-muted)]">Label</span>
                            <input
                              type="text"
                              value={link.label}
                              onChange={(event) =>
                                handleLinkChange(index, 'label', event.target.value)
                              }
                              placeholder="Title"
                              className="w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2 text-sm outline-none transition focus:border-[var(--border-strong)] focus:ring-2 focus:ring-[var(--ring)]"
                            />
                          </label>

                          <label className="block">
                            <span className="mb-1.5 block text-xs text-[var(--text-muted)]">URL</span>
                            <input
                              type="url"
                              value={link.url}
                              onChange={(event) =>
                                handleLinkChange(index, 'url', event.target.value)
                              }
                              placeholder="https://example.com"
                              className="w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2 text-sm outline-none transition focus:border-[var(--border-strong)] focus:ring-2 focus:ring-[var(--ring)]"
                            />
                          </label>

                          <button
                            type="button"
                            onClick={() => handleRemoveLink(index)}
                            className="inline-flex items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2 text-xs font-medium transition hover:border-red-400/60 hover:text-red-200"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {saveError ? (
                  <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                    {saveError}
                  </div>
                ) : null}

                {notice ? (
                  <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                    {notice}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? 'Saving...' : draft.id ? 'Save changes' : 'Create collection'}
                </button>
              </div>
            </form>

            <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-glow sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold tracking-tight">Collections</h2>
                  <p className="text-xs text-[var(--text-muted)]">Manage existing entries</p>
                </div>
                <div className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-strong)] px-3 py-1 text-xs text-[var(--text-muted)]">
                  {collections.length}
                </div>
              </div>

              {dataError ? (
                <div className="mt-3 rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {dataError}
                </div>
              ) : null}

              {inlineError ? (
                <div className="mt-3 rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {inlineError}
                </div>
              ) : null}

              {dataLoading ? (
                <p className="mt-3 text-sm text-[var(--text-muted)]">Loading collections...</p>
              ) : null}

              {!dataLoading && collections.length === 0 ? (
                <div className="mt-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-strong)] px-3 py-4 text-sm text-[var(--text-muted)]">
                  No collections yet.
                </div>
              ) : null}

              <ul className="mt-3 space-y-2">
                {collections.map((collection) => {
                  const linkCount = (collection.links ?? []).length
                  const isInlineEditing = inlineEdit.id === collection.id
                  const isDeleting = deletingId === collection.id
                  const isInlineSaving = inlineSavingId === collection.id

                  return (
                    <li
                      key={collection.id}
                      className={`rounded-xl border bg-[var(--surface-strong)] p-3 ${
                        isInlineEditing
                          ? 'border-[var(--border-strong)]'
                          : 'border-[var(--border-soft)]'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {isInlineEditing ? (
                            <input
                              type="text"
                              value={inlineEdit.keyword}
                              onChange={(event) =>
                                setInlineEdit((current) => ({
                                  ...current,
                                  keyword: event.target.value,
                                }))
                              }
                              className="w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] px-2.5 py-1.5 text-sm font-semibold outline-none transition focus:border-[var(--border-strong)] focus:ring-2 focus:ring-[var(--ring)]"
                            />
                          ) : (
                            <p className="truncate text-sm font-semibold">{collection.keyword}</p>
                          )}
                        </div>
                        <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-2.5 py-1 text-xs text-[var(--text-muted)]">
                          {linkCount} {linkCount === 1 ? 'link' : 'links'}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {isInlineEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleInlineSave(collection)}
                              disabled={isInlineSaving}
                              className="inline-flex items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium transition hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isInlineSaving ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              type="button"
                              onClick={resetInlineEdit}
                              disabled={isInlineSaving}
                              className="inline-flex items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium transition hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleInlineStart(collection)}
                            className="inline-flex items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium transition hover:border-[var(--border-strong)]"
                          >
                            Edit
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleEditCollection(collection)}
                          className="inline-flex items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium transition hover:border-[var(--border-strong)]"
                        >
                          Manage links
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(collection)}
                          disabled={isDeleting}
                          className="inline-flex items-center justify-center rounded-full border border-red-400/40 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-200 transition hover:border-red-400/60 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isDeleting ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          </section>
        ) : null}
      </div>
    </main>
  )
}

export default AdminPage
