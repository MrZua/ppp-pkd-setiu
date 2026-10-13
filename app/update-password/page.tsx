
'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMessage('')

    if (password.length < 8) {
      setMessage('Kata laluan mestilah sekurang-kurangnya 8 aksara.')
      return
    }

    if (password !== confirmPassword) {
      setMessage('Kata laluan tidak sepadan.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({
      password,
    })

    setLoading(false)

    if (error) {
      setMessage(
        'Gagal mengemas kini kata laluan. Pautan mungkin telah tamat tempoh atau sesi pemulihan tidak sah. Minta pautan pemulihan baharu.'
      )
      return
    }

    setMessage('Kata laluan berjaya dikemas kini. Sila log masuk.')

    await supabase.auth.signOut()
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <form
        onSubmit={handleUpdate}
        className="w-full max-w-md space-y-5 rounded-2xl bg-white p-8 shadow-lg"
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-800">
            Tetapkan Kata Laluan
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Portal Database PPP — PKD Setiu
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Kata laluan baharu
          </label>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 p-3"
            placeholder="Minimum 8 aksara"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Sahkan kata laluan
          </label>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 p-3"
            placeholder="Masukkan semula kata laluan"
          />
        </div>

        {message && (
          <p role="status" className="text-sm text-slate-700">
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-700 p-3 font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {loading ? 'Sedang menyimpan...' : 'Simpan Kata Laluan'}
        </button>
      </form>
    </main>
  )
}
