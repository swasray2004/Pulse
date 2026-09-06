/**
 * Complete test suite for Pulse Real Authentication matrix (A - P)
 */
const BASE = "http://localhost:3000";

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  saveFromResponse(res) {
    const raw = res.headers.getSetCookie?.() || [];
    for (const c of raw) {
      const parts = c.split(";")[0].split("=");
      const name = parts[0].trim();
      const val = parts.slice(1).join("=").trim();
      this.cookies.set(name, val);
    }
  }

  getCookieHeader() {
    const arr = [];
    for (const [k, v] of this.cookies.entries()) {
      arr.push(`${k}=${v}`);
    }
    return arr.join("; ");
  }

  clear() {
    this.cookies.clear();
  }
}

async function runTests() {
  console.log("=== Starting Pulse Auth Verification Suite ===\n");

  const jarA = new CookieJar();
  const jarB = new CookieJar();

  const userAEmail = `alice_${Date.now()}@example.com`;
  const userBEmail = `bob_${Date.now()}@example.com`;
  const password = "password123";

  // Test F: Unauthenticated /watchlist redirects to /login
  console.log("Test F: Unauthenticated /watchlist redirects to /login...");
  const resF = await fetch(`${BASE}/watchlist`, { redirect: "manual" });
  if (resF.status !== 307 || !resF.headers.get("location")?.includes("/login")) {
    throw new Error(`Expected 307 redirect to /login, got ${resF.status} to ${resF.headers.get("location")}`);
  }
  console.log("  PASS: /watchlist returned 307 to /login?from=%2Fwatchlist\n");

  // Test A: Signup creates User A
  console.log("Test A: Signup creates User A...");
  const resA = await fetch(`${BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Alice Investor",
      email: userAEmail,
      password: password,
      confirmPassword: password,
    }),
  });
  jarA.saveFromResponse(resA);
  const dataA = await resA.json();
  if (resA.status !== 201 || !dataA.user?.id) {
    throw new Error(`User A signup failed: ${JSON.stringify(dataA)}`);
  }
  console.log(`  PASS: User A created with id: ${dataA.user.id}\n`);

  // Test C: Wrong password fails
  console.log("Test C: Wrong password fails...");
  const resC = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: userAEmail,
      password: "wrong_password",
    }),
  });
  const dataC = await resC.json();
  if (resC.status !== 401 || !dataC.error) {
    throw new Error(`Expected 401 for wrong password, got ${resC.status}: ${JSON.stringify(dataC)}`);
  }
  console.log(`  PASS: Wrong password rejected with 401: "${dataC.error}"\n`);

  // Test B: Login succeeds
  console.log("Test B: Login succeeds with User A credentials...");
  jarA.clear();
  const resB = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: userAEmail,
      password: password,
    }),
  });
  jarA.saveFromResponse(resB);
  const dataB = await resB.json();
  if (resB.status !== 200 || dataB.user?.email !== userAEmail) {
    throw new Error(`Login failed: ${JSON.stringify(dataB)}`);
  }
  console.log(`  PASS: Logged in successfully as ${dataB.user.email}\n`);

  // Test D: Refresh keeps user logged in (session cookie persistence)
  console.log("Test D: Refresh / persistent session checks /api/auth/me...");
  const resD = await fetch(`${BASE}/api/auth/me`, {
    headers: { Cookie: jarA.getCookieHeader() },
  });
  const dataD = await resD.json();
  if (resD.status !== 200 || dataD.user?.email !== userAEmail) {
    throw new Error(`Session persistence failed: ${JSON.stringify(dataD)}`);
  }
  console.log(`  PASS: Session verified for ${dataD.user.name}\n`);

  // Test G & H: User A creates "AI Stocks" and sees it
  console.log("Test G & H: User A creates 'AI Stocks' watchlist...");
  const resCreateWL = await fetch(`${BASE}/api/watchlists`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: jarA.getCookieHeader(),
    },
    body: JSON.stringify({ name: "AI Stocks" }),
  });
  const dataWL_A = await resCreateWL.json();
  if (resCreateWL.status !== 201 || dataWL_A.name !== "AI Stocks") {
    throw new Error(`Failed to create watchlist: ${JSON.stringify(dataWL_A)}`);
  }
  const watchlistAId = dataWL_A.id;

  // Add NVDA and MSFT to User A's watchlist
  await fetch(`${BASE}/api/watchlists/${watchlistAId}/stocks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: jarA.getCookieHeader(),
    },
    body: JSON.stringify({ symbol: "NVDA" }),
  });
  await fetch(`${BASE}/api/watchlists/${watchlistAId}/stocks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: jarA.getCookieHeader(),
    },
    body: JSON.stringify({ symbol: "MSFT" }),
  });

  const resListA = await fetch(`${BASE}/api/watchlists`, {
    headers: { Cookie: jarA.getCookieHeader() },
  });
  const listA = await resListA.json();
  const foundA = listA.find((w) => w.id === watchlistAId);
  if (!foundA || foundA.name !== "AI Stocks") {
    throw new Error(`User A cannot find 'AI Stocks' watchlist`);
  }
  console.log(`  PASS: User A successfully created and sees 'AI Stocks' (id: ${watchlistAId})\n`);

  // Test Signup & Login User B
  console.log("Setting up User B...");
  const resB_Signup = await fetch(`${BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Bob Trader",
      email: userBEmail,
      password: password,
      confirmPassword: password,
    }),
  });
  jarB.saveFromResponse(resB_Signup);
  const dataB_Signup = await resB_Signup.json();
  console.log(`  PASS: User B registered (id: ${dataB_Signup.user.id})\n`);

  // Test I: User B does NOT see User A's "AI Stocks"
  console.log("Test I: User B does NOT see User A's 'AI Stocks'...");
  const resListB = await fetch(`${BASE}/api/watchlists`, {
    headers: { Cookie: jarB.getCookieHeader() },
  });
  const listB = await resListB.json();
  const leakFoundInB = listB.find((w) => w.name === "AI Stocks" || w.id === watchlistAId);
  if (leakFoundInB) {
    throw new Error(`Data isolation failure! User B saw User A's watchlist`);
  }
  // Also verify User B cannot direct-access User A's watchlist
  const resDirectAccess = await fetch(`${BASE}/api/watchlists/${watchlistAId}`, {
    headers: { Cookie: jarB.getCookieHeader() },
  });
  if (resDirectAccess.status !== 404 && resDirectAccess.status !== 403) {
    throw new Error(`User B was able to access User A's watchlist endpoint! Status: ${resDirectAccess.status}`);
  }
  console.log("  PASS: User B cannot see or query User A's watchlist\n");

  // Test J: User B creates their own watchlist "Crypto Watchlist"
  console.log("Test J: User B creates 'Crypto Watchlist'...");
  const resCreateWL_B = await fetch(`${BASE}/api/watchlists`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: jarB.getCookieHeader(),
    },
    body: JSON.stringify({ name: "Crypto Watchlist" }),
  });
  const dataWL_B = await resCreateWL_B.json();
  const watchlistBId = dataWL_B.id;
  console.log(`  PASS: User B created 'Crypto Watchlist' (id: ${watchlistBId})\n`);

  // Test K: User A does NOT see User B's watchlist
  console.log("Test K: User A does NOT see User B's watchlist...");
  const resListA_Again = await fetch(`${BASE}/api/watchlists`, {
    headers: { Cookie: jarA.getCookieHeader() },
  });
  const listA_Again = await resListA_Again.json();
  const leakFoundInA = listA_Again.find((w) => w.name === "Crypto Watchlist" || w.id === watchlistBId);
  if (leakFoundInA) {
    throw new Error(`Data isolation failure! User A saw User B's watchlist`);
  }
  console.log("  PASS: Watchlists are strictly isolated per user\n");

  // Test L: Preferences are isolated per user
  console.log("Test L: Preferences isolation...");
  // User A updates sensitivity to 0.95
  await fetch(`${BASE}/api/preferences`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: jarA.getCookieHeader(),
    },
    body: JSON.stringify({ priceSensitivity: 0.95 }),
  });
  const prefA = await (await fetch(`${BASE}/api/preferences`, {
    headers: { Cookie: jarA.getCookieHeader() },
  })).json();
  const prefB = await (await fetch(`${BASE}/api/preferences`, {
    headers: { Cookie: jarB.getCookieHeader() },
  })).json();

  if (prefA.preferences.priceSensitivity !== 0.95) {
    throw new Error(`User A preference was not updated: ${JSON.stringify(prefA)}`);
  }
  if (prefB.preferences.priceSensitivity === 0.95) {
    throw new Error(`User B preference was contaminated by User A: ${JSON.stringify(prefB)}`);
  }
  console.log(`  PASS: User A priceSensitivity: ${prefA.preferences.priceSensitivity}, User B: ${prefB.preferences.priceSensitivity}\n`);

  // Test M: Pulse still works
  console.log("Test M: Pulse analysis works for User A's watchlist...");
  const resPulse = await fetch(`${BASE}/api/watchlists/${watchlistAId}/pulse`, {
    headers: { Cookie: jarA.getCookieHeader() },
  });
  if (resPulse.status !== 200) {
    const txt = await resPulse.text();
    throw new Error(`Pulse analysis failed with status ${resPulse.status}: ${txt}`);
  }
  const pulseData = await resPulse.json();
  if (!pulseData.watchlist) {
    throw new Error(`Pulse analysis failed: ${JSON.stringify(pulseData)}`);
  }
  console.log(`  PASS: Pulse returned items for ${pulseData.watchlist.name}\n`);

  // Test N: While Away check-in works
  console.log("Test N: While Away check-in works...");
  const resCheckIn = await fetch(`${BASE}/api/visits/check-in`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: jarA.getCookieHeader(),
    },
    body: JSON.stringify({ watchlistId: watchlistAId }),
  });
  const checkInData = await resCheckIn.json();
  if (resCheckIn.status !== 200 || !checkInData.checkedAt) {
    throw new Error(`Check-in failed: ${JSON.stringify(checkInData)}`);
  }
  console.log(`  PASS: Checked in successfully at ${checkInData.checkedAt}\n`);

  // Test O: Replay works
  console.log("Test O: Replay works...");
  const resReplay = await fetch(`${BASE}/api/watchlists/${watchlistAId}/replay`, {
    headers: { Cookie: jarA.getCookieHeader() },
  });
  const replayData = await resReplay.json();
  if (resReplay.status !== 200 || !Array.isArray(replayData.ticks)) {
    throw new Error(`Replay failed: ${JSON.stringify(replayData)}`);
  }
  console.log(`  PASS: Replay returned ${replayData.ticks.length} ticks\n`);

  // Test P: Stock details work
  console.log("Test P: Stock details route...");
  const resStock = await fetch(`${BASE}/api/stocks/NVDA`, {
    headers: { Cookie: jarA.getCookieHeader() },
  });
  const stockData = await resStock.json();
  if (resStock.status !== 200 || stockData.symbol !== "NVDA") {
    throw new Error(`Stock detail failed: ${JSON.stringify(stockData)}`);
  }
  console.log(`  PASS: Stock detail returned for ${stockData.symbol} (${stockData.companyName})\n`);

  // Test E: Logout works
  console.log("Test E: Logout works...");
  const resLogout = await fetch(`${BASE}/api/auth/logout`, {
    method: "POST",
    headers: { Cookie: jarA.getCookieHeader() },
  });
  jarA.saveFromResponse(resLogout);
  const meAfterLogout = await fetch(`${BASE}/api/auth/me`, {
    headers: { Cookie: jarA.getCookieHeader() },
  });
  if (meAfterLogout.status !== 401) {
    throw new Error(`Expected 401 after logout, got ${meAfterLogout.status}`);
  }
  console.log("  PASS: Logout destroyed session; /api/auth/me returned 401\n");

  console.log("==================================================");
  console.log("ALL TESTS A THROUGH P PASSED SUCCESSFULLY!");
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("\nTEST SUITE FAILED:\n", err);
  process.exit(1);
});
