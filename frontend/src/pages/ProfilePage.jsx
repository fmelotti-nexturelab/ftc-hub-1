import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Lock, Save, Check, Calendar, UserCircle, Eye, EyeOff, Info } from "lucide-react"
import { authApi } from "@/api/auth"
import { useAuthStore } from "@/store/authStore"

const ROLE_LABEL = { ADMIN: "IT", HO: "Head Office", DM: "District Manager", STORE: "Store" }
const TYPE_LABEL = {
  SUPERUSER: "Superuser", ADMIN: "IT", HR: "HR", FINANCE: "Finance",
  MARKETING: "Marketing", IT: "IT", COMMERCIAL: "Commercial",
  DM: "District Manager", STORE: "Store", STOREMANAGER: "Store Manager", RETAIL: "Retail",
  MANAGER: "Manager", TOPMGR: "Head",
}

function ReadonlyField({ label, value }) {
  return (
    <div className="bg-gray-50 rounded-lg px-4 py-3">
      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-700">{value || "—"}</p>
    </div>
  )
}

export default function ProfilePage() {
  const queryClient = useQueryClient()
  const { user: storeUser, setAuth, accessToken, refreshToken } = useAuthStore()

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: () => authApi.getProfile().then(r => r.data),
  })

  const [form, setForm] = useState({ username: "", email: "", phone: "" })
  const [profileSuccess, setProfileSuccess] = useState(false)
  const [pwForm, setPwForm] = useState({ current_password: "", new_password: "", confirm: "" })
  const [pwError, setPwError] = useState("")
  const [pwSuccess, setPwSuccess] = useState(false)
  const [showPw, setShowPw] = useState({ current: false, new: false, confirm: false })
  const [showTypeHint, setShowTypeHint] = useState(false)

  const [formInit, setFormInit] = useState(false)
  if (profile && !formInit) {
    setForm({ username: profile.username, email: profile.email, phone: profile.phone || "" })
    setFormInit(true)
  }

  const profileMutation = useMutation({
    mutationFn: (data) => authApi.updateProfile(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["profile"] })
      if (storeUser) setAuth({ ...storeUser, username: res.data.username, email: res.data.email }, accessToken, refreshToken)
      setProfileSuccess(true)
      setTimeout(() => setProfileSuccess(false), 3000)
    },
  })

  const pwMutation = useMutation({
    mutationFn: (data) => authApi.changePassword(data),
    onSuccess: () => {
      setPwForm({ current_password: "", new_password: "", confirm: "" })
      setPwError("")
      setPwSuccess(true)
      setTimeout(() => setPwSuccess(false), 3000)
    },
    onError: (err) => {
      setPwError(err.response?.data?.detail || "Errore durante il cambio password")
    },
  })

  const handleProfileSubmit = (e) => {
    e.preventDefault()
    const payload = {}
    if (form.username !== profile.username) payload.username = form.username
    if (form.email !== profile.email) payload.email = form.email
    if (form.phone !== (profile.phone || "")) payload.phone = form.phone
    if (Object.keys(payload).length === 0) return
    profileMutation.mutate(payload)
  }

  const handlePwSubmit = (e) => {
    e.preventDefault()
    setPwError("")
    if (pwForm.new_password !== pwForm.confirm) { setPwError("Le password non coincidono"); return }
    pwMutation.mutate({ current_password: pwForm.current_password, new_password: pwForm.new_password })
  }

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition text-sm"

  if (isLoading) return <div className="py-16 text-center text-gray-400 text-sm">Caricamento...</div>

  const initials = profile?.full_name?.charAt(0)?.toUpperCase() || profile?.username?.charAt(0)?.toUpperCase() || "?"

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Profilo</h1>
        <p className="text-xs text-gray-400 mt-0.5">Gestisci le tue informazioni personali</p>
      </div>

      {/* Row 1 — Avatar + read-only info */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center gap-6">
        {/* Avatar */}
        <div className="shrink-0 w-16 h-16 rounded-full bg-[#1e3a5f] flex items-center justify-center text-white font-bold text-2xl">
          {initials}
        </div>

        {/* Name + email */}
        <div className="min-w-0">
          <p className="text-lg font-bold text-gray-800 truncate">{profile?.full_name || profile?.username}</p>
          <p className="text-sm text-gray-400 truncate">{profile?.email}</p>
        </div>

        <div className="ml-auto flex items-center gap-3 shrink-0">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowTypeHint(v => !v)}
              className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold px-3 py-1.5 rounded-full transition"
            >
              <UserCircle size={13} />
              {TYPE_LABEL[profile?.department] || profile?.department}
              <Info size={11} className="text-gray-400" />
            </button>
            {showTypeHint && (
              <div className="absolute right-0 top-9 z-10 w-64 bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-xs text-gray-600 leading-relaxed">
                Per modificare il tuo tipo utente o ruolo, contatta il reparto <span className="font-semibold text-[#1e3a5f]">IT</span>.
                <button
                  type="button"
                  onClick={() => setShowTypeHint(false)}
                  className="block mt-2 text-gray-400 hover:text-gray-600 underline"
                >
                  Chiudi
                </button>
              </div>
            )}
          </div>
          {profile?.created_at && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Calendar size={13} />
              dal {new Date(profile.created_at).toLocaleDateString("it-IT")}
            </div>
          )}
        </div>
      </div>

      {/* Row 2 — Editable fields + Password side by side */}
      <div className="grid grid-cols-2 gap-5">

        {/* Dati personali */}
        <form onSubmit={handleProfileSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Dati personali</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Username</label>
              <input
                className={inputClass}
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                placeholder="Username"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Telefono</label>
              <input
                className={inputClass}
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+39 000 000 0000"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Email</label>
            <input
              type="email"
              className={inputClass}
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="email@example.com"
            />
          </div>

          <div className="pt-1 border-t border-gray-100 flex items-center gap-3">
            <button
              type="submit"
              disabled={profileMutation.isPending}
              className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold py-2 px-4 rounded-lg shadow transition text-sm disabled:opacity-50"
            >
              {profileSuccess ? <Check size={14} /> : <Save size={14} />}
              {profileSuccess ? "Salvato!" : "Salva modifiche"}
            </button>
            {profileMutation.isError && (
              <p className="text-xs text-red-600">{profileMutation.error?.response?.data?.detail || "Errore"}</p>
            )}
          </div>
        </form>

        {/* Cambia password */}
        <form onSubmit={handlePwSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Cambia password</h2>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Password attuale</label>
            <div className="relative">
              <input
                type={showPw.current ? "text" : "password"}
                className={inputClass + " pr-9"}
                value={pwForm.current_password}
                onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))}
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setShowPw(s => ({ ...s, current: !s.current }))}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPw.current ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nuova password</label>
              <div className="relative">
                <input
                  type={showPw.new ? "text" : "password"}
                  className={inputClass + " pr-9"}
                  value={pwForm.new_password}
                  onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))}
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPw(s => ({ ...s, new: !s.new }))}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw.new ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Conferma</label>
              <div className="relative">
                <input
                  type={showPw.confirm ? "text" : "password"}
                  className={inputClass + " pr-9"}
                  value={pwForm.confirm}
                  onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPw(s => ({ ...s, confirm: !s.confirm }))}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw.confirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>

          {pwError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
              {pwError}
            </div>
          )}

          <div className="pt-1 border-t border-gray-100">
            <button
              type="submit"
              disabled={pwMutation.isPending}
              className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold py-2 px-4 rounded-lg shadow transition text-sm disabled:opacity-50"
            >
              {pwSuccess ? <Check size={14} /> : <Lock size={14} />}
              {pwSuccess ? "Password aggiornata!" : "Aggiorna password"}
            </button>
          </div>
        </form>

      </div>
    </div>
  )
}
