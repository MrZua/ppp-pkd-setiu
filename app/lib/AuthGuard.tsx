
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from './supabase'

type AuthGuardProps = {
  children: React.ReactNode
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    let active = true

    async function checkUser() {
      const { data: { user }, error } =
        await supabase.auth.getUser()

      if (error || !user) {
        if (active) router.replace('/login')
        return
      }

      const { data: profile, error: profileError } =
        await supabase
          .from('profiles')
          .select('role, is_active')
          .eq('id', user.id)
          .maybeSingle()

      if (
        profileError ||
        !profile ||
        !profile.is_active ||
        !['admin', 'editor', 'viewer'].includes(profile.role)
      ) {
        await supabase.auth.signOut()
        if (active) router.replace('/login')
        return
      }

      if (active) {
        setAuthorized(true)
        setChecking(false)
      }
    }

    checkUser()

    return () => {
      active = false
    }
  }, [router])

  if (checking || !authorized) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-slate-600">Sedang menyemak akses...</p>
      </main>
    )
  }

  return <>{children}</>
}
