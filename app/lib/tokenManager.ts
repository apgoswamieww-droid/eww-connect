// Token management utility for client-side token refresh

interface TokenPayload {
  sub: string;
  email: string;
  type: string;
  iat: number;
  exp: number;
}

// Refresh token 5 minutes before expiration
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

let refreshTimeoutId: NodeJS.Timeout | null = null;

/**
 * Decode base64url string to JSON (browser-compatible)
 */
function decodeBase64Url(str: string): string {
  // Replace URL-safe characters
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  // Decode using atob (browser API)
  return decodeURIComponent(
    atob(base64)
      .split("")
      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join("")
  );
}

/**
 * Manually decode JWT token to get expiration time (browser-compatible, no external dependency)
 */
function decodeToken(token: string): TokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const decoded = JSON.parse(decodeBase64Url(parts[1]));
    return decoded as TokenPayload;
  } catch (error) {
    console.error("Failed to decode token:", error);
    return null;
  }
}

/**
 * Get time until token expires in milliseconds
 */
function getTimeUntilExpiry(token: string): number {
  const decoded = decodeToken(token);
  if (!decoded) return 0;
  
  const now = Date.now();
  const expiryMs = decoded.exp * 1000;
  return expiryMs - now;
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string): boolean {
  return getTimeUntilExpiry(token) <= 0;
}

/**
 * Get current token from localStorage
 */
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function getAuthHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Store new token in localStorage
 */
function storeToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("token", token);
  scheduleTokenRefresh();
}

/**
 * Refresh the access token using the refresh token
 */
export async function refreshAccessToken(): Promise<boolean> {
  try {
    const res = await fetch("/api/v1/auth/refresh", {
      method: "POST",
      credentials: "include", // Include cookies
    });

    if (!res.ok) {
      console.error("Token refresh failed:", res.statusText);
      clearToken();
      return false;
    }

    const data = await res.json();
    if (data.data?.token) {
      storeToken(data.data.token);
      return true;
    }

    return false;
  } catch (error) {
    console.error("Token refresh error:", error);
    clearToken();
    return false;
  }
}

/**
 * Schedule automatic token refresh before expiration
 */
export function scheduleTokenRefresh(): void {
  // Clear existing timeout
  if (refreshTimeoutId) {
    clearTimeout(refreshTimeoutId);
    refreshTimeoutId = null;
  }

  const token = getToken();
  if (!token) return;

  const timeUntilExpiry = getTimeUntilExpiry(token);
  const refreshTime = timeUntilExpiry - REFRESH_BUFFER_MS;

  if (refreshTime > 0) {
    refreshTimeoutId = setTimeout(() => {
      refreshAccessToken();
    }, refreshTime);
  } else if (timeUntilExpiry > 0) {
    // Token is expiring soon, refresh immediately
    refreshAccessToken();
  }
}

/**
 * Clear token and cancel scheduled refresh
 */
export function clearToken(): void {
  if (typeof window === "undefined") return;
  
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  
  if (refreshTimeoutId) {
    clearTimeout(refreshTimeoutId);
    refreshTimeoutId = null;
  }
}

/**
 * Initialize token refresh on app load
 */
export function initializeTokenRefresh(): void {
  if (typeof window === "undefined") return;
  
  const token = getToken();
  if (token && !isTokenExpired(token)) {
    scheduleTokenRefresh();
  } else if (token && isTokenExpired(token)) {
    // Token is expired, try to refresh
    refreshAccessToken();
  }
}
