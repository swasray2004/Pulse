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
  listWatchlists: async () => {
    const watchlists = await request<any[]>(
      "/watchlists?userId=test-user-001",
    );

    return { watchlists };
  },

  createWatchlist: async (name: string) => {
    const watchlist = await request<any>("/watchlists", {
      method: "POST",
      body: JSON.stringify({
        name,
        userId: "test-user-001",
      }),
    });

    return { watchlist };
  },
  addStock: (watchlistId: string, symbol: string) =>
    request<{ stock: any }>(`/watchlists/${watchlistId}/stocks`, {
      method: "POST",
      body: JSON.stringify({ symbol }),
    }),
  removeStock: (watchlistId: string, symbol: string) =>
    request<{ ok: boolean }>(`/watchlists/${watchlistId}/stocks/${symbol}`, { method: "DELETE" }),
  getPulse: async (watchlistId: string) => {
    const data = await request<any>(
      `/watchlists/${watchlistId}/pulse`,
    );

    const signals = data.items
      .filter((item: any) => item.classification !== "NORMAL")
      .map((item: any) => ({
        symbol: item.symbol,
        companyName: item.companyName,
        attention: {
          score: item.score,
          classification: item.classification,
          reason: item.reason,
          priceChangePct: item.priceChangePct,
          volumeRatio: item.volumeRatio,
        },
        state: item.state,
        windowStart: item.windowStart,
        windowEnd: item.windowEnd,
      }));

    const noise = data.items
      .filter((item: any) => item.classification === "NORMAL")
      .map((item: any) => ({
        symbol: item.symbol,
        companyName: item.companyName,
        attention: {
          score: item.score,
          classification: item.classification,
          reason: item.reason,
          priceChangePct: item.priceChangePct,
          volumeRatio: item.volumeRatio,
        },
        state: item.state,
        windowStart: item.windowStart,
        windowEnd: item.windowEnd,
      }));

    return {
      watchlist: data.watchlist,
      awaySummary: {
        awayLabel: "Since your last check-in",
        totalMovements: data.summary.analyzedStocks,
        meaningfulCount:
          signals.length,
        filteredCount:
          noise.length,
        isLongAbsence: false,
      },
      signals,
      noise,
    };
  },
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
