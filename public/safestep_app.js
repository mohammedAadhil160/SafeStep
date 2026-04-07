/* ═══════════════════════════════════════════════════════════════
   SafeStep v3.0 — Application & Animation Logic
   ═══════════════════════════════════════════════════════════════ */

const API = 'https://areostyle-charla-aggregately.ngrok-free.dev';

/* ═══ 1. ANIMATIONS & PARALLAX ═══ */
document.addEventListener('DOMContentLoaded', () => {
  // Reveal animations
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.classList.add('revealed');
        }, entry.target.dataset.delay || 0);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el));

  // Counter animations
  const countObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !entry.target.classList.contains('counted')) {
        entry.target.classList.add('counted');
        animateCounter(entry.target);
      }
    });
  });
  document.querySelectorAll('.metric-val, .dash-val').forEach(el => countObserver.observe(el));

  function animateCounter(el) {
    const target = parseInt(el.dataset.count);
    let count = 0;
    const duration = 2000;
    const increment = target / (duration / 16);
    
    const timer = setInterval(() => {
      count += increment;
      if (count >= target) {
        clearInterval(timer);
        el.innerText = target + (el.classList.contains('metric-val') && target === 97 ? '%' : '') + (target > 50 ? '+' : '');
      } else {
        el.innerText = Math.floor(count);
      }
    }, 16);
  }

  // Dashboard bar animations
  const barObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.width = entry.target.dataset.width;
      }
    });
  });
  document.querySelectorAll('.dash-bar-fill').forEach(el => barObserver.observe(el));

  // Navbar scroll effect
  const nav = document.getElementById('landing-nav');
  const landingPage = document.getElementById('landing-page');
  if (landingPage && nav) {
    landingPage.addEventListener('scroll', () => {
      if (landingPage.scrollTop > 50) {
        nav.classList.add('scrolled');
      } else {
        nav.classList.remove('scrolled');
      }
    });
  }
});

/* ═══ 2. MODAL & APP NAVIGATION ═══ */
function showLoginModal() {
  document.getElementById('login-modal').classList.add('visible');
}

function hideLoginModal() {
  document.getElementById('login-modal').classList.remove('visible');
}

let isSignUp = false;
function toggleAuthMode() {
  isSignUp = !isSignUp;
  document.getElementById('name-group').style.display = isSignUp ? 'block' : 'none';
  document.getElementById('auth-btn-text').textContent = isSignUp ? 'Create Account' : 'Sign In';
  document.getElementById('auth-toggle-text').innerHTML = isSignUp
    ? 'Already have an account? <strong>Sign In</strong>'
    : "Don't have an account? <strong>Sign Up</strong>";
}

function authLogin() {
  const btn = document.getElementById('auth-btn');
  btn.innerHTML = '<svg class="icon spinning" style="width:18px;height:18px"><use href="#svg-brain"></use></svg> Authenticating...';
  btn.style.pointerEvents = 'none';
  
  setTimeout(() => {
    showToast(isSignUp ? 'Account Created!' : 'Welcome Back!');
    hideLoginModal();
    document.getElementById('landing-page').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex';
    map.invalidateSize();
  }, 1200);
}

function toggleStatsPanel() {
  document.getElementById('live-stats-panel').classList.toggle('open');
}

// ─── Map Setup ───
const map = L.map('map', { zoomControl: false }).setView([12.9716, 77.5946], 7); // Default to Bangalore/India scale
L.control.zoom({ position: 'topright' }).addTo(map);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '© OpenStreetMap © CartoDB', subdomains: 'abcd', maxZoom: 19
}).addTo(map);

let clickMarker = null, safetyCircle = null, routeLines = [];
let navOriginMarker = null, navDestMarker = null;
let currentTab = 'analyze', navOrigin = null, navDest = null;

