(() => {
  const $ = (s) => document.querySelector(s);
  const searchForm = $('#search-form');
  const searchInput = $('#search-input');
  const resultCard = $('#result-card');
  const emptyState = $('#empty-state');
  const suggestionsEl = $('#suggestions');
  const chipsEl = $('#category-chips');
  const datalist = $('#item-suggestions');
  const statItems = $('#stat-items');

  const categories = ['All', ...Array.from(new Set(ITEMS.map(i => i.category)))];
  let activeCategory = 'All';

  function normalize(str) {
    return str.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
  }

  function scoreItem(item, query) {
    const q = normalize(query);
    if (!q) return 0;
    const name = normalize(item.name);
    const keywords = item.keywords.map(normalize);
    if (name === q) return 100;
    if (name.startsWith(q)) return 80;
    if (name.includes(q)) return 60;
    if (keywords.some(k => k === q)) return 70;
    if (keywords.some(k => k.includes(q) || q.includes(k))) return 50;
    const tokens = q.split(' ').filter(Boolean);
    const hay = [name, ...keywords, normalize(item.category)].join(' ');
    const hits = tokens.filter(t => hay.includes(t)).length;
    if (hits === tokens.length && hits > 0) return 40;
    if (hits > 0) return 20;
    return 0;
  }

  function findMatches(query, category) {
    const pool = category && category !== 'All' ? ITEMS.filter(i => i.category === category) : ITEMS;
    if (!query.trim()) return pool.map(item => ({ item, score: 1 }));
    return pool
      .map(item => ({ item, score: scoreItem(item, query) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function statusClass(status) {
    const s = normalize(status);
    if (s === 'yes') return 'status-yes';
    if (s === 'no') return 'status-no';
    return 'status-limited';
  }

  function mapsLink(location) {
    const q = encodeURIComponent(location + ' near me');
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  }

  function renderResult(item) {
    emptyState.classList.add('hidden');
    suggestionsEl.classList.add('hidden');
    suggestionsEl.innerHTML = '';
    resultCard.classList.remove('hidden');

    const reuseList = item.reuseIdeas.map(i => `<li>${escapeHtml(i)}</li>`).join('');
    const locations = item.disposalLocations.map(loc =>
      `<li><a class="location-link" href="${mapsLink(loc)}" target="_blank" rel="noopener noreferrer"><span class="loc-icon" aria-hidden="true">📍</span><span>${escapeHtml(loc)}</span><span class="ext" aria-hidden="true">↗</span></a></li>`
    ).join('');

    resultCard.innerHTML = `
      <div class="result-header">
        <div>
          <p class="result-category">${escapeHtml(item.category)}</p>
          <h3 class="result-title">${escapeHtml(item.name)}</h3>
        </div>
        <div class="reuse-badge ${statusClass(item.reusable)}">
          <span class="badge-label">♻️ Can be Reused?</span>
          <span class="badge-value">${escapeHtml(item.reusable)}</span>
        </div>
      </div>

      <div class="result-grid">
        <div class="info-block">
          <h4><span class="block-icon">🔄</span> Reuse Ideas</h4>
          <ul class="detail-list">${reuseList}</ul>
        </div>
        <div class="info-block">
          <h4><span class="block-icon">🗑️</span> Recycling Information</h4>
          <p>${escapeHtml(item.recyclingInfo)}</p>
        </div>
        <div class="info-block">
          <h4><span class="block-icon">📍</span> Where to Recycle / Dispose</h4>
          <ul class="location-list">${locations}</ul>
          <p class="location-note">Links open a map search so you can find nearby options.</p>
        </div>
        <div class="info-block benefit-block">
          <h4><span class="block-icon">🌱</span> Environmental Benefit</h4>
          <p>${escapeHtml(item.environmentalBenefit)}</p>
          <div class="item-tip"><strong>Tip:</strong> ${escapeHtml(item.tip)}</div>
        </div>
      </div>
    `;
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function renderSuggestions(matches, query) {
    emptyState.classList.add('hidden');
    resultCard.classList.add('hidden');
    resultCard.innerHTML = '';
    suggestionsEl.classList.remove('hidden');

    if (!matches.length) {
      suggestionsEl.innerHTML = `
        <div class="no-results">
          <div class="empty-icon" aria-hidden="true">🧭</div>
          <h3>No match found for "${escapeHtml(query)}"</h3>
          <p>Try a different name, or browse by category. You can also search common items like batteries, clothes, or glass jars.</p>
        </div>`;
      return;
    }

    const shown = matches.slice(0, 8);
    suggestionsEl.innerHTML = `
      <div class="suggestions-head">
        <h3>${query.trim() ? 'Did you mean one of these?' : 'Browse items'}</h3>
        <p>${shown.length} item${shown.length !== 1 ? 's' : ''} found</p>
      </div>
      <div class="suggestion-grid">
        ${shown.map(({ item }) => `
          <button class="suggestion-card" data-id="${escapeHtml(item.id)}" type="button">
            <span class="suggestion-cat">${escapeHtml(item.category)}</span>
            <span class="suggestion-name">${escapeHtml(item.name)}</span>
            <span class="suggestion-status ${statusClass(item.reusable)}">Reuse: ${escapeHtml(item.reusable)}</span>
          </button>
        `).join('')}
      </div>`;
  }

  function handleSearch(query) {
    const q = query.trim();
    const matches = findMatches(q, activeCategory);
    if (q && matches.length > 0 && matches[0].score >= 60) {
      renderResult(matches[0].item);
      if (matches.length > 1) {
        const others = matches.slice(1, 5);
        suggestionsEl.classList.remove('hidden');
        suggestionsEl.innerHTML = `
          <div class="suggestions-head"><h3>Related items</h3></div>
          <div class="suggestion-grid">
            ${others.map(({ item }) => `
              <button class="suggestion-card" data-id="${escapeHtml(item.id)}" type="button">
                <span class="suggestion-cat">${escapeHtml(item.category)}</span>
                <span class="suggestion-name">${escapeHtml(item.name)}</span>
                <span class="suggestion-status ${statusClass(item.reusable)}">Reuse: ${escapeHtml(item.reusable)}</span>
              </button>
            `).join('')}
          </div>`;
      }
      return;
    }
    renderSuggestions(matches, q);
  }

  function renderChips() {
    chipsEl.innerHTML = categories.map(cat =>
      `<button type="button" class="chip ${cat === activeCategory ? 'active' : ''}" data-category="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`
    ).join('');
  }

  function populateDatalist() {
    datalist.innerHTML = ITEMS.map(i => `<option value="${escapeHtml(i.name)}">`).join('');
  }

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSearch(searchInput.value);
  });

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim();
    if (!q) {
      resultCard.classList.add('hidden');
      suggestionsEl.classList.add('hidden');
      emptyState.classList.remove('hidden');
    }
  });

  chipsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-category]');
    if (!btn) return;
    activeCategory = btn.dataset.category;
    renderChips();
    const q = searchInput.value.trim();
    if (q) {
      handleSearch(q);
    } else if (activeCategory !== 'All') {
      renderSuggestions(findMatches('', activeCategory), '');
    } else {
      resultCard.classList.add('hidden');
      suggestionsEl.classList.add('hidden');
      emptyState.classList.remove('hidden');
    }
  });

  suggestionsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-id]');
    if (!btn) return;
    const item = ITEMS.find(i => i.id === btn.dataset.id);
    if (item) {
      searchInput.value = item.name;
      renderResult(item);
    }
  });

  statItems.textContent = String(ITEMS.length);
  renderChips();
  populateDatalist();
})();
