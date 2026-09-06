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

// ─── Shared types ────────────────────────────────────────────────────────────

export interface WatchlistStock {
  id: string;
  symbol: string;
  companyName: string;
  exchange: string;
  sector: string;
  position: number;
}

export interface Watchlist {
  id: string;
  name: string;
  stocks: WatchlistStock[];
}

export interface AttentionInfo {
  score: number;
  classification: string;
  reason: string;
  priceChangePct: number;
  volumeRatio: number;
  relativeToBenchmarkPct?: number;
  relativeToSectorPct?: number;
  signals?: {
    price: number;
    volume: number;
    relativePerformance: number;
    event: number;
    volatility: number;
    personalization: number;
  };
}

export interface PulseSignal {
  symbol: string;
  companyName: string;
  attention: AttentionInfo;
  state: string;
  windowStart: string;
  windowEnd: string;
}

export interface TimelineTick {
  time: string;
  label: string;
}

export interface PulseResult {
  watchlist: { id: string; name: string };
  awaySummary: {
    awayLabel: string;
    totalMovements: number;
    meaningfulCount: number;
    filteredCount: number;
    isLongAbsence: boolean;
  };
  signals: PulseSignal[];
  noise: PulseSignal[];
  timeline: TimelineTick[];
}

export interface ReplayTick {
  time: string;
  symbol: string;
  price: number;
  kind: "price" | "event";
  label?: string;
}

export interface ReplayResult {
  start: string;
  end: string;
  ticks: ReplayTick[];
}

export interface StockSearchResult {
  symbol: string;
  companyName: string;
  exchange: string;
  sector: string;
}

export interface Preferences {
  priceSensitivity: number;
  volumeSensitivity: number;
  newsSensitivity: number;
  eventSensitivity: number;
  relativePerformanceSensitivity: number;
  breakoutSensitivity: number;
}

// ─── API Client ──────────────────────────────────────────────────────────────

export const api = {
  listWatchlists: async (): Promise<{ watchlists: Watchlist[] }> => {
    const watchlists = await request<Watchlist[]>("/watchlists");
    return { watchlists };
  },

  createWatchlist: async (name: string): Promise<{ watchlist: Watchlist }> => {
    const watchlist = await request<Watchlist>("/watchlists", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    return { watchlist };
  },

  login: (email: string, password: string) =>
    request<{ user: { id: string; email: string; name: string | null } }>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      },
    ),

  signup: (data: {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
  }) =>
    request<{ user: { id: string; email: string; name: string | null } }>(
      "/auth/signup",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    ),

  logout: () =>
    request<{ ok: boolean }>("/auth/logout", {
      method: "POST",
    }),

  me: () =>
    request<{ user: { id: string; email: string; name: string | null } }>(
      "/auth/me",
    ),

  addStock: (watchlistId: string, symbol: string) =>
    request<{ stock: WatchlistStock }>(`/watchlists/${watchlistId}/stocks`, {
      method: "POST",
      body: JSON.stringify({ symbol }),
    }),

  removeStock: (watchlistId: string, symbol: string) =>
    request<{ ok: boolean }>(`/watchlists/${watchlistId}/stocks/${symbol}`, {
      method: "DELETE",
    }),

  getPulse: async (watchlistId: string): Promise<PulseResult> => {
    const data = await request<{
      watchlist: { id: string; name: string };
      summary: { analyzedStocks: number };
      items: Array<{
        symbol: string;
        companyName: string;
        score: number;
        classification: string;
        reason: string;
        priceChangePct: number;
        volumeRatio: number;
        state: string;
        windowStart: string;
        windowEnd: string;
      }>;
    }>(`/watchlists/${watchlistId}/pulse`);

    const toSignal = (item: typeof data.items[0]): PulseSignal => ({
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
    });

    const items = data.items ?? [];

    const signals = items
      .filter((item) => item.classification !== "NORMAL")
      .map(toSignal);

    const noise = items
      .filter((item) => item.classification === "NORMAL")
      .map(toSignal);

    // Build a timeline from the pulse items for the "While Away" page.
    // Each item with valid price change becomes a timeline event.
    const timeline: TimelineTick[] = items
      .filter((item) => item.windowEnd)
      .sort(
        (a, b) =>
          new Date(a.windowEnd).getTime() - new Date(b.windowEnd).getTime(),
      )
      .map((item) => ({
        time: item.windowEnd,
        label: item.reason,
      }));

    return {
      watchlist: data.watchlist,
      awaySummary: {
        awayLabel: "4 hours",
        totalMovements: data.summary?.analyzedStocks ?? 0,
        meaningfulCount: signals.length,
        filteredCount: noise.length,
        isLongAbsence: false,
      },
      signals,
      noise,
      timeline,
    };
  },

  getChanges: (watchlistId: string) =>
    request<unknown>(`/watchlists/${watchlistId}/changes`),

  getReplay: (watchlistId: string) =>
    request<ReplayResult>(`/watchlists/${watchlistId}/replay`),

  getStock: (symbol: string, watchlistId?: string) =>
    request<unknown>(
      `/stocks/${symbol}${watchlistId ? `?watchlistId=${watchlistId}` : ""}`,
    ),

  searchStocks: (q: string) =>
    request<{ results: StockSearchResult[] }>(
      `/stocks/search?q=${encodeURIComponent(q)}`,
    ),

  checkIn: (watchlistId: string) =>
    request<unknown>("/visits/check-in", {
      method: "POST",
      body: JSON.stringify({ watchlistId }),
    }),

  getPreferences: () =>
    request<{ preferences: Record<string, number> }>("/preferences"),

  updatePreferences: (patch: Record<string, number>) =>
    request<{ preferences: Record<string, number> }>("/preferences", {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  getMarketContext: (watchlistId: string) =>
    request<unknown>(`/market/context?watchlistId=${watchlistId}`),
};