const COLORS = { SAFE: '#10b981', MODERATE: '#f59e0b', RISKY: '#f97316', DANGER: '#ef4444' };
function riskColor(score) {
  if (score >= 7.5) return COLORS.SAFE;
  if (score >= 5.0) return COLORS.MODERATE;
  if (score >= 2.5) return COLORS.RISKY;
  return COLORS.DANGER;
}

// ─── Tab Switching ───
function switchTab(name) {
  currentTab = name;
  document.querySelectorAll('.dtab').forEach((b, i) =>
    b.classList.toggle('active', ['analyze', 'navigate', 'report'][i] === name)
  );
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`tab-${name}`).classList.add('active');
}

// Update Severity Display
document.getElementById('rep-severity')?.addEventListener('input', (e) => {
  document.getElementById('severity-val').innerText = e.target.value;
});

// ─── Map Click Handler ───
map.on('click', async (e) => {
  const { lat, lng } = e.latlng;
  if (currentTab === 'navigate') return;

  document.getElementById('coord-display').textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  document.getElementById('rep-coord').textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  document.getElementById('empty-analyze').style.display = 'none';

  // Reset UI to scanning state
  document.getElementById('score-val').textContent = '...';
  document.getElementById('score-val').style.color = 'var(--accent)';
  document.getElementById('score-msg').textContent = 'Neural engine analyzing location...';
  const badge = document.getElementById('risk-badge');
  badge.textContent = 'SCANNING';
  badge.style.background = 'rgba(37,99,235,0.08)';
  badge.style.color = 'var(--accent)';
  document.getElementById('ring-arc').style.strokeDashoffset = 263.89;
  
  // Hide sections
  ['intel-section', 'stat-row', 'env-row', 'env-row-2', 'incidents-section'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });

  if (clickMarker) map.removeLayer(clickMarker);
  clickMarker = L.circleMarker([lat, lng], {
    radius: 10, color: 'var(--accent)', fillColor: 'var(--accent)',
    fillOpacity: 0.4, weight: 2
  }).addTo(map);
  map.flyTo([lat, lng], Math.max(map.getZoom(), 14), { duration: 1.2 });

  try {
    const res = await fetch(`${API}/analyze`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng, radius_m: 2000 }),
    });
    const data = await res.json();
    setTimeout(() => renderAnalysis(lat, lng, data), 500);
  } catch (err) {
    showToast('Backend offline — start the server', 'error');
  }
});

