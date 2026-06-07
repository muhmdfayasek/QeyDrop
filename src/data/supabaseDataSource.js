export const DATA_SOURCE_NAME = 'Supabase Version'
export const supportsAdminPanel = true
export const ADMIN_PANEL_UNAVAILABLE_MESSAGE =
  'Static JSON Version does not support the admin panel. Edit public/data/links.json instead.'

export {
  deleteCollection,
  fetchAdminCollections,
  fetchLatestCollections,
  getCurrentSession,
  isCurrentUserAdmin,
  onAuthStateChange,
  saveCollection,
  searchCollections,
  signInAsAdmin,
  signOutAdmin,
} from '../lib/supabase'
