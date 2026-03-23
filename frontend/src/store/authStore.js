import { create } from "zustand"

const TOKEN_KEY = "ftc_access_token"
const REFRESH_KEY = "ftc_refresh_token"
const USER_KEY = "ftc_user"

const getStorage = (user) =>
  user?.department === "STOREMANAGER" ? sessionStorage : localStorage

// Al caricamento legge da entrambi (non si sa ancora chi è loggato)
const storedUser = JSON.parse(
  sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY) || "null"
)
const storedToken =
  sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY)
const storedRefresh =
  sessionStorage.getItem(REFRESH_KEY) || localStorage.getItem(REFRESH_KEY)

export const useAuthStore = create((set, get) => ({
  user: storedUser,
  accessToken: storedToken,
  refreshToken: storedRefresh,
  isAuthenticated: !!storedToken,

  setAuth: (user, accessToken, refreshToken) => {
    const storage = getStorage(user)
    storage.setItem(TOKEN_KEY, accessToken)
    storage.setItem(REFRESH_KEY, refreshToken)
    storage.setItem(USER_KEY, JSON.stringify(user))
    set({ user, accessToken, refreshToken, isAuthenticated: true })
  },

  clearAuth: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(USER_KEY)
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(REFRESH_KEY)
    sessionStorage.removeItem(USER_KEY)
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
  },

  updateTokens: (accessToken, refreshToken) => {
    const storage = getStorage(get().user)
    storage.setItem(TOKEN_KEY, accessToken)
    storage.setItem(REFRESH_KEY, refreshToken)
    set({ accessToken, refreshToken })
  },

  hasRole: (...roles) => {
    const user = get().user
    return user ? roles.includes(user.role) : false
  },
}))
