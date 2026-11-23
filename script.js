/* ============================================================
   Visha — slide engine, transitions, music, navigation
   ============================================================ */

(function () {
  "use strict";

  /* ---------- Config ---------- */
  const TRANSITION_DURATION = 700;
  const SCROLL_DEBOUNCE = 800;
  const SWIPE_MIN = 50;

  // Transition name per destination slide index (forward)
  const TRANSITIONS = [
    "fade-bloom",       // 0
    "morph-fade",       // 1
    "curtain-wipe",     // 2
    "shatter-dissolve", // 3
    "cinematic-push",   // 4
  ];

  const AUDIO_SOURCES = [
    "https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3",
    "https://assets.mixkit.co/music/preview/mixkit-dreaming-big-31.mp3",
    "https://cdn.pixabay.com/audio/2024/02/28/audio_736c3f2f5b.mp3",
  ];

  const VIBE_WORDS = [
    "Radiant", "Present", "Real", "Warm",
    "Effortless", "Distinct", "Calm", "Genuine",
  ];

  const VIBE_HUES = [
    "rgba(192,132,252,0.10)",  // purple
    "rgba(129,140,248,0.10)",  // indigo
    "rgba(167,139,250,0.10)",  // violet
  ];

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Elements ---------- */
  const slides = Array.from(document.querySelectorAll(".slide"));
  const dots = Array.from(document.querySelectorAll(".dot"));
  const curtain = document.querySelector(".curtain-overlay");
  const canvas = document.getElementById("particles");
  const ctx = canvas.getContext("2d");
  const musicPlayer = document.getElementById("musicPlayer");
  const audio = document.getElementById("audio");
  const wordEl = document.querySelector(".word-cycle");

  /* ---------- State ---------- */
  let current = 0;
  let locked = false;
  let scrollLockUntil = 0;
  let vibeIndex = 0;
  let vibeTimer = null;
  let particles = [];
  let particleRAF = null;
  let musicStarted = false;
  let audioIndex = 0;
  let audioFailed = false;

  /* ---------- Slide engine ---------- */
  function getTransitionName(toIndex, fromIndex) {
    // Each slide owns its transition; going back uses reverse of same transition.
    return TRANSITIONS[toIndex];
  }

  function goTo(toIndex) {
    if (locked) return;
    if (toIndex < 0 || toIndex >= slides.length) return;
    if (toIndex === current) return;

    const from = slides[current];
    const to = slides[toIndex];
    const tName = getTransitionName(toIndex, current);
    const forward = toIndex > current;

    locked = true;

    // Stop vibe cycling if leaving slide 4
    if (current === 3 && toIndex !== 3) stopVibeCycle();

    if (reducedMotion) {
      from.classList.remove("active");
      to.classList.add("active");
      current = toIndex;
      updateDots();
      postEnter(toIndex);
      locked = false;
      return;
    }

    // Special handling per transition type
    if (tName === "curtain-wipe") {
      runCurtainWipe(from, to, forward, finish);
    } else if (tName === "shatter-dissolve") {
      runShatterDissolve(from, to, forward, finish);
    } else {
      runStandard(from, to, tName, forward, finish);
    }

    function finish() {
      from.classList.remove("active");
      // remove any transition classes
      cleanupClasses(from);
      cleanupClasses(to);
      to.classList.add("active");
      current = toIndex;
      updateDots();
      postEnter(toIndex);
      locked = false;
    }
  }

  function cleanupClasses(el) {
    const classes = Array.from(el.classList).filter((c) => c.endsWith("-in") || c.endsWith("-out"));
    classes.forEach((c) => el.classList.remove(c));
  }

  function runStandard(from, to, tName, forward, done) {
    const outClass = `${tName}-out`;
    const inClass = `${tName}-in`;
    from.classList.add(outClass);
    to.classList.add("active", inClass);
    let doneCount = 0;
    const onEnd = (e) => {
      if (e.target !== to) return;
      if (++doneCount >= 1) {
        to.removeEventListener("animationend", onEnd);
        done();
      }
    };
    to.addEventListener("animationend", onEnd);
    // Safety timeout
    setTimeout(() => {
      to.removeEventListener("animationend", onEnd);
      done();
    }, TRANSITION_DURATION + 120);
  }

  function runCurtainWipe(from, to, forward, done) {
    // Curtain sweeps across, swaps slide underneath, sweeps away
    const half = TRANSITION_DURATION / 2;

    // Sweep in
    curtain.style.transition = `transform ${half}ms var(--ease-cine)`;
    curtain.style.transformOrigin = forward ? "left center" : "right center";
    requestAnimationFrame(() => {
      curtain.style.transform = "scaleX(1)";
    });

    setTimeout(() => {
      // swap
      from.classList.remove("active");
      to.classList.add("active");
      current = slides.indexOf(to);
      updateDots();
      postEnter(slides.indexOf(to));

      // sweep out
      curtain.style.transformOrigin = forward ? "right center" : "left center";
      requestAnimationFrame(() => {
        curtain.style.transform = "scaleX(0)";
      });

      setTimeout(() => {
        curtain.style.transition = "";
        done();
      }, half);
    }, half);
  }

  function runShatterDissolve(from, to, forward, done) {
    // Build a grid of blocks over the departing slide, stagger them out,
    // reveal incoming slide underneath.
    const grid = buildShatterGrid();
    document.body.appendChild(grid);

    from.classList.add("shatter-dissolve-out");
    to.classList.add("active", "shatter-dissolve-in");

    // animate blocks
    const blocks = grid.querySelectorAll(".shatter-block");
    blocks.forEach((b, i) => {
      const delay = (forward ? i : (blocks.length - 1 - i)) * 6;
      b.style.transition = `opacity 350ms ease ${delay}ms, transform 350ms ease ${delay}ms`;
      requestAnimationFrame(() => {
        b.style.opacity = forward ? "0" : "0";
        b.style.transform = forward
          ? `translate(${(Math.random() - 0.5) * 40}px, ${Math.random() * 30}px) scale(0.6)`
          : `translate(${(Math.random() - 0.5) * 40}px, -${Math.random() * 30}px) scale(0.6)`;
      });
    });

    setTimeout(() => {
      grid.remove();
      done();
    }, TRANSITION_DURATION + 150);
  }

  function buildShatterGrid() {
    const grid = document.createElement("div");
    grid.className = "shatter-grid";
    grid.style.cssText =
      "position:fixed;inset:0;z-index:40;pointer-events:none;display:grid;overflow:hidden;";
    const cols = window.innerWidth < 600 ? 6 : 12;
    const rows = window.innerWidth < 600 ? 8 : 8;
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    for (let i = 0; i < cols * rows; i++) {
      const b = document.createElement("div");
      b.className = "shatter-block";
      b.style.cssText =
        "background:var(--bg);opacity:1;transform:scale(1);will-change:transform,opacity;";
      grid.appendChild(b);
    }
    return grid;
  }

  function postEnter(index) {
    // Show/hide particle canvas only on slide 1
    if (index === 0) {
      canvas.classList.remove("hidden-canvas");
      startParticles();
    } else {
      canvas.classList.add("hidden-canvas");
      // particles keep running but invisible; could stop for perf
    }

    // Vibe cycle on slide 4
    if (index === 3) {
      startVibeCycle();
    } else {
      stopVibeCycle();
    }
  }

  function updateDots() {
    dots.forEach((d, i) => d.classList.toggle("active", i === current));
  }

  /* ---------- Vibe word cycling ---------- */
  function startVibeCycle() {
    if (vibeTimer) return;
    vibeIndex = 0;
    setVibeWord(0);
    vibeTimer = setInterval(() => {
      vibeIndex = (vibeIndex + 1) % VIBE_WORDS.length;
      setVibeWord(vibeIndex);
    }, 2500);
  }

  function stopVibeCycle() {
    if (vibeTimer) {
      clearInterval(vibeTimer);
      vibeTimer = null;
    }
  }

  function setVibeWord(i) {
    if (!wordEl) return;
    const old = wordEl.querySelector(".active-word");
    if (old) {
      old.classList.remove("active-word");
      setTimeout(() => old.remove(), 600);
    }
    const span = document.createElement("span");
    span.className = "word active-word";
    span.textContent = VIBE_WORDS[i];
    wordEl.appendChild(span);
    // shift background hue
    const hue = VIBE_HUES[i % VIBE_HUES.length];
    document.querySelector(".vibe-slide").style.background = `radial-gradient(circle at 50% 50%, ${hue}, transparent 60%)`;
  }

  /* ---------- Particles ---------- */
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function initParticles() {
    particles = [];
    const count = window.innerWidth < 600 ? 30 : 40;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.8 + 0.4,
        speed: Math.random() * 0.4 + 0.15,
        opacity: Math.random() * 0.5 + 0.2,
      });
    }
  }

  function drawParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(192, 132, 252, ${p.opacity})`;
      ctx.fill();
      p.y -= p.speed;
      if (p.y < -5) {
        p.y = canvas.height + 5;
        p.x = Math.random() * canvas.width;
      }
    }
    particleRAF = requestAnimationFrame(drawParticles);
  }

  function startParticles() {
    if (reducedMotion) return;
    if (!particleRAF) {
      resizeCanvas();
      initParticles();
      drawParticles();
    }
  }

  /* ---------- Navigation: dots ---------- */
  dots.forEach((d) => {
    d.addEventListener("click", () => {
      goTo(parseInt(d.dataset.go, 10));
    });
  });

  /* ---------- Navigation: keyboard ---------- */
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowRight" || e.key === " ") {
      e.preventDefault();
      goTo(current + 1);
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
 goTo(current - 1);
    }
  });

  /* ---------- Navigation: scroll (debounced) ---------- */
  window.addEventListener(
    "wheel",
    (e) => {
      if (Date.now() < scrollLockUntil) return;
      if (locked) return;
      if (Math.abs(e.deltaY) < 15) return;
      scrollLockUntil = Date.now() + SCROLL_DEBOUNCE;
      if (e.deltaY > 0) goTo(current + 1);
      else goTo(current - 1);
    },
    { passive: true }
  );

  /* ---------- Navigation: touch ---------- */
  let touchStartY = null;
  let touchStartX = null;

  window.addEventListener("touchstart", (e) => {
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  window.addEventListener("touchend", (e) => {
    if (touchStartY === null) return;
    const dy = e.changedTouches[0].clientY - touchStartY;
    const dx = e.changedTouches[0].clientX - touchStartX;
    touchStartY = null;
    if (Math.abs(dy) < SWIPE_MIN && Math.abs(dx) < SWIPE_MIN) return;
    if (Math.abs(dy) >= Math.abs(dx)) {
      // vertical swipe
      if (dy < 0) goTo(current + 1);
      else goTo(current - 1);
    } else {
      // horizontal swipe
      if (dx < 0) goTo(current + 1);
      else goTo(current - 1);
    }
  }, { passive: true });

  /* ---------- Music player ---------- */
  function initMusic() {
    if (audioFailed) return;
    musicPlayer.classList.add("show-play");

    const tryLoad = (idx) => {
      if (idx >= AUDIO_SOURCES.length) {
        // all failed — hide player
        audioFailed = true;
        musicPlayer.style.display = "none";
        return;
      }
      audio.src = AUDIO_SOURCES[idx];
      audio.load();
    };

    audio.addEventListener("error", () => {
      audioIndex += 1;
      tryLoad(audioIndex);
    });

    audio.addEventListener("canplaythrough", () => {
      // ready
    }, { once: true });

    tryLoad(0);

    const toggle = () => {
      if (audioFailed) return;
      if (!musicStarted) {
        // first click — unmute + play
        audio.muted = false;
        const playPromise = audio.play();
        if (playPromise) {
          playPromise
            .then(() => {
              musicStarted = true;
              musicPlayer.classList.remove("show-play");
              musicPlayer.classList.add("show-pause");
            })
            .catch(() => {
              // try next source
              audioIndex += 1;
              tryLoad(audioIndex);
            });
        }
      } else {
        if (audio.paused) {
          audio.play().catch(() => {});
          musicPlayer.classList.remove("show-play");
          musicPlayer.classList.add("show-pause");
        } else {
          audio.pause();
          musicPlayer.classList.remove("show-pause");
          musicPlayer.classList.add("show-play");
        }
      }
    };

    musicPlayer.addEventListener("click", toggle);
    musicPlayer.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });
  }

  /* ---------- Resize ---------- */
  window.addEventListener("resize", () => {
    resizeCanvas();
    initParticles();
  });

  /* ---------- Init ---------- */
  resizeCanvas();
  initParticles();
  startParticles();
  updateDots();
  initMusic();

  // Trigger slide 1 entrance
  slides[0].classList.add("active");
})();
