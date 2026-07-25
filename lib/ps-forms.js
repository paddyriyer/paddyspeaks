/**
 * PaddySpeaks — shared client logic for the Contact and Testimonial forms.
 *
 * Deliberately dependency-free and framework-free, matching the rest of the
 * site. Handles: accessible inline validation, live character counting,
 * duplicate-click suppression, loading/success/error states, content
 * preservation on failure, and privacy-safe analytics events (never any
 * name, email, or message content).
 */
(function () {
  'use strict';

  var API_BASE = 'https://ps.paddyspeaks.com';

  /* ── privacy-safe analytics (no PII, ever) ── */
  function track(name, props) {
    try { if (window.psTrack) window.psTrack(name, props || {}); } catch (e) {}
  }

  /* ── validation mirrors analytics/lib/forms.js ── */
  var LIMITS = {
    name: { min: 1, max: 120 },
    subject: { min: 3, max: 160 },
    message: { min: 20, max: 4000 },
    testimonial: { min: 60, max: 700 },
    url: { min: 0, max: 300 }
  };
  function len(v) { return Array.from(String(v || '').trim()).length; }
  function isEmail(v) {
    var s = String(v || '').trim();
    return s.length >= 5 && s.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && !/\.\./.test(s);
  }
  function isOptionalUrl(v) {
    var s = String(v || '').trim();
    if (!s) return true;
    return s.length <= LIMITS.url.max && /^https?:\/\/[^\s.]+\.[^\s]+$/.test(s);
  }

  /* ── field error plumbing (ties input ⇄ message via aria-describedby) ── */
  function showError(form, field, msg) {
    var el = form.querySelector('[name="' + field + '"]');
    var box = form.querySelector('#err-' + field);
    if (box) { box.textContent = msg; box.classList.add('show'); }
    if (el) el.setAttribute('aria-invalid', 'true');
  }
  function clearError(form, field) {
    var el = form.querySelector('[name="' + field + '"]');
    var box = form.querySelector('#err-' + field);
    if (box) { box.textContent = ''; box.classList.remove('show'); }
    if (el) el.removeAttribute('aria-invalid');
  }
  function clearAllErrors(form) {
    form.querySelectorAll('.ps-error').forEach(function (b) { b.textContent = ''; b.classList.remove('show'); });
    form.querySelectorAll('[aria-invalid]').forEach(function (e) { e.removeAttribute('aria-invalid'); });
  }
  function focusFirstError(form, errors) {
    var first = Object.keys(errors)[0];
    if (!first) return;
    var el = form.querySelector('[name="' + first + '"]');
    if (el && el.focus) el.focus();
  }

  function banner(form, type, msg) {
    var b = form.querySelector('.ps-banner');
    if (!b) return;
    b.className = 'ps-banner show ' + type;
    b.textContent = msg;
    b.setAttribute('role', type === 'error' ? 'alert' : 'status');
  }
  function hideBanner(form) {
    var b = form.querySelector('.ps-banner');
    if (b) { b.className = 'ps-banner'; b.textContent = ''; }
  }

  /* ── live character counter ── */
  function wireCounter(form, fieldName, min, max) {
    var el = form.querySelector('[name="' + fieldName + '"]');
    var out = form.querySelector('#count-' + fieldName);
    if (!el || !out) return;
    function update() {
      var n = len(el.value);
      out.textContent = n + ' / ' + max;
      out.classList.toggle('over', n > max || (n > 0 && n < min));
    }
    el.addEventListener('input', update);
    update();
  }

  /* ── generic submit pipeline ── */
  function wireForm(opts) {
    var form = document.getElementById(opts.formId);
    if (!form) return;
    var submitBtn = form.querySelector('.ps-submit');
    var successPanel = document.getElementById(opts.successId);
    var submitting = false;   // duplicate-click guard
    var succeeded = false;

    track(opts.viewEvent, {});

    // Clear a field's error as soon as the user edits it
    form.addEventListener('input', function (e) {
      if (e.target && e.target.name) clearError(form, e.target.name);
    });
    form.addEventListener('change', function (e) {
      if (e.target && e.target.name) clearError(form, e.target.name);
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (submitting || succeeded) return;   // repeated clicks do nothing

      hideBanner(form);
      clearAllErrors(form);

      var fd = new FormData(form);
      var payload = opts.collect(fd, form);
      var errors = opts.validate(payload);

      if (Object.keys(errors).length) {
        Object.keys(errors).forEach(function (k) { showError(form, k, errors[k]); });
        banner(form, 'error', 'Please correct the highlighted fields and try again.');
        focusFirstError(form, errors);
        track(opts.errorEvent, { stage: 'client_validation', field_count: Object.keys(errors).length });
        return;
      }

      submitting = true;
      submitBtn.disabled = true;
      submitBtn.classList.add('loading');
      submitBtn.setAttribute('aria-busy', 'true');
      var labelEl = submitBtn.querySelector('.ps-submit-label');
      var originalLabel = labelEl ? labelEl.textContent : '';
      if (labelEl) labelEl.textContent = opts.loadingLabel || 'Sending…';

      fetch(API_BASE + opts.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          return { status: res.status, body: body };
        });
      }).then(function (r) {
        if (r.status === 200 && r.body && r.body.ok) {
          succeeded = true;
          track(opts.successEvent, {});
          // Reveal the success panel; the form's content is no longer needed.
          form.style.display = 'none';
          if (successPanel) {
            successPanel.classList.add('show');
            successPanel.setAttribute('tabindex', '-1');
            successPanel.focus();
            successPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          return;
        }

        // ── failure: the visitor's typed content is preserved (we never reset) ──
        if (r.status === 422 && r.body && r.body.errors) {
          Object.keys(r.body.errors).forEach(function (k) { showError(form, k, r.body.errors[k]); });
          banner(form, 'error', 'Please correct the highlighted fields and try again.');
          focusFirstError(form, r.body.errors);
          track(opts.errorEvent, { stage: 'server_validation' });
        } else if (r.status === 429) {
          banner(form, 'error', (r.body && r.body.message) || 'Too many submissions. Please try again a little later.');
          track(opts.errorEvent, { stage: 'rate_limited' });
        } else if (r.status === 503) {
          banner(form, 'error', 'This form is not available right now. Please email paddy@paddyspeaks.com directly.');
          track(opts.errorEvent, { stage: 'not_configured' });
        } else {
          banner(form, 'error', (r.body && r.body.message) || 'Something went wrong sending your message. Your text is still here — please try again.');
          track(opts.errorEvent, { stage: 'server_error', status: r.status });
        }
      }).catch(function () {
        banner(form, 'error', 'We could not reach the server. Your text is still here — please check your connection and try again.');
        track(opts.errorEvent, { stage: 'network' });
      }).then(function () {
        if (!succeeded) {
          submitting = false;
          submitBtn.disabled = false;
          submitBtn.classList.remove('loading');
          submitBtn.removeAttribute('aria-busy');
          if (labelEl) labelEl.textContent = originalLabel;
        }
      });
    });
  }

  /* ── Contact form ── */
  function initContact() {
    if (!document.getElementById('contactForm')) return;
    var form = document.getElementById('contactForm');
    wireCounter(form, 'message', LIMITS.message.min, LIMITS.message.max);
    wireForm({
      formId: 'contactForm',
      successId: 'contactSuccess',
      endpoint: '/api/contact',
      viewEvent: 'contact_form_view',
      successEvent: 'contact_submit_success',
      errorEvent: 'contact_submit_error',
      loadingLabel: 'Sending…',
      collect: function (fd) {
        return {
          name: fd.get('name') || '',
          email: fd.get('email') || '',
          reason: fd.get('reason') || '',
          subject: fd.get('subject') || '',
          message: fd.get('message') || '',
          sendCopy: fd.get('sendCopy') === 'on',
          company: fd.get('company') || ''   // honeypot
        };
      },
      validate: function (p) {
        var e = {};
        if (len(p.name) < LIMITS.name.min) e.name = 'Please enter your name.';
        else if (len(p.name) > LIMITS.name.max) e.name = 'Name is too long.';
        if (!isEmail(p.email)) e.email = 'Please enter a valid email address.';
        if (!p.reason) e.reason = 'Please choose a reason for contacting.';
        if (len(p.subject) < LIMITS.subject.min) e.subject = 'Please add a short subject (at least 3 characters).';
        else if (len(p.subject) > LIMITS.subject.max) e.subject = 'Subject must be 160 characters or fewer.';
        if (len(p.message) < LIMITS.message.min) e.message = 'Please write at least 20 characters so I can respond usefully.';
        else if (len(p.message) > LIMITS.message.max) e.message = 'Message must be 4000 characters or fewer.';
        return e;
      }
    });
  }

  /* ── Testimonial form ── */
  function initTestimonial() {
    if (!document.getElementById('testimonialForm')) return;
    var form = document.getElementById('testimonialForm');
    wireCounter(form, 'body', LIMITS.testimonial.min, LIMITS.testimonial.max);
    wireForm({
      formId: 'testimonialForm',
      successId: 'testimonialSuccess',
      endpoint: '/api/testimonials',
      viewEvent: 'testimonial_form_view',
      successEvent: 'testimonial_submit_success',
      errorEvent: 'testimonial_submit_error',
      loadingLabel: 'Submitting…',
      collect: function (fd) {
        return {
          name: fd.get('name') || '',
          email: fd.get('email') || '',
          role: fd.get('role') || '',
          organization: fd.get('organization') || '',
          relationship: fd.get('relationship') || '',
          body: fd.get('body') || '',
          verifyUrl: fd.get('verifyUrl') || '',
          displayPref: fd.get('displayPref') || '',
          consent: fd.get('consent') === 'on',
          company_website: fd.get('company_website') || ''  // honeypot
        };
      },
      validate: function (p) {
        var e = {};
        if (len(p.name) < 1) e.name = 'Please enter your name.';
        if (!isEmail(p.email)) e.email = 'Please enter a valid email address.';
        if (!p.relationship) e.relationship = 'Please choose your relationship to PaddySpeaks.';
        var n = len(p.body);
        if (n < LIMITS.testimonial.min) e.body = 'Please write at least 60 characters.';
        else if (n > LIMITS.testimonial.max) e.body = 'Please keep your testimonial to 700 characters or fewer.';
        if (!isOptionalUrl(p.verifyUrl)) e.verifyUrl = 'Please enter a valid link starting with http:// or https://, or leave it blank.';
        if (!p.displayPref) e.displayPref = 'Please choose how your name should appear.';
        if (!p.consent) e.consent = 'Please give permission to publish before submitting.';
        return e;
      }
    });
  }

  /* ── Public testimonial rendering (shared by /testimonials and the homepage) ── */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  var REL_LABELS = {
    reader: 'Reader', studio_user: 'Interview Studio', collaborator: 'Collaborator',
    attendee: 'Event attendee', community: 'Community', other: 'Reader'
  };
  function cardHtml(t) {
    var meta = [t.role, t.organization].filter(Boolean).join(' · ');
    return '<figure class="testimonial-card">' +
      '<blockquote class="t-body">' + esc(t.body) + '</blockquote>' +
      '<figcaption class="t-attr">' +
        '<div class="t-name">' + esc(t.name) + '</div>' +
        (meta ? '<div class="t-role">' + esc(meta) + '</div>' : '') +
        '<span class="t-rel">' + esc(REL_LABELS[t.relationship] || 'Reader') + '</span>' +
      '</figcaption>' +
    '</figure>';
  }

  /**
   * Render approved testimonials into `containerId`.
   * If there are none, show the honest invitation block instead — we never
   * fabricate sample praise.
   */
  function renderTestimonials(opts) {
    var container = document.getElementById(opts.containerId);
    var invite = document.getElementById(opts.inviteId);
    var section = opts.sectionId ? document.getElementById(opts.sectionId) : null;
    if (!container) return;

    var url = API_BASE + '/api/testimonials?limit=' + (opts.limit || 50) + (opts.featured ? '&featured=1' : '');
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var list = (data && data.testimonials) || [];
        if (opts.max) list = list.slice(0, opts.max);
        if (!list.length) {
          container.innerHTML = '';
          container.hidden = true;
          if (invite) invite.hidden = false;
          if (section && opts.hideSectionWhenEmpty) section.hidden = true;
          return;
        }
        container.innerHTML = list.map(cardHtml).join('');
        container.hidden = false;
        if (invite) invite.hidden = true;
        if (opts.onRendered) opts.onRendered(list.length);
      })
      .catch(function () {
        container.innerHTML = '';
        container.hidden = true;
        if (invite) invite.hidden = false;
        if (section && opts.hideSectionWhenEmpty) section.hidden = true;
      });
  }

  window.psForms = { renderTestimonials: renderTestimonials, API_BASE: API_BASE };

  function boot() { initContact(); initTestimonial(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
