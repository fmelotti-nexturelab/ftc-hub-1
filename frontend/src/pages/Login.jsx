import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Eye, EyeOff } from "lucide-react"
import { useAuthStore } from "@/store/authStore"
import { authApi } from "@/api/auth"

export default function Login() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const setAuth = useAuthStore((s) => s.setAuth)
  const setModules = useAuthStore((s) => s.setModules)
  const navigate = useNavigate()
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const { data } = await authApi.login(username, password)
      setAuth(data.user, data.access_token, data.refresh_token)
      // Carica i permessi modulo subito dopo il login
      try {
        const { data: modules } = await authApi.getMyModules()
        setModules(modules)
      } catch {}
      navigate("/", { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || "Errore di connessione")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1e3a5f] to-[#2563eb] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md px-8 pt-2 pb-0">
        <div className="text-center mb-1">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#1e3a5f] mb-2">
            <span className="text-white text-2xl font-black">F</span>
          </div>
          <h1 className="text-2xl font-black text-[#1e3a5f]">FTC HUB</h1>
          <p className="text-gray-500 text-sm mt-1">Accedi al tuo account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition"
              placeholder="Inserisci username"
              required
              autoFocus
              autoComplete="off"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 pr-11 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition"
                placeholder="••••••••"
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] rounded"
                aria-label={showPassword ? "Nascondi password" : "Mostra password"}
              >
                {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Accesso in corso..." : "Accedi"}
          </button>
        </form>

        <div className="border-t border-gray-100 flex justify-center">
          <img src="/flying-tiger-logo.png" alt="Flying Tiger Copenhagen" className="w-32 opacity-60" />
        </div>
      </div>
    </div>
  )
}
