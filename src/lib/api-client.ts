async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  listWatchlists: () => request<{ watchlists: any[] }>("/watchlists"),
  createWatchlist: (name: string) =>
    request<{ watchlist: any }>("/watchlists", { method: "POST", body: JSON.stringify({ name }) }),
  addStock: (watchlistId: string, symbol: string) =>
    request<{ stock: any }>(`/watchlists/${watchlistId}/stocks`, {
      method: "POST",
      body: JSON.stringify({ symbol }),
    }),
  removeStock: (watchlistId: string, symbol: string) =>
    request<{ ok: boolean }>(`/watchlists/${watchlistId}/stocks/${symbol}`, { method: "DELETE" }),
  getPulse: (watchlistId: string) => request<any>(`/watchlists/${watchlistId}/pulse`),
  getChanges: (watchlistId: string) => request<any>(`/watchlists/${watchlistId}/changes`),
  getReplay: (watchlistId: string) => request<any>(`/watchlists/${watchlistId}/replay`),
  getStock: (symbol: string, watchlistId?: string) =>
    request<any>(`/stocks/${symbol}${watchlistId ? `?watchlistId=${watchlistId}` : ""}`),
  searchStocks: (q: string) => request<{ results: any[] }>(`/stocks/search?q=${encodeURIComponent(q)}`),
  checkIn: (watchlistId: string) =>
    request<any>("/visits/check-in", { method: "POST", body: JSON.stringify({ watchlistId }) }),
  getPreferences: () => request<any>("/preferences"),
  updatePreferences: (patch: Record<string, number>) =>
    request<any>("/preferences", { method: "PATCH", body: JSON.stringify(patch) }),
  getMarketContext: (watchlistId: string) => request<any>(`/market/context?watchlistId=${watchlistId}`),
};
