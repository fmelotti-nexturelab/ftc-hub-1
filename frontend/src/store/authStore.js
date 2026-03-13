import { create } from "zustand"

const TOKEN_KEY = "ftc_access_token"
const REFRESH_KEY = "ftc_refresh_token"
const USER_KEY = "ftc_user"

export const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem(USER_KEY) || "null"),
  accessToken: localStorage.getItem(TOKEN_KEY),
  refreshToken: localStorage.getItem(REFRESH_KEY),
  isAuthenticated: !!localStorage.getItem(TOKEN_KEY),

  setAuth: (user, accessToken, refreshToken) => {
    localStorage.setItem(TOKEN_KEY, accessToken)
    localStorage.setItem(REFRESH_KEY, refreshToken)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    set({ user, accessToken, refreshToken, isAuthenticated: true })
  },

  clearAuth: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(USER_KEY)
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
  },

  updateTokens: (accessToken, refreshToken) => {
    localStorage.setItem(TOKEN_KEY, accessToken)
    localStorage.setItem(REFRESH_KEY, refreshToken)
    set({ accessToken, refreshToken })
  },

  hasRole: (...roles) => {
    const user = get().user
    return user ? roles.includes(user.role) : false
  },
}))
