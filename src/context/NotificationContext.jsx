import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import { supabase } from '../lib/supabase.js'
import { resolveEmployerId, getEmployerUserIds } from '../lib/employerAccess.js'

const NotificationContext = createContext(undefined)

const POLL_MS = 30000
const EPOCH = '1970-01-01T00:00:00Z'

export function NotificationProvider({ children }) {
  const { user, userType } = useAuth()
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [newApplications, setNewApplications] = useState(0)
  const [newShortlists, setNewShortlists] = useState(0)
  const [newProfileViews, setNewProfileViews] = useState(0)
  // Caches the resolved company id so clearApplicationsBadge (called from a
  // click handler, not from refresh()) doesn't need to re-resolve it.
  const employerIdRef = useRef(null)

  const refresh = useCallback(async () => {
    if (!user || !userType) return

    if (userType === 'employer') {
      const { employerId } = await resolveEmployerId(user.id)
      employerIdRef.current = employerId
      if (!employerId) {
        setUnreadMessages(0)
        setNewApplications(0)
        return
      }
      const myIds = await getEmployerUserIds(employerId)
      const { count: msgCount } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .in('recipient_id', myIds)
        .is('read_at', null)
      setUnreadMessages(msgCount || 0)
    } else {
      const { count: msgCount } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .is('read_at', null)
      setUnreadMessages(msgCount || 0)
    }

    if (userType === 'candidate') {
      const { data: candidate } = await supabase
        .from('candidate_profiles')
        .select('id, last_viewed_dashboard_at')
        .eq('user_id', user.id)
        .maybeSingle()
      if (!candidate) return
      const since = candidate.last_viewed_dashboard_at || EPOCH
      const [{ count: shortlistCount }, { count: viewCount }] = await Promise.all([
        supabase
          .from('shortlists')
          .select('id', { count: 'exact', head: true })
          .eq('candidate_id', candidate.id)
          .gt('created_at', since),
        supabase
          .from('profile_views')
          .select('id', { count: 'exact', head: true })
          .eq('candidate_id', candidate.id)
          .gt('viewed_at', since),
      ])
      setNewShortlists(shortlistCount || 0)
      setNewProfileViews(viewCount || 0)
    }

    if (userType === 'employer') {
      if (!employerIdRef.current) return
      const { data: employer } = await supabase
        .from('employer_profiles')
        .select('id, last_viewed_applications_at')
        .eq('id', employerIdRef.current)
        .maybeSingle()
      if (!employer) return
      const { data: roleRows } = await supabase.from('roles').select('id').eq('employer_id', employer.id)
      const roleIds = (roleRows || []).map((r) => r.id)
      if (roleIds.length === 0) {
        setNewApplications(0)
        return
      }
      const since = employer.last_viewed_applications_at || EPOCH
      const { count: appCount } = await supabase
        .from('applications')
        .select('id', { count: 'exact', head: true })
        .in('role_id', roleIds)
        .gt('applied_at', since)
      setNewApplications(appCount || 0)
    }
  }, [user, userType])

  useEffect(() => {
    if (!user || !userType) {
      setUnreadMessages(0)
      setNewApplications(0)
      setNewShortlists(0)
      setNewProfileViews(0)
      return
    }
    refresh()
    const interval = setInterval(refresh, POLL_MS)
    return () => clearInterval(interval)
  }, [user, userType, refresh])

  async function clearDashboardBadges() {
    setNewShortlists(0)
    setNewProfileViews(0)
    if (userType === 'candidate' && user) {
      await supabase
        .from('candidate_profiles')
        .update({ last_viewed_dashboard_at: new Date().toISOString() })
        .eq('user_id', user.id)
    }
  }

  async function clearApplicationsBadge() {
    setNewApplications(0)
    if (userType === 'employer' && employerIdRef.current) {
      // A direct .update() here only works for the account owner — RLS on
      // employer_profiles is owner-only (see migration 0054) so a team
      // member's write would be silently dropped, freezing the "since last
      // visit" marker forever for anyone but the owner.
      await supabase.rpc('mark_applications_viewed', { target_employer_id: employerIdRef.current })
    }
  }

  const value = {
    unreadMessages,
    newApplications,
    newShortlists,
    newProfileViews,
    refresh,
    clearDashboardBadges,
    clearApplicationsBadge,
  }

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (ctx === undefined) throw new Error('useNotifications must be used within NotificationProvider')
  return ctx
}
