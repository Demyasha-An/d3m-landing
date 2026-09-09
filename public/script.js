(function () {
  "use strict";

  var cfg = window.__D3MVPN_CONFIG__ || {
    dashboardUrl: "#",
    telegramBotUrl: "#",
    minPrice: "80",
    currency: "\u20BD",
  };
  cfg.promoWord = cfg.promoWord || { code: "", text: "" };
  cfg.promoLogo = cfg.promoLogo || { code: "", text: "" };
  cfg.legal = cfg.legal || {};

  /* ── i18n ─────────────────────────────── */
  var i18n = {
    ru: {
      "nav.cabinet": "Кабинет / Регистрация",
      "hero.badge.allActive": "Серверы работают",
      "hero.badge.recommended": "Свободнее всего",
      "hero.badge.maintenance": "Ведутся технические работы",
      "hero.badge.loading": "Проверка статуса...",
      "hero.title": "Быстрый и приватный VPN",
      "hero.titleAccent": "для каждого дня.",
      "hero.subtitle":
        "d3mvpn — стабильное соединение, высокая скорость и защита вашей приватности.",
      "hero.telegram": "Начать в Telegram",
      "hero.cabinet": "Личный кабинет / Регистрация",
      "hero.priceLabel": "Тарифы от",
      "hero.note": "Пробный период — без карты и обязательств.",
      "feat.privacy.title": "Полная анонимность",
      "feat.privacy.text":
        "Мы не собираем и не храним логи. Ваша активность остаётся только вашей.",
      "feat.speed.title": "Высокая скорость",
      "feat.speed.text":
        "Оптимизированные серверы для стриминга, игр и работы без задержек.",
      "feat.stable.title": "Стабильное соединение",
      "feat.stable.text":
        "Надёжный аптайм и автопереключение, чтобы вы всегда оставались онлайн.",
      "feat.trial.title": "Пробный период",
      "feat.trial.text":
        "Протестируйте сервис до оплаты и убедитесь в качестве соединения.",
      "footer.rights": "Все права защищены.",
      "footer.docs": "Документы",
      priceFormat: "{value}{currency}/мес",
      "promo.title": "Секретный промокод найден!",
      "promo.copy": "Скопировать",
      "promo.copied": "Скопировано!",
      "promo.close": "Закрыть",
    },
    en: {
      "nav.cabinet": "Sign in / Sign up",
      "hero.badge.allActive": "Servers online",
      "hero.badge.recommended": "Least loaded",
      "hero.badge.maintenance": "Maintenance in progress",
      "hero.badge.loading": "Checking status...",
      "hero.title": "Fast, private VPN",
      "hero.titleAccent": "for everyday use.",
      "hero.subtitle":
        "d3mvpn delivers a stable connection, high speed and real privacy.",
      "hero.telegram": "Start on Telegram",
      "hero.cabinet": "Dashboard / Sign up",
      "hero.priceLabel": "Plans from",
      "hero.note": "Free trial — no card, no commitment.",
      "feat.privacy.title": "Full anonymity",
      "feat.privacy.text":
        "We don't collect or store any logs. Your activity stays yours alone.",
      "feat.speed.title": "High speed",
      "feat.speed.text":
        "Optimized servers for streaming, gaming and work with no lag.",
      "feat.stable.title": "Stable connection",
      "feat.stable.text":
        "Reliable uptime and auto-reconnect so you always stay online.",
      "feat.trial.title": "Free trial",
      "feat.trial.text":
        "Test the service before you pay and see the quality for yourself.",
      "footer.rights": "All rights reserved.",
      "footer.docs": "Documents",
      priceFormat: "{value}{currency}/mo",
      "promo.title": "Secret promo code unlocked!",
      "promo.copy": "Copy",
      "promo.copied": "Copied!",
      "promo.close": "Close",
    },
  };

  function priceText(lang) {
    return i18n[lang].priceFormat
      .replace("{value}", cfg.minPrice)
      .replace("{currency}", cfg.currency);
  }

  function applyLang(lang) {
    var dict = i18n[lang];
    if (!dict) return;

    document.documentElement.lang = lang;

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      var value = dict[key];
      if (value == null) return;
      value = value.replace("{price}", priceText(lang));
      // Preserve child <span> placeholders (e.g. the price accent) by only
      // replacing when there is no element to keep.
      if (el.querySelector("[data-price]")) {
        // Rebuild: text + accent span containing the price.
        var parts = value.split(priceText(lang));
        el.textContent = parts[0];
        var span = document.createElement("span");
        span.className = "accent";
        span.setAttribute("data-price", "");
        span.textContent = priceText(lang);
        el.appendChild(span);
        if (parts[1]) el.appendChild(document.createTextNode(parts[1]));
      } else {
        el.textContent = value;
      }
    });

    // Standalone price nodes (pricing card).
    document.querySelectorAll("[data-price]").forEach(function (el) {
      el.textContent = priceText(lang);
    });

    document.querySelectorAll(".lang-btn").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-lang") === lang);
    });

    try {
      localStorage.setItem("d3mvpn-lang", lang);
    } catch (e) {}

    renderLegal();
  }

  /* ── Wire links from .env config ──────── */
  document.querySelectorAll("[data-link]").forEach(function (el) {
    var type = el.getAttribute("data-link");
    if (type === "telegram") el.href = cfg.telegramBotUrl;
    if (type === "dashboard") el.href = cfg.dashboardUrl;
    el.rel = "noopener";
  });

  /* ── Lang switch events ───────────────── */
  document.querySelectorAll(".lang-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      applyLang(btn.getAttribute("data-lang"));
    });
  });

  var saved = "ru";
  try {
    saved = localStorage.getItem("d3mvpn-lang") || "ru";
  } catch (e) {}
  applyLang(saved);

  /* ── Legal link from .env config ──── */
  function renderLegal() {
    var lang = document.documentElement.lang || "ru";
    var dict = i18n[lang] || i18n.ru;
    var url = cfg.legal.docsUrl || "/docs.html";
    document.querySelectorAll("[data-legal]").forEach(function (nav) {
      nav.textContent = "";
      var a = document.createElement("a");
      a.href = url;
      a.textContent = dict["footer.docs"] || "footer.docs";
      nav.appendChild(a);
    });
  }

  /* ── Year ─────────────────────────────── */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* ── Hidden promo Easter eggs ─────────── */
  (function promoEggs() {
    function t(key) {
      var lang = document.documentElement.lang || "ru";
      return (i18n[lang] && i18n[lang][key]) || (i18n.ru && i18n.ru[key]) || key;
    }

    // Remember which codes were already revealed so we don't nag on repeat.
    var revealed = {};

    function copyCode(code, btn) {
      var done = function () {
        var old = btn.textContent;
        btn.textContent = t("promo.copied");
        btn.classList.add("is-copied");
        setTimeout(function () {
          btn.textContent = old;
          btn.classList.remove("is-copied");
        }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(done, done);
      } else {
        try {
          var ta = document.createElement("textarea");
          ta.value = code;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
          done();
        } catch (e) {}
      }
    }

    function reveal(promo) {
      if (!promo || !promo.code || revealed[promo.code]) return;
      revealed[promo.code] = true;

      var toast = document.createElement("div");
      toast.className = "promo-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");

      var title = document.createElement("p");
      title.className = "promo-toast__title";
      title.textContent = t("promo.title");

      var codeRow = document.createElement("div");
      codeRow.className = "promo-toast__row";

      var codeEl = document.createElement("code");
      codeEl.className = "promo-toast__code";
      codeEl.textContent = promo.code;

      var copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "promo-toast__copy";
      copyBtn.textContent = t("promo.copy");
      copyBtn.addEventListener("click", function () {
        copyCode(promo.code, copyBtn);
      });

      codeRow.appendChild(codeEl);
      codeRow.appendChild(copyBtn);
      toast.appendChild(title);
      toast.appendChild(codeRow);

      if (promo.text) {
        var desc = document.createElement("p");
        desc.className = "promo-toast__desc";
        desc.textContent = promo.text;
        toast.appendChild(desc);
      }

      var closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "promo-toast__close";
      closeBtn.setAttribute("aria-label", t("promo.close"));
      closeBtn.innerHTML = "&times;";
      var dismiss = function () {
        toast.classList.remove("is-visible");
        setTimeout(function () {
          if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
      };
      closeBtn.addEventListener("click", dismiss);
      toast.appendChild(closeBtn);

      document.body.appendChild(toast);
      // Trigger enter transition on next frame.
      requestAnimationFrame(function () {
        toast.classList.add("is-visible");
      });
      setTimeout(dismiss, 12000);
    }

    // Egg #1 — just type the word "promo" anywhere on the page.
    var word = "promo";
    var typed = "";
    document.addEventListener("keydown", function (e) {
      if (e.key.length !== 1) return; // ignore Shift, Arrows, etc.
      typed = (typed + e.key.toLowerCase()).slice(-word.length);
      if (typed === word) {
        typed = "";
        reveal(cfg.promoWord);
      }
    });

    // Egg #2 — triple-click the header logo.
    var logo = document.querySelector(".site-header .brand");
    if (logo) {
      var clicks = 0;
      var resetTimer;
      logo.addEventListener("click", function (e) {
        e.preventDefault();
        clicks += 1;
        clearTimeout(resetTimer);
        resetTimer = setTimeout(function () {
          clicks = 0;
        }, 600);
        if (clicks >= 3) {
          clicks = 0;
          reveal(cfg.promoLogo);
        }
      });
    }
  })();

  /* ── Live nodes status ────────────────── */
  (function nodesStatus() {
    var badge = document.querySelector("[data-nodes-status]");
    if (!badge) return;

    function t(key) {
      var lang = document.documentElement.lang || "ru";
      return (i18n[lang] && i18n[lang][key]) || (i18n.ru && i18n.ru[key]) || key;
    }

    function updateBadge(data) {
      var allActive = data.allActive;
      var recommended = data.recommendedNode;

      var dot = badge.querySelector(".pill__dot");
      if (!dot) {
        dot = document.createElement("span");
        dot.className = "pill__dot";
        dot.setAttribute("aria-hidden", "true");
        badge.insertBefore(dot, badge.firstChild);
      }

      if (allActive) {
        badge.classList.remove("pill--warning");
        badge.textContent = "";
        badge.appendChild(dot);

        if (recommended && recommended.host) {
          // Strip a leading flag emoji (regional indicators): Windows has no
          // flag glyphs and shows letter pairs instead — we render our own chip.
          var host = String(recommended.host).replace(/^[\u{1F1E6}-\u{1F1FF}]{2}\s*/u, "");
          badge.appendChild(document.createTextNode(
            t("hero.badge.allActive") + " — " +
            t("hero.badge.recommended") + ": "
          ));
          if (recommended.countryCode) {
            var cc = String(recommended.countryCode).toLowerCase();
            var flag = document.createElement("span");
            flag.className = "pill__flag pill__flag--img";
            var img = document.createElement("img");
            img.className = "pill__flag-img";
            img.src = "https://flagcdn.com/w80/" + encodeURIComponent(cc) + ".png";
            img.alt = String(recommended.countryCode).toUpperCase();
            img.loading = "lazy";
            img.onerror = function () {
              flag.textContent = String(recommended.countryCode).toUpperCase();
              flag.classList.remove("pill__flag--img");
            };
            flag.appendChild(img);
            badge.appendChild(flag);
            badge.appendChild(document.createTextNode(" "));
          }
          badge.appendChild(document.createTextNode(host || recommended.host));
        } else {
          // No recommendation data — simple text
          badge.appendChild(document.createTextNode(t("hero.badge.allActive")));
        }
      } else {
        badge.classList.add("pill--warning");
        badge.textContent = "";
        badge.appendChild(dot);
        badge.appendChild(document.createTextNode(t("hero.badge.maintenance")));
      }
    }

    function fetchStatus() {
      fetch("/api/nodes-status")
        .then(function (res) {
          return res.json();
        })
        .then(function (data) {
          updateBadge(data);
        })
        .catch(function () {
          // On error, show maintenance mode
          updateBadge({ allActive: false, recommendedNode: null });
        });
    }

    // Initial fetch
    fetchStatus();
    // Refresh every 30 seconds
    setInterval(fetchStatus, 30000);
  })();

  /* Animated WebGL background lives in bg.js (three.js module). */
})();
