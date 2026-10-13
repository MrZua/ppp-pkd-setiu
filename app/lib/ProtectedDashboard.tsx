
'use client'

import type { ReactNode } from 'react'
import AuthGuard from './AuthGuard'

type ProtectedDashboardProps = {
  children: ReactNode
}

export default function ProtectedDashboard({
  children,
}: ProtectedDashboardProps) {
  return <AuthGuard>{children}</AuthGuard>
}