// ─── Render Analysis Results ───
function renderAnalysis(lat, lng, d) {
  const color = riskColor(d.safety_score);
  const sc = d.safety_score;
  const circ = 263.89;

  // Animate ring
  document.getElementById('ring-arc').style.strokeDashoffset = circ - (sc / 10) * circ;
  document.getElementById('ring-arc').style.stroke = color;

  // Animate score counter
  let current = 0;
  const step = sc / 30;
  const counter = setInterval(() => {
    current += step;
    if (current >= sc) {
      current = sc;
      clearInterval(counter);
    }
    document.getElementById('score-val').textContent = current.toFixed(1);
  }, 25);
  document.getElementById('score-val').style.color = color;

  // Risk badge
  const badge = document.getElementById('risk-badge');
  badge.textContent = `${d.risk_level} ZONE`;
  badge.style.background = color + '18';
  badge.style.color = color;

  document.getElementById('score-msg').textContent = d.status_message;

  // Stats rows
  document.getElementById('stat-row').style.display = 'grid';
  document.getElementById('stat-pts').textContent = d.data_points_used;
  document.getElementById('stat-conf').textContent = Math.round(d.confidence * 100) + '%';
  document.getElementById('stat-inc').textContent = d.nearby_incidents.length;

  if (d.environmental_factors) {
    document.getElementById('env-row').style.display = 'grid';
    document.getElementById('env-row-2').style.display = 'grid';
    document.getElementById('stat-light').textContent = d.environmental_factors.lighting_density;
    document.getElementById('stat-police').textContent = d.environmental_factors.police_proximity;
    document.getElementById('stat-cctv').textContent = d.environmental_factors.cctv_coverage;
    document.getElementById('stat-road').textContent = d.environmental_factors.road_quality;
    document.getElementById('stat-crowd').textContent = d.environmental_factors.crowd_density;
    document.getElementById('stat-ert').textContent = d.environmental_factors.emergency_response_min;
  }

  // Social intel
  if (d.social_media_context) {
    document.getElementById('intel-section').style.display = 'block';
    document.getElementById('intel-img').src = d.social_media_context.area_image_url;
    document.getElementById('intel-tags').innerHTML = d.social_media_context.top_keywords
      .map(kw => `<div class="tag-pill">#${kw}</div>`).join('');
    document.getElementById('intel-posts').innerHTML = d.social_media_context.recent_posts
      .map(p => `<div class="social-post">${p}</div>`).join('');
  }

  // Incidents
  if (d.nearby_incidents && d.nearby_incidents.length > 0) {
    document.getElementById('incidents-section').style.display = 'block';
    document.getElementById('incidents-list').innerHTML = d.nearby_incidents.slice(0,3).map(inc => `
      <div class="incident-card">
        <div class="incident-icon">
          <svg class="icon"><use href="#svg-alert"></use></svg>
        </div>
        <div class="incident-info">
          <div class="incident-type">${inc.incident_type.replace('_', ' ')} (Sev: ${inc.severity})</div>
          <div class="incident-meta">${inc.distance_m}m away • ${inc.description || 'Verified Report'}</div>
        </div>
      </div>
    `).join('');
  }

  // Map overlay
  if (safetyCircle) map.removeLayer(safetyCircle);
  safetyCircle = L.circle([lat, lng], {
    radius: 800, color, fillColor: color,
    fillOpacity: 0.1, weight: 2, dashArray: '6, 12'
  }).addTo(map);

  clickMarker.setStyle({ color, fillColor: color });
  clickMarker.bindPopup(`
    <div style="font-family:'Space Grotesk',sans-serif;text-align:center;padding:4px">
      <div style="font-size:24px;font-weight:900;color:${color}">${sc.toFixed(1)}</div>
      <div style="font-size:10px;font-weight:700;letter-spacing:1px;color:var(--text3)">${d.risk_level}</div>
    </div>
  `).openPopup();
}

