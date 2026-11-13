if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

(function () {

  var langToggle    = document.getElementById('lang-toggle');
  var langSwitch    = document.getElementById('lang-switch');
  var loadingScreen = document.getElementById('loading-screen');
  var introOverlay  = document.getElementById('intro-overlay');
  var introClick    = document.getElementById('intro-click');
  var introPoster   = document.getElementById('intro-poster');
  var video1        = document.getElementById('video-1');
  var video2        = document.getElementById('video-2');
  var bgMusic       = document.getElementById('bg-music');
  var musicToggle   = document.getElementById('music-toggle');
  var musicSwitch   = document.getElementById('music-switch');
  var petalsLayer   = document.getElementById('petals-layer');

  // Kick off audio buffering immediately — mobile often ignores preload="auto"
  if (bgMusic) bgMusic.load();

  // ===== Language System =====

  function setLanguage(lang) {
    document.querySelectorAll('[data-ka], [data-en]').forEach(function (el) {
      el.textContent = lang === 'en'
        ? (el.dataset.en || el.dataset.ka)
        : (el.dataset.ka || el.dataset.en);
    });
    document.documentElement.lang = lang === 'en' ? 'en' : 'ka';
    document.body.classList.toggle('lang-en', lang === 'en');
    localStorage.setItem('lang', lang);
    if (langSwitch) {
      langSwitch.classList.toggle('lang-en', lang === 'en');
      langSwitch.setAttribute('aria-checked', lang === 'en' ? 'true' : 'false');
    }
  }

  if (langSwitch) {
    langSwitch.addEventListener('click', function () {
      var current = localStorage.getItem('lang') || 'ka';
      setLanguage(current === 'ka' ? 'en' : 'ka');
    });

    langSwitch.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        var current = localStorage.getItem('lang') || 'ka';
        setLanguage(current === 'ka' ? 'en' : 'ka');
      }
    });
  }

  // ===== Loading Screen =====

  function hideLoader() {
    if (!loadingScreen) return;
    loadingScreen.classList.add('fade-out');
    setTimeout(function () { loadingScreen.classList.add('gone'); }, 700);
  }

  function setupLoader() {
    if (introPoster && introPoster.complete) {
      hideLoader();
    } else if (introPoster) {
      introPoster.addEventListener('load', hideLoader, { once: true });
      introPoster.addEventListener('error', setupVideoFallback, { once: true });
    } else {
      setupVideoFallback();
    }
  }

  function setupVideoFallback() {
    if (video1 && video1.readyState >= 2) {
      hideLoader();
    } else if (video1) {
      video1.addEventListener('loadeddata', hideLoader, { once: true });
    }
    setTimeout(hideLoader, 4000);
  }

  setupLoader();

  // ===== Intro Sequence & Hero Video Loop =====

  var hvFwd = document.getElementById('hv-fwd');
  var finaleVideo = document.querySelector('.finale-video-wrap video');

  if (hvFwd) {
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        hvFwd.pause();
      } else if (hvFwd.classList.contains('show')) {
        hvFwd.play();
      }
    });
  }

  function revealSite() {
    var heroCenter = document.querySelector('.hero-center');
    if (heroCenter) heroCenter.classList.add('revealed');
    if (hvFwd) {
      hvFwd.style.transition = 'opacity 1s ease';
      hvFwd.play().then(function () {
        hvFwd.classList.add('show');
      }).catch(function () {});
      setTimeout(function () { hvFwd.style.transition = ''; }, 1200);
    }
    if (bgMusic && bgMusic.paused && musicSwitch && musicSwitch.classList.contains('playing')) {
      bgMusic.play().catch(function () {});
    }
    if (finaleVideo) finaleVideo.play().catch(function () {});
    if (introOverlay) {
      introOverlay.classList.add('fade-out');
      setTimeout(function () {
        introOverlay.classList.add('gone');
        document.body.classList.remove('no-scroll');
        document.body.classList.add('scrollbar-ready');
        if (langToggle) langToggle.classList.add('visible');
        if (musicToggle) musicToggle.classList.add('visible');
        if (petalsLayer) petalsLayer.classList.add('visible');
      }, 500);
    }
  }

  function playVideo2() {
    if (video1) video1.classList.remove('active');
    if (video2) {
      video2.classList.add('active');
      video2.play();
      video2.addEventListener('ended', revealSite, { once: true });
    } else {
      revealSite();
    }
  }

  function playVideo1() {
    if (bgMusic) {
      bgMusic.muted = false;
      bgMusic.volume = 0.2;
      bgMusic.play().then(function () {
        if (musicSwitch) {
          musicSwitch.classList.add('playing');
          musicSwitch.setAttribute('aria-checked', 'true');
        }
      }).catch(function () {});
    }
    if (introOverlay) introOverlay.style.cursor = 'default';
    if (introClick) {
      introClick.style.animation = 'none';
      introClick.style.opacity = '1';
      introClick.style.pointerEvents = 'none';
      requestAnimationFrame(function () {
        introClick.style.opacity = '0';
      });
    }
    if (introPoster) introPoster.classList.add('hidden');
    if (video2) video2.load();
    if (video1) {
      video1.play();
      video1.addEventListener('ended', playVideo2, { once: true });
    } else {
      revealSite();
    }
  }

  if (introOverlay) {
    introOverlay.addEventListener('click', playVideo1, { once: true });
    introOverlay.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); playVideo1(); }
    }, { once: true });
  }

  // ===== Music Toggle =====

  if (bgMusic && musicSwitch) {
    function toggleMusic() {
      if (musicSwitch.classList.contains('playing')) {
        bgMusic.pause();
        musicSwitch.classList.remove('playing');
        musicSwitch.setAttribute('aria-checked', 'false');
      } else {
        bgMusic.play().then(function () {
          bgMusic.volume = 0.2;
        }).catch(function () {});
        musicSwitch.classList.add('playing');
        musicSwitch.setAttribute('aria-checked', 'true');
      }
    }

    musicSwitch.addEventListener('click', toggleMusic);
    musicSwitch.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMusic(); }
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        bgMusic.pause();
      } else if (musicSwitch.classList.contains('playing')) {
        bgMusic.play().then(function () {
          bgMusic.volume = 0.2;
        }).catch(function () {});
      }
    });
  }

  // Initialize language
  setLanguage(localStorage.getItem('lang') || 'ka');

  // ===== Supabase Client Setup (Publishable Key Only) =====

  var SUPABASE_URL = 'https://merammayucqyhzvsbjqv.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_XodP0RrOzOuPnwOtHW4psA_e0_hzLq5';

  var supabaseClient = (window.supabase && typeof window.supabase.createClient === 'function')
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      })
    : null;

  // ===== Helpers =====

  function georgianOrdinal(num) {
    if (num === 1) return '1-ლი';
    if (num >= 2 && num <= 20) return 'მე-' + num;
    return num + '-ე';
  }

  function formatGeorgianDate(isoString) {
    if (!isoString) return '';
    var months = [
      'იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი',
      'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'
    ];
    var d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return d.getDate() + ' ' + months[d.getMonth()] + ', ' + d.getFullYear();
  }

  function setButtonLoading(btn, isLoading, defaultLabel, loadingLabel) {
    if (!btn) return;
    btn.disabled = isLoading;
    btn.classList.toggle('is-loading', isLoading);
    var textEl = btn.querySelector('.estate-btn__text');
    if (textEl) {
      textEl.textContent = isLoading ? loadingLabel : defaultLabel;
    }
  }

  function clearFieldError(inputEl, errorEl) {
    if (inputEl) inputEl.classList.remove('is-invalid');
    if (errorEl) errorEl.textContent = '';
  }

  function setFieldError(inputEl, errorEl, msg) {
    if (inputEl) inputEl.classList.add('is-invalid');
    if (errorEl) errorEl.textContent = msg;
  }

  // ===== RSVP — დაადასტურეთ დასწრება =====

  var rsvpForm           = document.getElementById('rsvp-form');
  var rsvpNameInput      = document.getElementById('rsvp-name');
  var rsvpSurnameInput   = document.getElementById('rsvp-surname');
  var rsvpCountSelect    = document.getElementById('rsvp-count');
  var rsvpDecBtn         = document.getElementById('rsvp-dec');
  var rsvpIncBtn         = document.getElementById('rsvp-inc');
  var rsvpMessageInput   = document.getElementById('rsvp-message');
  var guestsContainer    = document.getElementById('additional-guests-container');
  var rsvpSubmitBtn      = document.getElementById('rsvp-submit');
  var rsvpStatus         = document.getElementById('rsvp-status');
  var rsvpThankyou       = document.getElementById('rsvp-thankyou');
  var rsvpSuccessMsg     = document.getElementById('rsvp-success-msg');
  var rsvpSuccessDetail  = document.getElementById('rsvp-success-detail');

  var rsvpNameError      = document.getElementById('rsvp-name-error');
  var rsvpSurnameError   = document.getElementById('rsvp-surname-error');
  var rsvpCountError     = document.getElementById('rsvp-count-error');

  // Stateful storage for accompanying guests so changing count preserves typed values
  var additionalGuestsState = [];
  var isSubmittingRsvp = false;
  var rsvpSubmitted = false;

  function syncStepperButtons(count) {
    if (rsvpDecBtn) rsvpDecBtn.disabled = count <= 1;
    if (rsvpIncBtn) rsvpIncBtn.disabled = count >= 10;
  }

  function renderAdditionalGuests(attendeeCount) {
    if (!guestsContainer) return;
    var extraCount = Math.max(0, attendeeCount - 1);
    syncStepperButtons(attendeeCount);

    while (additionalGuestsState.length < extraCount) {
      additionalGuestsState.push({ first_name: '', last_name: '' });
    }

    guestsContainer.innerHTML = '';

    if (extraCount === 0) {
      guestsContainer.hidden = true;
      return;
    }

    guestsContainer.hidden = false;

    for (var i = 0; i < extraCount; i++) {
      (function (idx) {
        var guestNumber = idx + 2;
        var ordinalLabel = georgianOrdinal(guestNumber) + ' სტუმარი';

        var card = document.createElement('div');
        card.className = 'guest-subcard';

        var heading = document.createElement('div');
        heading.className = 'guest-subcard__title';
        heading.textContent = ordinalLabel;
        card.appendChild(heading);

        var row = document.createElement('div');
        row.className = 'estate-row';

        // Guest First Name
        var firstField = document.createElement('div');
        firstField.className = 'estate-field';

        var firstLabel = document.createElement('label');
        firstLabel.className = 'estate-label';
        firstLabel.setAttribute('for', 'guest-first-' + idx);
        firstLabel.textContent = 'სახელი ';
        var firstReq = document.createElement('span');
        firstReq.className = 'estate-req';
        firstReq.textContent = '*';
        firstLabel.appendChild(firstReq);

        var firstInput = document.createElement('input');
        firstInput.className = 'estate-input';
        firstInput.type = 'text';
        firstInput.id = 'guest-first-' + idx;
        firstInput.maxLength = 100;
        firstInput.required = true;
        firstInput.placeholder = 'სახელი';
        firstInput.value = additionalGuestsState[idx].first_name;

        var firstErr = document.createElement('p');
        firstErr.className = 'estate-field-error';
        firstErr.id = 'guest-first-error-' + idx;
        firstErr.setAttribute('role', 'alert');

        firstInput.addEventListener('input', function () {
          additionalGuestsState[idx].first_name = firstInput.value;
          clearFieldError(firstInput, firstErr);
        });

        firstField.appendChild(firstLabel);
        firstField.appendChild(firstInput);
        firstField.appendChild(firstErr);

        // Guest Last Name
        var lastField = document.createElement('div');
        lastField.className = 'estate-field';

        var lastLabel = document.createElement('label');
        lastLabel.className = 'estate-label';
        lastLabel.setAttribute('for', 'guest-last-' + idx);
        lastLabel.textContent = 'გვარი ';
        var lastReq = document.createElement('span');
        lastReq.className = 'estate-req';
        lastReq.textContent = '*';
        lastLabel.appendChild(lastReq);

        var lastInput = document.createElement('input');
        lastInput.className = 'estate-input';
        lastInput.type = 'text';
        lastInput.id = 'guest-last-' + idx;
        lastInput.maxLength = 100;
        lastInput.required = true;
        lastInput.placeholder = 'გვარი';
        lastInput.value = additionalGuestsState[idx].last_name;

        var lastErr = document.createElement('p');
        lastErr.className = 'estate-field-error';
        lastErr.id = 'guest-last-error-' + idx;
        lastErr.setAttribute('role', 'alert');

        lastInput.addEventListener('input', function () {
          additionalGuestsState[idx].last_name = lastInput.value;
          clearFieldError(lastInput, lastErr);
        });

        lastField.appendChild(lastLabel);
        lastField.appendChild(lastInput);
        lastField.appendChild(lastErr);

        row.appendChild(firstField);
        row.appendChild(lastField);
        card.appendChild(row);
        guestsContainer.appendChild(card);
      })(i);
    }
  }

  if (rsvpCountSelect) {
    renderAdditionalGuests(parseInt(rsvpCountSelect.value, 10) || 1);

    rsvpCountSelect.addEventListener('change', function () {
      var val = parseInt(rsvpCountSelect.value, 10) || 1;
      clearFieldError(rsvpCountSelect, rsvpCountError);
      renderAdditionalGuests(val);
    });
  }

  if (rsvpDecBtn && rsvpCountSelect) {
    rsvpDecBtn.addEventListener('click', function () {
      var current = parseInt(rsvpCountSelect.value, 10) || 1;
      if (current > 1) {
        rsvpCountSelect.value = String(current - 1);
        renderAdditionalGuests(current - 1);
      }
    });
  }

  if (rsvpIncBtn && rsvpCountSelect) {
    rsvpIncBtn.addEventListener('click', function () {
      var current = parseInt(rsvpCountSelect.value, 10) || 1;
      if (current < 10) {
        rsvpCountSelect.value = String(current + 1);
        renderAdditionalGuests(current + 1);
      }
    });
  }

  if (rsvpNameInput) {
    rsvpNameInput.addEventListener('input', function () {
      clearFieldError(rsvpNameInput, rsvpNameError);
    });
  }

  if (rsvpSurnameInput) {
    rsvpSurnameInput.addEventListener('input', function () {
      clearFieldError(rsvpSurnameInput, rsvpSurnameError);
    });
  }

  if (rsvpForm) {
    rsvpForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      if (isSubmittingRsvp || rsvpSubmitted) return;

      rsvpStatus.textContent = '';
      rsvpStatus.className = 'estate-status';

      var firstName = rsvpNameInput ? rsvpNameInput.value.trim() : '';
      var lastName = rsvpSurnameInput ? rsvpSurnameInput.value.trim() : '';
      var attendeeCount = rsvpCountSelect ? parseInt(rsvpCountSelect.value, 10) : 1;
      var message = rsvpMessageInput ? rsvpMessageInput.value.trim() : '';

      var isValid = true;
      var firstInvalidEl = null;

      if (!firstName) {
        setFieldError(rsvpNameInput, rsvpNameError, 'გთხოვთ, შეიყვანოთ თქვენი სახელი.');
        isValid = false;
        firstInvalidEl = firstInvalidEl || rsvpNameInput;
      }

      if (!lastName) {
        setFieldError(rsvpSurnameInput, rsvpSurnameError, 'გთხოვთ, შეიყვანოთ თქვენი გვარი.');
        isValid = false;
        firstInvalidEl = firstInvalidEl || rsvpSurnameInput;
      }

      if (!attendeeCount || attendeeCount < 1 || attendeeCount > 20) {
        setFieldError(rsvpCountSelect, rsvpCountError, 'გთხოვთ, აირჩიოთ სტუმრების რაოდენობა.');
        isValid = false;
        firstInvalidEl = firstInvalidEl || rsvpCountSelect;
      }

      var extraCount = Math.max(0, attendeeCount - 1);
      var guestsPayload = [];

      for (var i = 0; i < extraCount; i++) {
        var gFirstInput = document.getElementById('guest-first-' + i);
        var gLastInput  = document.getElementById('guest-last-' + i);
        var gFirstErr   = document.getElementById('guest-first-error-' + i);
        var gLastErr    = document.getElementById('guest-last-error-' + i);

        var gFirst = gFirstInput ? gFirstInput.value.trim() : '';
        var gLast  = gLastInput  ? gLastInput.value.trim()  : '';
        var ordinal = georgianOrdinal(i + 2);

        if (!gFirst) {
          setFieldError(gFirstInput, gFirstErr, 'გთხოვთ, შეიყვანოთ ' + ordinal + ' სტუმრის სახელი.');
          isValid = false;
          firstInvalidEl = firstInvalidEl || gFirstInput;
        }

        if (!gLast) {
          setFieldError(gLastInput, gLastErr, 'გთხოვთ, შეიყვანოთ ' + ordinal + ' სტუმრის გვარი.');
          isValid = false;
          firstInvalidEl = firstInvalidEl || gLastInput;
        }

        guestsPayload.push({
          first_name: gFirst,
          last_name: gLast
        });
      }

      if (!isValid) {
        rsvpStatus.textContent = 'გთხოვთ, შეავსოთ ყველა სავალდებულო ველი.';
        rsvpStatus.classList.add('is-error');
        if (firstInvalidEl) firstInvalidEl.focus();
        return;
      }

      if (!supabaseClient) {
        rsvpStatus.textContent = 'კავშირის შეცდომა. გთხოვთ, განაახლოთ გვერდი.';
        rsvpStatus.classList.add('is-error');
        return;
      }

      isSubmittingRsvp = true;
      setButtonLoading(rsvpSubmitBtn, true, 'დასწრების დადასტურება', 'იგზავნება...');

      try {
        var rpcResult = await supabaseClient.rpc('submit_rsvp', {
          p_first_name: firstName,
          p_last_name: lastName,
          p_attendee_count: attendeeCount,
          p_message: message || null,
          p_guests: guestsPayload
        });

        if (rpcResult.error) throw rpcResult.error;

        rsvpSubmitted = true;
        rsvpForm.hidden = true;
        rsvpForm.style.display = 'none';

        if (rsvpSuccessMsg) {
          rsvpSuccessMsg.textContent = 'მადლობა, ' + firstName + '! თქვენი დასწრება წარმატებით დადასტურდა.';
        }
        if (rsvpSuccessDetail) {
          rsvpSuccessDetail.textContent = 'დადასტურებული სტუმრების რაოდენობა: ' + attendeeCount;
        }

        if (rsvpThankyou) {
          rsvpThankyou.hidden = false;
          rsvpThankyou.setAttribute('aria-hidden', 'false');
          requestAnimationFrame(function () {
            rsvpThankyou.classList.add('visible');
          });
        }
      } catch (err) {
        rsvpStatus.textContent = 'დაფიქსირდა შეცდომა. გთხოვთ, კიდევ ერთხელ სცადოთ.';
        rsvpStatus.classList.add('is-error');
        setButtonLoading(rsvpSubmitBtn, false, 'დასწრების დადასტურება', 'იგზავნება...');
      } finally {
        isSubmittingRsvp = false;
      }
    });
  }

  // ===== Wedding Wishes — სურვილები =====

  var wishesForm        = document.getElementById('wishes-form');
  var wishNameInput     = document.getElementById('wish-name');
  var wishMessageInput  = document.getElementById('wish-message');
  var wishNameError     = document.getElementById('wish-name-error');
  var wishMessageError  = document.getElementById('wish-message-error');
  var wishCharCount     = document.getElementById('wish-char-count');
  var wishSubmitBtn     = document.getElementById('wish-submit');
  var wishStatus        = document.getElementById('wish-status');
  var wishesList        = document.getElementById('wishes-list');
  var wishesLoading     = document.getElementById('wishes-loading');
  var wishesEmpty       = document.getElementById('wishes-empty');

  var isSubmittingWish = false;

  // Safe DOM builder for wish cards (never uses innerHTML for user content)
  function createWishCardElement(wish) {
    var card = document.createElement('article');
    card.className = 'wish-card';

    var body = document.createElement('p');
    body.className = 'wish-card__message';
    body.textContent = wish.message || '';

    var footer = document.createElement('div');
    footer.className = 'wish-card__footer';

    var author = document.createElement('span');
    author.className = 'wish-card__author';
    author.textContent = wish.first_name || '';

    var dateEl = document.createElement('span');
    dateEl.className = 'wish-card__date';
    dateEl.textContent = formatGeorgianDate(wish.created_at);

    footer.appendChild(author);
    footer.appendChild(dateEl);

    card.appendChild(body);
    card.appendChild(footer);

    return card;
  }

  async function loadPublishedWishes() {
    if (!wishesList || !supabaseClient) {
      if (wishesLoading) wishesLoading.hidden = true;
      return;
    }

    try {
      var res = await supabaseClient
        .from('wishes')
        .select('id, first_name, message, created_at')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(100);

      if (res.error) throw res.error;

      var items = res.data || [];
      if (wishesLoading) wishesLoading.hidden = true;

      wishesList.innerHTML = '';
      if (items.length === 0) {
        if (wishesEmpty) wishesEmpty.hidden = false;
        return;
      }

      if (wishesEmpty) wishesEmpty.hidden = true;
      items.forEach(function (wish, index) {
        var card = createWishCardElement(wish);
        card.style.animationDelay = Math.min(index * 0.06, 0.42) + 's';
        wishesList.appendChild(card);
      });
    } catch (err) {
      if (wishesLoading) wishesLoading.hidden = true;
      if (wishesEmpty) {
        wishesEmpty.textContent = 'სურვილების ჩატვირთვა ვერ მოხერხდა.';
        wishesEmpty.hidden = false;
      }
    }
  }

  if (wishNameInput) {
    wishNameInput.addEventListener('input', function () {
      clearFieldError(wishNameInput, wishNameError);
    });
  }

  if (wishMessageInput) {
    wishMessageInput.addEventListener('input', function () {
      clearFieldError(wishMessageInput, wishMessageError);
      if (wishCharCount) {
        wishCharCount.textContent = wishMessageInput.value.length + ' / 500';
      }
    });
  }

  if (wishesForm) {
    wishesForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      if (isSubmittingWish) return;

      wishStatus.textContent = '';
      wishStatus.className = 'estate-status';

      var firstName = wishNameInput ? wishNameInput.value.trim() : '';
      var message = wishMessageInput ? wishMessageInput.value.trim() : '';
      var isValid = true;
      var firstInvalid = null;

      if (!firstName) {
        setFieldError(wishNameInput, wishNameError, 'გთხოვთ, შეიყვანოთ თქვენი სახელი.');
        isValid = false;
        firstInvalid = firstInvalid || wishNameInput;
      }

      if (!message) {
        setFieldError(wishMessageInput, wishMessageError, 'გთხოვთ, დაწეროთ თქვენი სურვილი.');
        isValid = false;
        firstInvalid = firstInvalid || wishMessageInput;
      }

      if (!isValid) {
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      if (!supabaseClient) {
        wishStatus.textContent = 'კავშირის შეცდომა. გთხოვთ, განაახლოთ გვერდი.';
        wishStatus.classList.add('is-error');
        return;
      }

      isSubmittingWish = true;
      setButtonLoading(wishSubmitBtn, true, 'სურვილის გამოქვეყნება', 'ქვეყნდება...');

      try {
        var insertRes = await supabaseClient
          .from('wishes')
          .insert({
            first_name: firstName,
            message: message,
            is_published: true
          })
          .select('id, first_name, message, created_at')
          .single();

        if (insertRes.error) throw insertRes.error;

        var savedWish = insertRes.data || {
          first_name: firstName,
          message: message,
          created_at: new Date().toISOString()
        };

        if (wishesEmpty) wishesEmpty.hidden = true;
        if (wishesList) {
          var newCard = createWishCardElement(savedWish);
          wishesList.insertBefore(newCard, wishesList.firstChild);
        }

        wishesForm.reset();
        if (wishCharCount) wishCharCount.textContent = '0 / 500';

        wishStatus.textContent = 'მადლობა! თქვენი სურვილი წარმატებით გამოქვეყნდა.';
        wishStatus.classList.add('is-success');
      } catch (err) {
        wishStatus.textContent = 'სურვილის გაგზავნა ვერ მოხერხდა. გთხოვთ, სცადოთ თავიდან.';
        wishStatus.classList.add('is-error');
      } finally {
        isSubmittingWish = false;
        setButtonLoading(wishSubmitBtn, false, 'სურვილის გამოქვეყნება', 'ქვეყნდება...');
      }
    });
  }

  loadPublishedWishes();

  // ===== Countdown =====

  var cdTarget = new Date('2027-01-23T14:00:00+04:00').getTime();
  var cdDays   = document.getElementById('cd-days');
  var cdHours  = document.getElementById('cd-hours');
  var cdMins   = document.getElementById('cd-mins');
  var cdSecs   = document.getElementById('cd-secs');

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function tickCountdown() {
    var diff = cdTarget - Date.now();
    if (diff < 0) diff = 0;
    var d = Math.floor(diff / 86400000);
    var h = Math.floor((diff % 86400000) / 3600000);
    var m = Math.floor((diff % 3600000) / 60000);
    var s = Math.floor((diff % 60000) / 1000);
    if (cdDays)  cdDays.textContent  = pad(d);
    if (cdHours) cdHours.textContent = pad(h);
    if (cdMins)  cdMins.textContent  = pad(m);
    if (cdSecs)  cdSecs.textContent  = pad(s);
  }

  if (cdDays) {
    tickCountdown();
    setInterval(tickCountdown, 1000);
  }

  // ===== Scroll Reveal =====

  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    var revealObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    revealEls.forEach(function (el) { revealObs.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('visible'); });
  }

  // ===== Falling Petals =====
  if (petalsLayer) {
    var petalSrcs  = ['pettle1.png', 'pettle2.png', 'pettle3.png'];
    var petalAnims = ['petalFallA', 'petalFallB', 'petalFallC'];
    var PETAL_COUNT = 6;
    var heroEl = document.querySelector('.hero');
    var siteEl = document.getElementById('site');
    var heroH  = heroEl ? heroEl.offsetHeight : window.innerHeight;
    var siteH  = siteEl ? siteEl.offsetHeight : (document.body.scrollHeight || 3000);
    var zoneH  = Math.max(siteH - heroH, window.innerHeight);
    for (var pi = 0; pi < PETAL_COUNT; pi++) {
      var pel   = document.createElement('img');
      pel.className = 'petal';
      pel.src   = petalSrcs[pi % petalSrcs.length];
      pel.alt   = '';
      var pSize  = 44 + Math.floor(Math.random() * 28);
      var pLeft  = (pi / PETAL_COUNT) * 94 + 3 + (Math.random() - 0.5) * 8;
      pLeft = Math.max(3, Math.min(90, pLeft));
      var pDur   = 14 + Math.random() * 8;
      var pDelay = -(Math.random() * pDur);
      var pAnim  = petalAnims[pi % petalAnims.length];
      var topFrac = (pi + 0.5 + (Math.random() - 0.5) * 0.7) / PETAL_COUNT;
      topFrac = Math.max(0, Math.min(0.95, topFrac));
      var topPx = heroH + topFrac * zoneH;
      pel.style.cssText = 'width:' + pSize + 'px;left:' + pLeft.toFixed(1) + '%;top:' + Math.round(topPx) + 'px;animation:' + pAnim + ' ' + pDur.toFixed(1) + 's ease-in-out infinite ' + pDelay.toFixed(1) + 's';
      petalsLayer.appendChild(pel);
    }
  }

}());