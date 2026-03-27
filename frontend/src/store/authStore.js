import { create } from "zustand"

const TOKEN_KEY = "ftc_access_token"
const REFRESH_KEY = "ftc_refresh_token"
const USER_KEY = "ftc_user"
const MODULES_KEY = "ftc_modules"

const getStorage = (user) =>
  user?.department === "STOREMANAGER" ? sessionStorage : localStorage

// Al caricamento legge da entrambi (non si sa ancora chi è loggato)
const _parseJson = (raw, fallback) => { try { return JSON.parse(raw || "null") ?? fallback } catch { return fallback } }
const storedUser = _parseJson(
  sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY), null
)
const storedToken =
  sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY)
const storedRefresh =
  sessionStorage.getItem(REFRESH_KEY) || localStorage.getItem(REFRESH_KEY)
const storedModules = _parseJson(
  sessionStorage.getItem(MODULES_KEY) || localStorage.getItem(MODULES_KEY), {}
)

export const useAuthStore = create((set, get) => ({
  user: storedUser,
  accessToken: storedToken,
  refreshToken: storedRefresh,
  isAuthenticated: !!storedToken,
  modules: storedModules,   // { sales: {can_view, can_manage}, navision: {...}, ... }

  setAuth: (user, accessToken, refreshToken) => {
    const storage = getStorage(user)
    storage.setItem(TOKEN_KEY, accessToken)
    storage.setItem(REFRESH_KEY, refreshToken)
    storage.setItem(USER_KEY, JSON.stringify(user))
    set({ user, accessToken, refreshToken, isAuthenticated: true })
  },

  setModules: (modules) => {
    const storage = getStorage(get().user)
    storage.setItem(MODULES_KEY, JSON.stringify(modules))
    set({ modules })
  },

  clearAuth: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(MODULES_KEY)
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(REFRESH_KEY)
    sessionStorage.removeItem(USER_KEY)
    sessionStorage.removeItem(MODULES_KEY)
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, modules: {} })
  },

  updateTokens: (accessToken, refreshToken) => {
    const storage = getStorage(get().user)
    storage.setItem(TOKEN_KEY, accessToken)
    storage.setItem(REFRESH_KEY, refreshToken)
    set({ accessToken, refreshToken })
  },

  hasRole: (...roles) => {
    const user = get().user
    if (!user) return false
    if (user.department === "SUPERUSER") return true
    return roles.includes(user.department)
  },

  canView: (moduleCode) => {
    const { user, modules } = get()
    if (!user) return false
    if (user.department === "SUPERUSER") return true
    return modules[moduleCode]?.can_view === true
  },

  canManage: (moduleCode) => {
    const { user, modules } = get()
    if (!user) return false
    if (user.department === "SUPERUSER") return true
    return modules[moduleCode]?.can_manage === true
  },
}))