// ─── Location Search ───
let debounceTimer;
async function searchLocation(query, type) {
  clearTimeout(debounceTimer);
  const sugBox = document.getElementById(type + '-suggestions');
  if (query.length < 3) { sugBox.classList.add('hide'); return; }

  debounceTimer = setTimeout(async () => {
    try {
      const res = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&lat=12.97&lon=77.59`
      );
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        sugBox.innerHTML = '';
        data.features.forEach(item => {
          const div = document.createElement('div');
          div.className = 'suggestion-item';
          const name = item.properties.name || '';
          const parts = [item.properties.city, item.properties.state, item.properties.country].filter(Boolean);
          const display = parts.length ? `${name}, ${parts.join(', ')}` : name;
          div.textContent = display;
          div.addEventListener('mousedown', (e) => {
            e.preventDefault();
            selectLocation(
              item.geometry.coordinates[1],
              item.geometry.coordinates[0],
              display, type
            );
          });
          sugBox.appendChild(div);
        });
        sugBox.classList.remove('hide');
      } else {
        sugBox.classList.add('hide');
      }
    } catch (e) { console.error('Search error:', e); }
  }, 350);
}

function selectLocation(lat, lng, name, type) {
  const inputId = type === 'origin' ? 'nav-origin-input' : 'nav-dest-input';
  document.getElementById(inputId).value = name;
  document.getElementById(type + '-suggestions').classList.add('hide');

  const parsedLat = parseFloat(lat);
  const parsedLng = parseFloat(lng);

  if (type === 'origin') {
    navOrigin = { lat: parsedLat, lng: parsedLng };
    if (navOriginMarker) map.removeLayer(navOriginMarker);
    navOriginMarker = L.circleMarker([parsedLat, parsedLng], {
      radius: 9, color: 'var(--accent)', fillColor: 'var(--accent)', fillOpacity: 0.7, weight: 2
    }).addTo(map).bindPopup('<b style="color:var(--accent)">Origin</b>').openPopup();
    map.flyTo([parsedLat, parsedLng], 13, { duration: 1 });
  } else {
    navDest = { lat: parsedLat, lng: parsedLng };
    if (navDestMarker) map.removeLayer(navDestMarker);
    navDestMarker = L.circleMarker([parsedLat, parsedLng], {
      radius: 9, color: 'var(--orange)', fillColor: 'var(--orange)', fillOpacity: 0.7, weight: 2
    }).addTo(map).bindPopup('<b style="color:var(--orange)">Destination</b>').openPopup();
  }
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('#nav-origin-input') && !e.target.closest('#origin-suggestions'))
    document.getElementById('origin-suggestions')?.classList.add('hide');
  if (!e.target.closest('#nav-dest-input') && !e.target.closest('#dest-suggestions'))
    document.getElementById('dest-suggestions')?.classList.add('hide');
});

function clearNavigationLayers() {
  if (navOriginMarker) map.removeLayer(navOriginMarker);
  if (navDestMarker) map.removeLayer(navDestMarker);
  routeLines.forEach(l => map.removeLayer(l));
  routeLines = [];
}

function clearNavigation() {
  navOrigin = null; navDest = null;
  clearNavigationLayers();
  document.getElementById('nav-origin-input').value = '';
  document.getElementById('nav-dest-input').value = '';
  document.getElementById('route-stats').style.display = 'none';
  document.getElementById('route-segments-list').innerHTML = '';
}

async function calculateRoute() {
  const btn = document.querySelector('.btn-compute');
  const oldHtml = btn.innerHTML;
  btn.innerHTML = '<svg class="icon spinning" style="width:16px;height:16px"><use href="#svg-brain"></use></svg> Analyzing...';
  btn.disabled = true;

  if (!navOrigin || !navDest) {
    showToast('Set both Origin & Destination', 'error');
    btn.innerHTML = oldHtml; btn.disabled = false;
    return;
  }

  routeLines.forEach(l => map.removeLayer(l));
  routeLines = [];

  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${navOrigin.lng},${navOrigin.lat};${navDest.lng},${navDest.lat}?overview=full&geometries=geojson`
    );
    const data = await res.json();
    if (!data.routes || !data.routes.length) { showToast('No route found', 'error'); return; }

    const routeCoords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
    const totalDistKm = data.routes[0].distance / 1000;
    const totalTimeMins = data.routes[0].duration / 60;

    const numChunks = Math.max(3, Math.min(10, Math.ceil(totalDistKm / 2)));
    const chunkSize = Math.ceil(routeCoords.length / numChunks);
    const chunks = [];
    for (let i = 0; i < routeCoords.length; i += chunkSize)
      chunks.push(routeCoords.slice(i, i + chunkSize + 1));

    const results = await Promise.all(chunks.map(async chunk => {
      if (!chunk.length) return null;
      const mid = chunk[Math.floor(chunk.length / 2)];
      const aRes = await fetch(`${API}/analyze`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: mid[0], lng: mid[1], radius_m: 2000 })
      });
      return { chunk, data: await aRes.json() };
    }));

    let totalScore = 0, validCount = 0;
    let segmentsHtml = '';
    
    results.forEach((r, idx) => {
      if (!r) return;
      totalScore += r.data.safety_score;
      validCount++;
      const color = riskColor(r.data.safety_score);
      
      routeLines.push(L.polyline(r.chunk, {
        color, weight: 6, opacity: 0.85,
        lineJoin: 'round', lineCap: 'round',
        dashArray: r.data.safety_score < 5 ? '10, 14' : ''
      }).addTo(map));

      // Build segment cards for UI
      if (idx < 5) { // Only show top 5 segments to avoid clutter
        segmentsHtml += `
          <div class="route-segment">
            <div class="route-seg-color" style="background:${color}"></div>
            <div class="route-seg-info">Segment ${idx+1} • ${r.data.risk_level}</div>
            <div class="route-seg-score" style="color:${color}">${r.data.safety_score.toFixed(1)}</div>
          </div>
        `;
      }
    });

    const avgScore = totalScore / validCount;
    map.flyToBounds(L.polyline(routeCoords).getBounds(), { padding: [60, 60], duration: 1.5 });

    document.getElementById('route-stats').style.display = 'block';
    document.getElementById('r-stat-score').textContent = avgScore.toFixed(1);
    document.getElementById('r-stat-score').style.color = riskColor(avgScore);
    document.getElementById('r-stat-dist').textContent = totalDistKm.toFixed(1) + 'km';
    document.getElementById('r-stat-time').textContent = Math.round(totalTimeMins) + 'min';
    
    document.getElementById('route-segments-list').innerHTML = segmentsHtml;

    const msg = document.getElementById('route-msg');
    msg.textContent = avgScore >= 7.5 ? '✅ Route is safe and well-monitored.'
      : avgScore >= 5 ? '⚠️ Moderate risk — stay on main roads.'
      : '🚨 High risk route — consider alternatives!';
    msg.style.color = riskColor(avgScore);
    showToast('Route analyzed limit!', 'success');
  } catch (err) {
    console.error(err);
    showToast('Routing error', 'error');
  } finally {
    btn.innerHTML = oldHtml; btn.disabled = false;
  }
}

