(function () {
  'use strict';

  // ===== Supabase Client Configuration (Publishable Key Only) =====
  var SUPABASE_URL = 'https://merammayucqyhzvsbjqv.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_XodP0RrOzOuPnwOtHW4psA_e0_hzLq5';

  var supabaseClient = (window.supabase && typeof window.supabase.createClient === 'function')
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true
        }
      })
    : null;

  // ===== Application State =====
  var state = {
    adminProfile: null,
    activeView: 'overview',
    rsvpSubTab: 'records', // 'records' | 'consolidated'
    rsvps: [],
    guests: [],
    wishes: [],
    notifications: [],
    summary: {
      total_rsvps: 0,
      total_confirmed_guests: 0,
      additional_guests: 0,
      total_wishes: 0,
      unread_notifications: 0
    },
    selectedRsvpId: null,
    pendingDelete: null,
    realtimeChannel: null
  };

  // ===== DOM Elements =====
  var gateLoader         = document.getElementById('auth-gate-loader');
  var loginView          = document.getElementById('login-view');
  var dashboardApp       = document.getElementById('dashboard-app');
  var loginForm          = document.getElementById('login-form');
  var loginEmailInput    = document.getElementById('login-email');
  var loginPassInput     = document.getElementById('login-password');
  var togglePassBtn      = document.getElementById('toggle-password');
  var loginError         = document.getElementById('login-error');
  var loginSubmitBtn     = document.getElementById('login-submit');
  var logoutBtn          = document.getElementById('logout-btn');

  var sidebar            = document.getElementById('sidebar');
  var sidebarBackdrop    = document.getElementById('sidebar-backdrop');
  var sidebarOpenBtn     = document.getElementById('sidebar-open');
  var sidebarCloseBtn    = document.getElementById('sidebar-close');
  var topbarTitle        = document.getElementById('topbar-title');
  var topbarSubtitle     = document.getElementById('topbar-subtitle');
  var realtimeStatus     = document.getElementById('realtime-status');
  var globalBanner       = document.getElementById('global-banner');
  var globalBannerText   = document.getElementById('global-banner-text');
  var globalBannerRetry  = document.getElementById('global-banner-retry');

  // ===== Formatting Helpers =====
  function formatDateTimeKa(iso) {
    if (!iso) return '—';
    var months = [
      'იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი',
      'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'
    ];
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    var hh = String(d.getHours()).padStart(2, '0');
    var mm = String(d.getMinutes()).padStart(2, '0');
    return d.getDate() + ' ' + months[d.getMonth()] + ', ' + d.getFullYear() + ' • ' + hh + ':' + mm;
  }

  function showToast(text) {
    var container = document.getElementById('toast-container');
    if (!container) return;
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    container.appendChild(el);
    setTimeout(function () {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.3s ease';
      setTimeout(function () { el.remove(); }, 320);
    }, 4500);
  }

  function setBtnLoading(btn, loading, normalLabel, loadingLabel) {
    if (!btn) return;
    btn.disabled = loading;
    btn.classList.toggle('is-loading', loading);
    var lbl = btn.querySelector('.btn__label');
    if (lbl) lbl.textContent = loading ? loadingLabel : normalLabel;
  }

  // ===== Authentication & Backend Allowlist Check =====
  async function verifyAdminSession(session) {
    if (!session || !supabaseClient) return null;
    var res = await supabaseClient.rpc('get_current_admin_profile');
    if (res.error || !res.data) {
      return null;
    }
    return res.data;
  }

  function showLoginScreen(errorMessage) {
    if (gateLoader) gateLoader.hidden = true;
    if (dashboardApp) dashboardApp.hidden = true;
    if (loginView) loginView.hidden = false;
    if (loginError) loginError.textContent = errorMessage || '';
    cleanupRealtime();
  }

  function showDashboardScreen(profile) {
    state.adminProfile = profile;
    if (gateLoader) gateLoader.hidden = true;
    if (loginView) loginView.hidden = true;
    if (dashboardApp) dashboardApp.hidden = false;

    var nameEl = document.getElementById('admin-display-name');
    var emailEl = document.getElementById('admin-email-text');
    var avatarEl = document.getElementById('admin-avatar');
    var displayName = (profile.full_name && profile.full_name.trim()) ? profile.full_name.trim() : 'ადმინისტრატორი';

    if (nameEl) nameEl.textContent = displayName;
    if (emailEl) emailEl.textContent = profile.email || '';
    if (avatarEl) avatarEl.textContent = displayName.charAt(0).toUpperCase();
  }

  if (togglePassBtn && loginPassInput) {
    togglePassBtn.addEventListener('click', function () {
      var isHidden = loginPassInput.type === 'password';
      loginPassInput.type = isHidden ? 'text' : 'password';
      togglePassBtn.textContent = isHidden ? 'დამალვა' : 'ჩვენება';
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      loginError.textContent = '';

      var email = loginEmailInput ? loginEmailInput.value.trim() : '';
      var password = loginPassInput ? loginPassInput.value : '';

      if (!email || !password) {
        loginError.textContent = 'გთხოვთ, შეიყვანოთ ელ-ფოსტა და პაროლი.';
        return;
      }

      setBtnLoading(loginSubmitBtn, true, 'შესვლა', 'მოწმდება...');

      try {
        var authRes = await supabaseClient.auth.signInWithPassword({
          email: email,
          password: password
        });

        if (authRes.error) {
          throw new Error('ელ-ფოსტა ან პაროლი არასწორია.');
        }

        var profile = await verifyAdminSession(authRes.data.session);
        if (!profile) {
          await supabaseClient.auth.signOut();
          throw new Error('ამ ანგარიშს არ აქვს ადმინისტრატორის უფლება.');
        }

        showDashboardScreen(profile);
        await loadAllAdminData();
        subscribeRealtime();
      } catch (err) {
        loginError.textContent = err.message || 'შესვლა ვერ მოხერხდა.';
      } finally {
        setBtnLoading(loginSubmitBtn, false, 'შესვლა', 'მოწმდება...');
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async function () {
      cleanupRealtime();
      if (supabaseClient) {
        await supabaseClient.auth.signOut();
      }
      state.adminProfile = null;
      showLoginScreen('');
    });
  }

  // ===== Navigation & Mobile Sidebar =====
  var VIEW_META = {
    overview: {
      title: 'მიმოხილვა',
      subtitle: 'ქორწილის სტუმრებისა და სურვილების ცოცხალი სტატისტიკა'
    },
    rsvps: {
      title: 'დასწრების დადასტურებები',
      subtitle: 'სტუმრების სია, თანმხლები პირები და შეტყობინებები'
    },
    wishes: {
      title: 'სტუმრების სურვილები',
      subtitle: 'მოსაწვევზე გამოქვეყნებული კეთილი სურვილების მართვა'
    },
    notifications: {
      title: 'შეტყობინებები',
      subtitle: 'ყველა განახლება და წაკითხვის სტატუსი'
    }
  };

  function switchView(viewName) {
    state.activeView = viewName;
    document.querySelectorAll('.view-section').forEach(function (sec) {
      var active = sec.id === 'view-' + viewName;
      sec.hidden = !active;
      sec.classList.toggle('is-active', active);
    });
    document.querySelectorAll('.nav-item').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.dataset.view === viewName);
    });
    var meta = VIEW_META[viewName] || VIEW_META.overview;
    if (topbarTitle) topbarTitle.textContent = meta.title;
    if (topbarSubtitle) topbarSubtitle.textContent = meta.subtitle;
    closeMobileSidebar();
  }

  function openMobileSidebar() {
    if (sidebar) sidebar.classList.add('is-open');
    if (sidebarBackdrop) sidebarBackdrop.hidden = false;
  }

  function closeMobileSidebar() {
    if (sidebar) sidebar.classList.remove('is-open');
    if (sidebarBackdrop) sidebarBackdrop.hidden = true;
  }

  document.querySelectorAll('.nav-item').forEach(function (btn) {
    btn.addEventListener('click', function () {
      switchView(btn.dataset.view);
    });
  });

  document.querySelectorAll('[data-jump-view]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      switchView(btn.dataset.jumpView);
    });
  });

  if (sidebarOpenBtn) sidebarOpenBtn.addEventListener('click', openMobileSidebar);
  if (sidebarCloseBtn) sidebarCloseBtn.addEventListener('click', closeMobileSidebar);
  if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeMobileSidebar);

  // ===== Data Fetching =====
  function renderLoadingSkeletons() {
    var rsvpBody = document.getElementById('rsvp-table-body');
    var wishesGrid = document.getElementById('admin-wishes-grid');
    var activityList = document.getElementById('recent-activity-list');

    if (rsvpBody && state.rsvps.length === 0) {
      rsvpBody.innerHTML = '<tr><td colspan="5"><div class="skeleton-row"></div><div class="skeleton-row"></div></td></tr>';
    }
    if (wishesGrid && state.wishes.length === 0) {
      wishesGrid.innerHTML = '<div class="skeleton-row"></div><div class="skeleton-row"></div>';
    }
    if (activityList && state.notifications.length === 0) {
      activityList.innerHTML = '<div class="skeleton-row"></div><div class="skeleton-row"></div>';
    }
  }

  async function loadAllAdminData() {
    if (!supabaseClient) return;
    if (globalBanner) globalBanner.hidden = true;
    renderLoadingSkeletons();

    try {
      var results = await Promise.all([
        supabaseClient.rpc('get_admin_dashboard_summary'),
        supabaseClient
          .from('rsvps')
          .select('id, first_name, last_name, attendee_count, message, created_at, rsvp_guests(id, first_name, last_name, created_at)')
          .order('created_at', { ascending: false }),
        supabaseClient
          .from('wishes')
          .select('id, first_name, message, is_published, created_at')
          .order('created_at', { ascending: false }),
        supabaseClient
          .from('admin_notifications')
          .select('id, event_type, guest_name, message, reference_table, reference_id, metadata, is_read, read_at, created_at')
          .order('created_at', { ascending: false })
          .limit(100)
      ]);

      var summaryRes = results[0];
      var rsvpsRes   = results[1];
      var wishesRes  = results[2];
      var notifRes   = results[3];

      if (summaryRes.error) throw summaryRes.error;
      if (rsvpsRes.error) throw rsvpsRes.error;
      if (wishesRes.error) throw wishesRes.error;
      if (notifRes.error) throw notifRes.error;

      state.summary = summaryRes.data || state.summary;
      state.rsvps = rsvpsRes.data || [];
      state.wishes = wishesRes.data || [];
      state.notifications = notifRes.data || [];

      renderAll();
    } catch (err) {
      if (globalBanner && globalBannerText) {
        globalBannerText.textContent = 'მონაცემების ჩატვირთვა ვერ მოხერხდა. შეამოწმეთ კავშირი და სცადეთ თავიდან.';
        globalBanner.hidden = false;
      }
    }
  }

  if (globalBannerRetry) {
    globalBannerRetry.addEventListener('click', loadAllAdminData);
  }

  // ===== Render Pipeline =====
  function renderAll() {
    renderStats();
    renderRsvpTable();
    renderConsolidatedGuests();
    renderWishesGrid();
    renderNotifications();
  }

  function renderStats() {
    var totalRsvps = state.rsvps.length;
    var totalConfirmed = state.rsvps.reduce(function (acc, r) {
      return acc + (Number(r.attendee_count) || 0);
    }, 0);
    var additionalGuests = state.rsvps.reduce(function (acc, r) {
      var listLen = Array.isArray(r.rsvp_guests) ? r.rsvp_guests.length : Math.max(0, (Number(r.attendee_count) || 1) - 1);
      return acc + listLen;
    }, 0);
    var totalWishes = state.wishes.length;
    var unreadCount = state.notifications.filter(function (n) { return !n.is_read; }).length;

    var elRsvps = document.getElementById('stat-total-rsvps');
    var elGuests = document.getElementById('stat-total-guests');
    var elAdd = document.getElementById('stat-additional-guests');
    var elWishes = document.getElementById('stat-total-wishes');

    [elRsvps, elGuests, elAdd, elWishes].forEach(function (el) {
      if (el) el.classList.remove('skeleton-text');
    });

    if (elRsvps) elRsvps.textContent = String(totalRsvps);
    if (elGuests) elGuests.textContent = String(totalConfirmed);
    if (elAdd) elAdd.textContent = String(additionalGuests);
    if (elWishes) elWishes.textContent = String(totalWishes);

    var navRsvp = document.getElementById('nav-rsvp-count');
    var navWish = document.getElementById('nav-wishes-count');
    var navUnread = document.getElementById('nav-unread-count');
    var topUnread = document.getElementById('topbar-unread-badge');
    var drawerUnread = document.getElementById('drawer-unread-label');

    if (navRsvp) navRsvp.textContent = String(totalRsvps);
    if (navWish) navWish.textContent = String(totalWishes);

    if (navUnread) {
      navUnread.textContent = String(unreadCount);
      navUnread.hidden = unreadCount === 0;
    }
    if (topUnread) {
      topUnread.textContent = String(unreadCount);
      topUnread.hidden = unreadCount === 0;
    }
    if (drawerUnread) {
      drawerUnread.textContent = 'წაუკითხავი: ' + unreadCount;
    }
  }

  // ===== RSVP Management Rendering =====
  var rsvpSearchInput = document.getElementById('rsvp-search');
  var rsvpFilterSelect = document.getElementById('rsvp-filter');
  var rsvpSortSelect = document.getElementById('rsvp-sort');
  var guestRoleFilter = document.getElementById('guest-role-filter');

  function getFilteredRsvps() {
    var query = (rsvpSearchInput ? rsvpSearchInput.value : '').trim().toLowerCase();
    var filter = rsvpFilterSelect ? rsvpFilterSelect.value : 'all';
    var sort = rsvpSortSelect ? rsvpSortSelect.value : 'newest';

    var list = state.rsvps.filter(function (r) {
      var count = Number(r.attendee_count) || 1;
      var hasMsg = Boolean(r.message && r.message.trim());

      if (filter === 'solo' && count !== 1) return false;
      if (filter === 'group' && count < 2) return false;
      if (filter === 'with_message' && !hasMsg) return false;

      if (!query) return true;

      var primaryFull = (r.first_name + ' ' + r.last_name).toLowerCase();
      var msgText = (r.message || '').toLowerCase();
      var guestMatch = Array.isArray(r.rsvp_guests) && r.rsvp_guests.some(function (g) {
        return (g.first_name + ' ' + g.last_name).toLowerCase().indexOf(query) !== -1;
      });

      return primaryFull.indexOf(query) !== -1 || msgText.indexOf(query) !== -1 || guestMatch;
    });

    list.sort(function (a, b) {
      if (sort === 'oldest') {
        return new Date(a.created_at) - new Date(b.created_at);
      }
      if (sort === 'guests_desc') {
        return (Number(b.attendee_count) || 0) - (Number(a.attendee_count) || 0);
      }
      if (sort === 'name_asc') {
        return (a.first_name + ' ' + a.last_name).localeCompare(b.first_name + ' ' + b.last_name, 'ka');
      }
      return new Date(b.created_at) - new Date(a.created_at);
    });

    return list;
  }

  function renderRsvpTable() {
    var tbody = document.getElementById('rsvp-table-body');
    var emptyEl = document.getElementById('rsvp-empty');
    if (!tbody) return;

    var rows = getFilteredRsvps();
    tbody.innerHTML = '';

    if (rows.length === 0) {
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;

    rows.forEach(function (rsvp) {
      var tr = document.createElement('tr');

      // 1. Primary Guest Full Name
      var tdName = document.createElement('td');
      var nameBtn = document.createElement('span');
      nameBtn.className = 'guest-name-cell';
      nameBtn.textContent = rsvp.first_name + ' ' + rsvp.last_name;
      nameBtn.addEventListener('click', function () { openRsvpModal(rsvp.id); });
      tdName.appendChild(nameBtn);

      // 2. Total Attendees
      var tdCount = document.createElement('td');
      var countTag = document.createElement('span');
      countTag.className = 'tag tag--rsvp';
      countTag.textContent = rsvp.attendee_count + ' სტუმარი';
      tdCount.appendChild(countTag);

      // 3. Date
      var tdDate = document.createElement('td');
      tdDate.textContent = formatDateTimeKa(rsvp.created_at);

      // 4. Message Indicator
      var tdMsg = document.createElement('td');
      var msgTag = document.createElement('span');
      if (rsvp.message && rsvp.message.trim()) {
        msgTag.className = 'tag tag--wish';
        msgTag.textContent = 'აქვს შეტყობინება';
      } else {
        msgTag.className = 'tag tag--muted';
        msgTag.textContent = '—';
      }
      tdMsg.appendChild(msgTag);

      // 5. Actions
      var tdActions = document.createElement('td');
      tdActions.className = 'text-right';
      var actionWrap = document.createElement('div');
      actionWrap.className = 'row-actions';

      var viewBtn = document.createElement('button');
      viewBtn.type = 'button';
      viewBtn.className = 'btn btn--outline btn--sm';
      viewBtn.textContent = 'დეტალები';
      viewBtn.addEventListener('click', function () { openRsvpModal(rsvp.id); });

      var delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn btn--ghost btn--sm';
      delBtn.style.color = 'var(--danger)';
      delBtn.textContent = 'წაშლა';
      delBtn.addEventListener('click', function () { promptDeleteRsvp(rsvp); });

      actionWrap.appendChild(viewBtn);
      actionWrap.appendChild(delBtn);
      tdActions.appendChild(actionWrap);

      tr.appendChild(tdName);
      tr.appendChild(tdCount);
      tr.appendChild(tdDate);
      tr.appendChild(tdMsg);
      tr.appendChild(tdActions);
      tbody.appendChild(tr);
    });
  }

  function buildConsolidatedGuests() {
    var all = [];
    state.rsvps.forEach(function (r) {
      var primaryFull = r.first_name + ' ' + r.last_name;
      all.push({
        rsvp_id: r.id,
        full_name: primaryFull,
        type: 'primary',
        group_label: 'ძირითადი სტუმარი',
        created_at: r.created_at
      });
      if (Array.isArray(r.rsvp_guests)) {
        r.rsvp_guests.forEach(function (g) {
          all.push({
            rsvp_id: r.id,
            full_name: g.first_name + ' ' + g.last_name,
            type: 'additional',
            group_label: 'თანმხლები • ' + primaryFull,
            created_at: g.created_at || r.created_at
          });
        });
      }
    });
    return all;
  }

  function renderConsolidatedGuests() {
    var tbody = document.getElementById('consolidated-table-body');
    var emptyEl = document.getElementById('consolidated-empty');
    var summaryEl = document.getElementById('consolidated-summary');
    if (!tbody) return;

    var query = (rsvpSearchInput ? rsvpSearchInput.value : '').trim().toLowerCase();
    var roleFilter = guestRoleFilter ? guestRoleFilter.value : 'all';

    var list = buildConsolidatedGuests().filter(function (item) {
      if (roleFilter !== 'all' && item.type !== roleFilter) return false;
      if (!query) return true;
      return item.full_name.toLowerCase().indexOf(query) !== -1 ||
             item.group_label.toLowerCase().indexOf(query) !== -1;
    });

    if (summaryEl) {
      summaryEl.textContent = 'ნაჩვენებია ' + list.length + ' სტუმარი';
    }

    tbody.innerHTML = '';
    if (list.length === 0) {
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;

    list.forEach(function (item, idx) {
      var tr = document.createElement('tr');

      var tdIdx = document.createElement('td');
      tdIdx.textContent = String(idx + 1);

      var tdName = document.createElement('td');
      tdName.style.fontWeight = '600';
      tdName.textContent = item.full_name;

      var tdRole = document.createElement('td');
      var tag = document.createElement('span');
      tag.className = item.type === 'primary' ? 'tag tag--rsvp' : 'tag tag--wish';
      tag.textContent = item.group_label;
      tdRole.appendChild(tag);

      var tdDate = document.createElement('td');
      tdDate.textContent = formatDateTimeKa(item.created_at);

      var tdAct = document.createElement('td');
      tdAct.className = 'text-right';
      var openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'btn btn--outline btn--sm';
      openBtn.textContent = 'RSVP ნახვა';
      openBtn.addEventListener('click', function () { openRsvpModal(item.rsvp_id); });
      tdAct.appendChild(openBtn);

      tr.appendChild(tdIdx);
      tr.appendChild(tdName);
      tr.appendChild(tdRole);
      tr.appendChild(tdDate);
      tr.appendChild(tdAct);
      tbody.appendChild(tr);
    });
  }

  // Sub-tabs switching inside RSVP Management
  var tabRecords = document.getElementById('tab-rsvp-records');
  var tabConsolidated = document.getElementById('tab-consolidated-guests');
  var wrapRecords = document.getElementById('rsvp-records-wrap');
  var wrapConsolidated = document.getElementById('consolidated-guests-wrap');
  var ctrlRecords = document.getElementById('rsvp-records-controls');
  var ctrlConsolidated = document.getElementById('consolidated-controls');

  function setRsvpSubTab(tab) {
    state.rsvpSubTab = tab;
    var isRecords = tab === 'records';
    if (tabRecords) {
      tabRecords.classList.toggle('is-active', isRecords);
      tabRecords.setAttribute('aria-selected', isRecords ? 'true' : 'false');
    }
    if (tabConsolidated) {
      tabConsolidated.classList.toggle('is-active', !isRecords);
      tabConsolidated.setAttribute('aria-selected', !isRecords ? 'true' : 'false');
    }
    if (wrapRecords) wrapRecords.hidden = !isRecords;
    if (wrapConsolidated) wrapConsolidated.hidden = isRecords;
    if (ctrlRecords) ctrlRecords.hidden = !isRecords;
    if (ctrlConsolidated) ctrlConsolidated.hidden = isRecords;
  }

  if (tabRecords) tabRecords.addEventListener('click', function () { setRsvpSubTab('records'); });
  if (tabConsolidated) tabConsolidated.addEventListener('click', function () { setRsvpSubTab('consolidated'); });

  if (rsvpSearchInput) {
    rsvpSearchInput.addEventListener('input', function () {
      renderRsvpTable();
      renderConsolidatedGuests();
    });
  }
  if (rsvpFilterSelect) rsvpFilterSelect.addEventListener('change', renderRsvpTable);
  if (rsvpSortSelect) rsvpSortSelect.addEventListener('change', renderRsvpTable);
  if (guestRoleFilter) guestRoleFilter.addEventListener('change', renderConsolidatedGuests);

  // CSV Export of Consolidated Guest List
  var exportCsvBtn = document.getElementById('export-guests-csv');
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', function () {
      var list = buildConsolidatedGuests();
      var lines = ['"#","სტუმარი","სტატუსი","თარიღი"'];
      list.forEach(function (item, idx) {
        var row = [
          idx + 1,
          '"' + item.full_name.replace(/"/g, '""') + '"',
          '"' + item.group_label.replace(/"/g, '""') + '"',
          '"' + formatDateTimeKa(item.created_at) + '"'
        ];
        lines.push(row.join(','));
      });
      var blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'levani-lika-guests.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }

  // ===== RSVP Detail Modal =====
  var rsvpModal = document.getElementById('rsvp-modal');
  var rsvpModalBackdrop = document.getElementById('rsvp-modal-backdrop');
  var rsvpModalTitle = document.getElementById('rsvp-modal-title');
  var rsvpModalBody = document.getElementById('rsvp-modal-body');
  var rsvpModalDelete = document.getElementById('rsvp-modal-delete');

  function openRsvpModal(rsvpId) {
    var rsvp = state.rsvps.find(function (r) { return r.id === rsvpId; });
    if (!rsvp || !rsvpModal || !rsvpModalBody) return;

    state.selectedRsvpId = rsvp.id;
    if (rsvpModalTitle) {
      rsvpModalTitle.textContent = rsvp.first_name + ' ' + rsvp.last_name;
    }

    rsvpModalBody.innerHTML = '';

    var grid = document.createElement('div');
    grid.className = 'detail-grid';

    var box1 = document.createElement('div');
    box1.className = 'detail-box';
    var b1Lbl = document.createElement('div');
    b1Lbl.className = 'detail-box__label';
    b1Lbl.textContent = 'სულ დამსწრე';
    var b1Val = document.createElement('div');
    b1Val.className = 'detail-box__val';
    b1Val.textContent = rsvp.attendee_count + ' ადამიანი';
    box1.appendChild(b1Lbl);
    box1.appendChild(b1Val);

    var box2 = document.createElement('div');
    box2.className = 'detail-box';
    var b2Lbl = document.createElement('div');
    b2Lbl.className = 'detail-box__label';
    b2Lbl.textContent = 'გაგზავნის თარიღი';
    var b2Val = document.createElement('div');
    b2Val.className = 'detail-box__val';
    b2Val.textContent = formatDateTimeKa(rsvp.created_at);
    box2.appendChild(b2Lbl);
    box2.appendChild(b2Val);

    grid.appendChild(box1);
    grid.appendChild(box2);
    rsvpModalBody.appendChild(grid);

    // Accompanying Guests
    var guestsTitle = document.createElement('h4');
    guestsTitle.className = 'detail-section-title';
    guestsTitle.textContent = 'თანმხლები სტუმრები';
    rsvpModalBody.appendChild(guestsTitle);

    var guests = Array.isArray(rsvp.rsvp_guests) ? rsvp.rsvp_guests : [];
    if (guests.length === 0) {
      var soloNote = document.createElement('p');
      soloNote.style.fontSize = '13.5px';
      soloNote.style.color = 'var(--ink-soft)';
      soloNote.style.marginBottom = '18px';
      soloNote.textContent = 'თანმხლები სტუმრები მითითებული არ არის (ესწრება მარტო).';
      rsvpModalBody.appendChild(soloNote);
    } else {
      var ul = document.createElement('ul');
      ul.className = 'detail-guest-list';
      guests.forEach(function (g, idx) {
        var li = document.createElement('li');
        li.textContent = (idx + 2) + '. ' + g.first_name + ' ' + g.last_name;
        ul.appendChild(li);
      });
      rsvpModalBody.appendChild(ul);
    }

    // Optional Personal Message
    var msgTitle = document.createElement('h4');
    msgTitle.className = 'detail-section-title';
    msgTitle.textContent = 'პირადი შეტყობინება';
    rsvpModalBody.appendChild(msgTitle);

    var msgBox = document.createElement('div');
    msgBox.className = 'detail-message-box';
    msgBox.textContent = (rsvp.message && rsvp.message.trim())
      ? rsvp.message
      : 'შეტყობინება დატოვებული არ არის.';
    rsvpModalBody.appendChild(msgBox);

    rsvpModal.hidden = false;
    rsvpModalBackdrop.hidden = false;
  }

  function closeRsvpModal() {
    if (rsvpModal) rsvpModal.hidden = true;
    if (rsvpModalBackdrop) rsvpModalBackdrop.hidden = true;
    state.selectedRsvpId = null;
  }

  document.getElementById('rsvp-modal-close').addEventListener('click', closeRsvpModal);
  document.getElementById('rsvp-modal-done').addEventListener('click', closeRsvpModal);
  rsvpModalBackdrop.addEventListener('click', closeRsvpModal);

  if (rsvpModalDelete) {
    rsvpModalDelete.addEventListener('click', function () {
      var rsvp = state.rsvps.find(function (r) { return r.id === state.selectedRsvpId; });
      if (rsvp) {
        closeRsvpModal();
        promptDeleteRsvp(rsvp);
      }
    });
  }

  // ===== Wishes Management Rendering =====
  var wishesSearchInput = document.getElementById('wishes-search');
  var wishesSortSelect = document.getElementById('wishes-sort');

  function renderWishesGrid(highlightId) {
    var grid = document.getElementById('admin-wishes-grid');
    var emptyEl = document.getElementById('wishes-empty');
    if (!grid) return;

    var query = (wishesSearchInput ? wishesSearchInput.value : '').trim().toLowerCase();
    var sort = wishesSortSelect ? wishesSortSelect.value : 'newest';

    var list = state.wishes.filter(function (w) {
      if (!query) return true;
      return (w.first_name || '').toLowerCase().indexOf(query) !== -1 ||
             (w.message || '').toLowerCase().indexOf(query) !== -1;
    });

    list.sort(function (a, b) {
      return sort === 'oldest'
        ? new Date(a.created_at) - new Date(b.created_at)
        : new Date(b.created_at) - new Date(a.created_at);
    });

    grid.innerHTML = '';
    if (list.length === 0) {
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;

    list.forEach(function (wish) {
      var card = document.createElement('article');
      card.className = 'wish-admin-card' + (highlightId === wish.id ? ' is-highlighted' : '');
      card.id = 'admin-wish-' + wish.id;

      var head = document.createElement('div');
      head.className = 'wish-admin-card__head';

      var author = document.createElement('span');
      author.className = 'wish-admin-card__author';
      author.textContent = wish.first_name;

      var dateSpan = document.createElement('span');
      dateSpan.className = 'wish-admin-card__date';
      dateSpan.textContent = formatDateTimeKa(wish.created_at);

      head.appendChild(author);
      head.appendChild(dateSpan);

      var body = document.createElement('p');
      body.className = 'wish-admin-card__body';
      body.textContent = wish.message;

      var foot = document.createElement('div');
      foot.className = 'wish-admin-card__foot';

      var statusTag = document.createElement('span');
      statusTag.className = 'tag tag--rsvp';
      statusTag.textContent = wish.is_published ? 'გამოქვეყნებულია' : 'დამალულია';

      var delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn btn--outline btn--sm';
      delBtn.style.color = 'var(--danger)';
      delBtn.textContent = 'წაშლა';
      delBtn.addEventListener('click', function () { promptDeleteWish(wish); });

      foot.appendChild(statusTag);
      foot.appendChild(delBtn);

      card.appendChild(head);
      card.appendChild(body);
      card.appendChild(foot);
      grid.appendChild(card);
    });
  }

  if (wishesSearchInput) wishesSearchInput.addEventListener('input', function () { renderWishesGrid(); });
  if (wishesSortSelect) wishesSortSelect.addEventListener('change', function () { renderWishesGrid(); });

  // ===== Deletion Confirmation Modal & Server-Side RPC Execution =====
  var confirmModal = document.getElementById('confirm-modal');
  var confirmBackdrop = document.getElementById('confirm-modal-backdrop');
  var confirmMsg = document.getElementById('confirm-modal-message');
  var confirmOkBtn = document.getElementById('confirm-modal-ok');

  function openConfirmModal(message, onConfirm) {
    state.pendingDelete = onConfirm;
    if (confirmMsg) confirmMsg.textContent = message;
    if (confirmModal) confirmModal.hidden = false;
    if (confirmBackdrop) confirmBackdrop.hidden = false;
  }

  function closeConfirmModal() {
    state.pendingDelete = null;
    if (confirmModal) confirmModal.hidden = true;
    if (confirmBackdrop) confirmBackdrop.hidden = true;
  }

  document.getElementById('confirm-modal-close').addEventListener('click', closeConfirmModal);
  document.getElementById('confirm-modal-cancel').addEventListener('click', closeConfirmModal);
  confirmBackdrop.addEventListener('click', closeConfirmModal);

  if (confirmOkBtn) {
    confirmOkBtn.addEventListener('click', async function () {
      if (typeof state.pendingDelete !== 'function') return;
      var fn = state.pendingDelete;
      setBtnLoading(confirmOkBtn, true, 'დიახ, წაშლა', 'იშლება...');
      try {
        await fn();
        closeConfirmModal();
      } finally {
        setBtnLoading(confirmOkBtn, false, 'დიახ, წაშლა', 'იშლება...');
      }
    });
  }

  function promptDeleteRsvp(rsvp) {
    var guestCount = Number(rsvp.attendee_count) || 1;
    var text = 'დარწმუნებული ხართ, რომ გსურთ ' + rsvp.first_name + ' ' + rsvp.last_name +
      '-ის დასწრების დადასტურების (' + guestCount + ' სტუმარი) და თანმხლები სტუმრების ჩანაწერების წაშლა? ეს მოქმედება შეუქცევადია.';

    openConfirmModal(text, async function () {
      var res = await supabaseClient.rpc('delete_rsvp_admin', { p_rsvp_id: rsvp.id });
      if (res.error) {
        showToast('ჩანაწერის წაშლა ვერ მოხერხდა.');
        return;
      }
      state.rsvps = state.rsvps.filter(function (r) { return r.id !== rsvp.id; });
      state.notifications = state.notifications.filter(function (n) {
        return !(n.reference_table === 'rsvps' && n.reference_id === rsvp.id);
      });
      renderAll();
      showToast('RSVP ჩანაწერი და თანმხლები სტუმრები წაიშალა.');
    });
  }

  function promptDeleteWish(wish) {
    var text = 'დარწმუნებული ხართ, რომ გსურთ ' + wish.first_name +
      '-ის სურვილის წაშლა? სურვილი ასევე წაიშლება საჯარო მოსაწვევიდან.';

    openConfirmModal(text, async function () {
      var res = await supabaseClient.rpc('delete_wish_admin', { p_wish_id: wish.id });
      if (res.error) {
        showToast('სურვილის წაშლა ვერ მოხერხდა.');
        return;
      }
      state.wishes = state.wishes.filter(function (w) { return w.id !== wish.id; });
      state.notifications = state.notifications.filter(function (n) {
        return !(n.reference_table === 'wishes' && n.reference_id === wish.id);
      });
      renderAll();
      showToast('სურვილი წარმატებით წაიშალა.');
    });
  }

  // ===== Notifications Rendering & Actions =====
  function buildNotificationElement(notif, compact) {
    var item = document.createElement('div');
    item.className = 'notif-item' + (notif.is_read ? '' : ' is-unread');

    var main = document.createElement('div');
    main.className = 'notif-item__main';

    var dot = document.createElement('span');
    dot.className = 'notif-item__dot';

    var body = document.createElement('div');
    var msg = document.createElement('p');
    msg.className = 'notif-item__msg';
    msg.textContent = notif.message;

    var meta = document.createElement('div');
    meta.className = 'notif-item__meta';

    var typeTag = document.createElement('span');
    typeTag.className = notif.event_type === 'rsvp_created' ? 'tag tag--rsvp' : 'tag tag--wish';
    typeTag.textContent = notif.event_type === 'rsvp_created' ? 'RSVP' : 'სურვილი';

    var timeSpan = document.createElement('span');
    timeSpan.textContent = formatDateTimeKa(notif.created_at);

    meta.appendChild(typeTag);
    meta.appendChild(timeSpan);
    body.appendChild(msg);
    body.appendChild(meta);

    main.appendChild(dot);
    main.appendChild(body);

    main.addEventListener('click', function () {
      handleNotificationClick(notif);
    });

    item.appendChild(main);

    if (!notif.is_read) {
      var readBtn = document.createElement('button');
      readBtn.type = 'button';
      readBtn.className = 'btn btn--ghost btn--sm';
      readBtn.textContent = compact ? '✓' : 'წაკითხული';
      readBtn.title = 'წაკითხულად მონიშვნა';
      readBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        markSingleNotificationRead(notif.id);
      });
      item.appendChild(readBtn);
    }

    return item;
  }

  function renderNotifications() {
    var recentContainer = document.getElementById('recent-activity-list');
    var drawerContainer = document.getElementById('notif-drawer-list');
    var pageContainer   = document.getElementById('notifications-page-list');
    var pageEmpty       = document.getElementById('notifications-page-empty');

    if (recentContainer) {
      recentContainer.innerHTML = '';
      var recentItems = state.notifications.slice(0, 6);
      if (recentItems.length === 0) {
        var emptyRecent = document.createElement('p');
        emptyRecent.style.fontSize = '13.5px';
        emptyRecent.style.color = 'var(--ink-soft)';
        emptyRecent.textContent = 'ჯერ აქტივობები არ დაფიქსირებულა.';
        recentContainer.appendChild(emptyRecent);
      } else {
        recentItems.forEach(function (n) {
          recentContainer.appendChild(buildNotificationElement(n, true));
        });
      }
    }

    if (drawerContainer) {
      drawerContainer.innerHTML = '';
      if (state.notifications.length === 0) {
        var emptyDrawer = document.createElement('p');
        emptyDrawer.style.fontSize = '13.5px';
        emptyDrawer.style.color = 'var(--ink-soft)';
        emptyDrawer.style.textAlign = 'center';
        emptyDrawer.style.padding = '32px 12px';
        emptyDrawer.textContent = 'შეტყობინებები არ არის.';
        drawerContainer.appendChild(emptyDrawer);
      } else {
        state.notifications.forEach(function (n) {
          drawerContainer.appendChild(buildNotificationElement(n, true));
        });
      }
    }

    if (pageContainer) {
      pageContainer.innerHTML = '';
      if (state.notifications.length === 0) {
        if (pageEmpty) pageEmpty.hidden = false;
      } else {
        if (pageEmpty) pageEmpty.hidden = true;
        state.notifications.forEach(function (n) {
          pageContainer.appendChild(buildNotificationElement(n, false));
        });
      }
    }
  }

  async function markSingleNotificationRead(notifId) {
    var target = state.notifications.find(function (n) { return n.id === notifId; });
    if (target && !target.is_read) {
      target.is_read = true;
      renderStats();
      renderNotifications();
      await supabaseClient.rpc('mark_notification_read', { p_notification_id: notifId });
    }
  }

  async function markAllNotificationsRead() {
    var hasUnread = state.notifications.some(function (n) { return !n.is_read; });
    if (!hasUnread) return;
    state.notifications.forEach(function (n) { n.is_read = true; });
    renderStats();
    renderNotifications();
    await supabaseClient.rpc('mark_all_notifications_read');
  }

  function handleNotificationClick(notif) {
    markSingleNotificationRead(notif.id);
    closeNotifDrawer();

    if (notif.reference_table === 'rsvps') {
      switchView('rsvps');
      setRsvpSubTab('records');
      var exists = state.rsvps.some(function (r) { return r.id === notif.reference_id; });
      if (exists) {
        openRsvpModal(notif.reference_id);
      } else {
        showToast('ეს RSVP ჩანაწერი უკვე წაშლილია.');
      }
    } else if (notif.reference_table === 'wishes') {
      switchView('wishes');
      renderWishesGrid(notif.reference_id);
      var card = document.getElementById('admin-wish-' + notif.reference_id);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  // Notifications Drawer Controls
  var notifDrawer = document.getElementById('notif-drawer');
  var notifDrawerBackdrop = document.getElementById('notif-drawer-backdrop');

  function openNotifDrawer() {
    if (notifDrawer) notifDrawer.hidden = false;
    if (notifDrawerBackdrop) notifDrawerBackdrop.hidden = false;
  }

  function closeNotifDrawer() {
    if (notifDrawer) notifDrawer.hidden = true;
    if (notifDrawerBackdrop) notifDrawerBackdrop.hidden = true;
  }

  document.getElementById('notif-drawer-toggle').addEventListener('click', openNotifDrawer);
  document.getElementById('notif-drawer-close').addEventListener('click', closeNotifDrawer);
  notifDrawerBackdrop.addEventListener('click', closeNotifDrawer);

  document.getElementById('mark-all-read-overview').addEventListener('click', markAllNotificationsRead);
  document.getElementById('mark-all-read-drawer').addEventListener('click', markAllNotificationsRead);
  document.getElementById('mark-all-read-page').addEventListener('click', markAllNotificationsRead);

  // ===== Supabase Realtime Subscription =====
  function cleanupRealtime() {
    if (state.realtimeChannel && supabaseClient) {
      supabaseClient.removeChannel(state.realtimeChannel);
      state.realtimeChannel = null;
    }
    if (realtimeStatus) realtimeStatus.classList.remove('is-connected');
  }

  function subscribeRealtime() {
    if (!supabaseClient) return;
    cleanupRealtime();

    state.realtimeChannel = supabaseClient
      .channel('admin-live-sync')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'admin_notifications' },
        function (payload) {
          var newNotif = payload.new;
          if (!newNotif) return;
          var exists = state.notifications.some(function (n) { return n.id === newNotif.id; });
          if (!exists) {
            state.notifications.unshift(newNotif);
            showToast(newNotif.message);
          }
          // Refresh full dataset so accompanying guests & counts stay 100% accurate
          loadAllAdminData();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'admin_notifications' },
        function (payload) {
          var updated = payload.new;
          if (!updated) return;
          var idx = state.notifications.findIndex(function (n) { return n.id === updated.id; });
          if (idx !== -1) {
            state.notifications[idx] = updated;
            renderStats();
            renderNotifications();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'rsvps' },
        function () {
          loadAllAdminData();
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'wishes' },
        function () {
          loadAllAdminData();
        }
      )
      .subscribe(function (status) {
        if (realtimeStatus) {
          realtimeStatus.classList.toggle('is-connected', status === 'SUBSCRIBED');
        }
      });
  }

  // ===== Boot Session Check =====
  async function initAdminApp() {
    if (!supabaseClient) {
      showLoginScreen('Supabase კლიენტი ვერ ჩაიტვირთა.');
      return;
    }

    var sessionRes = await supabaseClient.auth.getSession();
    var session = sessionRes && sessionRes.data ? sessionRes.data.session : null;

    if (!session) {
      showLoginScreen('');
      return;
    }

    var profile = await verifyAdminSession(session);
    if (!profile) {
      await supabaseClient.auth.signOut();
      showLoginScreen('ამ ანგარიშს არ აქვს ადმინისტრატორის უფლება.');
      return;
    }

    showDashboardScreen(profile);
    await loadAllAdminData();
    subscribeRealtime();
  }

  initAdminApp();
})();