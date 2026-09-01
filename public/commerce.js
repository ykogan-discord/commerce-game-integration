// Tab 3 is a deliberate scaffold — structure only, no data and no backend.
// It shows a teammate exactly where each piece goes and which Discord Commerce
// endpoint it maps to. Wiring it up is the exercise for the reader.
(function () {
  function bars(n) {
    // Static skeleton bars — purely decorative, not real data.
    const heights = [40, 65, 30, 80, 55, 70, 45, 90, 60];
    return heights
      .slice(0, n)
      .map((h) => `<span style="height:${h}%"></span>`)
      .join("");
  }

  const HTML = `
    <div class="commerce-head">
      <h2>Commerce debugging</h2>
      <p class="muted">Purchases, entitlements, fulfillment &amp; analytics.</p>
    </div>

    <div class="scaffold-banner">
      🚧 <b>Scaffold only.</b> These sections are intentionally empty — no backend is wired up.
      Each one notes the Discord Commerce endpoint it should read from. Building them out is the
      exercise for the reader.
    </div>

    <div class="scaffold-section">
      <h3>🔎 Entitlement inspector</h3>
      <p class="section-note">
        List &amp; filter entitlements (by user, SKU, active / consumed / fulfillment status), then
        click a row to inspect the full payload. Backed by the commerce API's entitlements read.
      </p>
      <div class="empty-state">No entitlements loaded. Wire this to the entitlements API to populate the table.</div>
    </div>

    <div class="scaffold-section">
      <h3>🧾 Fulfillment debug log</h3>
      <p class="section-note">
        A reverse-chronological event timeline: purchase → entitlement created → fulfilled → consumed,
        each with an expandable payload. Feed from fulfillment and revocation events.
      </p>
      <div class="empty-state">No events yet. This timeline renders once fulfillment events start flowing.</div>
    </div>

    <div class="scaffold-section">
      <h3>📊 Analytics</h3>
      <p class="section-note">
        Aggregate views: purchases over time, revenue, and top SKUs. Derive from entitlement history.
      </p>
      <div class="chart-row">
        <div class="chart-card">
          <div class="chart-title">Purchases over time</div>
          <div class="chart-skeleton">${bars(9)}</div>
        </div>
        <div class="chart-card">
          <div class="chart-title">Revenue</div>
          <div class="chart-skeleton">${bars(9)}</div>
        </div>
        <div class="chart-card">
          <div class="chart-title">Top SKUs</div>
          <div class="chart-skeleton">${bars(6)}</div>
        </div>
      </div>
    </div>
  `;

  window.renderCommerce = function renderCommerce(root) {
    if (root && !root.dataset.rendered) {
      root.innerHTML = HTML;
      root.dataset.rendered = "true";
    }
  };
})();