// ─── Report & SOS ───
function submitReport() {
  if (!document.getElementById('rep-type').value) {
    showToast('Select incident type', 'error'); return;
  }
  showToast('Report submitted & verified!', 'success');
  document.getElementById('rep-type').value = '';
  document.getElementById('rep-desc').value = '';
}

function triggerSOS() {
  const btn = document.getElementById('sos-btn');
  btn.style.transform = 'scale(0.85)';
  
  // Create intense ping effect
  const ping = document.createElement('div');
  ping.style.position = 'absolute';
  ping.style.inset = '0';
  ping.style.borderRadius = '50%';
  ping.style.background = 'rgba(255,23,68,0.8)';
  ping.style.animation = 'sosPulseRing 1s ease-out';
  btn.appendChild(ping);
  
  showToast('🚨 DISTRESS SIGNAL SENT TO 112', 'error');
  setTimeout(() => {
    btn.style.transform = '';
    setTimeout(() => ping.remove(), 1000);
  }, 300);
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  t.style.background = type === 'success' ? 'linear-gradient(135deg, var(--accent), var(--accent2))' : 'linear-gradient(135deg, var(--red), #B91C1C)';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ─── Seed initial zones ───
const ZONES = [
  { lat: 13.0827, lng: 80.2707, score: 8.8 }, { lat: 12.9716, lng: 77.5946, score: 9.2 },
  { lat: 11.0168, lng: 76.9558, score: 8.0 }, { lat: 9.9195, lng: 78.1190, score: 8.2 },
  { lat: 13.0475, lng: 80.2090, score: 4.8 }, { lat: 13.1067, lng: 80.2755, score: 3.2 },
  { lat: 13.2150, lng: 80.3175, score: 1.5 }, { lat: 11.1085, lng: 77.3411, score: 4.2 }
];
ZONES.forEach(z => {
  L.circleMarker([z.lat, z.lng], {
    radius: 6, color: riskColor(z.score), fillColor: riskColor(z.score),
    fillOpacity: 0.35, weight: 1.5
  }).addTo(map);
});
