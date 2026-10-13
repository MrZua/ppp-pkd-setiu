'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setInfo('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)

    if (error) {
      setMessage('Login gagal. Semak e-mel dan kata laluan.')
      return
    }

    window.location.href = '/'
  }

  async function lupaKataLaluan() {
    setMessage('')
    setInfo('')
    if (!email) {
      setMessage('Masukkan e-mel anda dahulu, kemudian tekan "Lupa kata laluan".')
      return
    }
    setLoading(true)
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    })
    setLoading(false)
    // Mesej sama sama ada e-mel berdaftar atau tidak
    setInfo('Jika e-mel itu berdaftar, pautan untuk menetapkan semula kata laluan telah dihantar.')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-200 p-6 text-black">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-md overflow-hidden rounded-2xl border-2 border-black bg-zinc-50 shadow-lg"
      >
        <div className="border-b-2 border-black bg-emerald-200 p-6 text-center">
          <h1 className="text-2xl font-bold">Portal Database PPP</h1>
          <p className="mt-2 text-sm text-zinc-800">
            Pejabat Kesihatan Daerah Setiu
          </p>
        </div>

        <div className="space-y-5 p-8">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">
              E-mel
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border-2 border-black bg-white p-3 outline-none focus:ring-2 focus:ring-emerald-400"
              placeholder="nama@moh.gov.my"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium">
              Kata laluan
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border-2 border-black bg-white p-3 outline-none focus:ring-2 focus:ring-emerald-400"
              placeholder="Masukkan kata laluan"
            />
          </div>

          {message && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
            >
              {message}
            </p>
          )}

          {info && (
            <p className="rounded-lg border-2 border-black bg-emerald-100 p-3 text-sm">
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg border-2 border-black bg-emerald-300 p-3 font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
          >
            {loading ? 'Sila tunggu...' : 'Log Masuk'}
          </button>

          <button
            type="button"
            onClick={lupaKataLaluan}
            disabled={loading}
            className="block w-full text-center text-sm font-medium underline hover:bg-emerald-200 disabled:opacity-50"
          >
            Lupa kata laluan?
          </button>

          <p className="text-center text-xs text-zinc-700">
            Akses untuk pengguna yang diberi kebenaran sahaja.
          </p>
        </div>
      </form>
    </main>
  )
}