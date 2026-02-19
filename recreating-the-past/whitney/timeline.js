// ── timeline ──

/**
 * Wraps a <input type="range"> as a normalised 0-1 timeline.
 * @param {HTMLInputElement} el   – the range input
 * @param {(u:number)=>number} [deriveT] – optional function that derives a
 *        secondary value `t` from the normalised position `u`
 */
export function createTimeline(el, deriveT) {
  const lo = +el.min,
    range = +el.max - lo;
  const tl = {
    get u() {
      return (+el.value - lo) / range;
    },
    set u(v) {
      el.value = lo + Math.max(0, Math.min(1, v)) * range;
    },
  };
  if (deriveT) {
    Object.defineProperty(tl, "t", {
      get() {
        return deriveT(tl.u);
      },
    });
  }
  return tl;
}

// ── player ──

/**
 * Play / pause controller that drives a timeline forward in real-time.
 * @param {HTMLElement}       el     – the play/pause button
 * @param {ReturnType<createTimeline>} tl
 * @param {()=>number}        getDur – returns duration in ms
 */
export function createPlayer(el, tl, getDur) {
  let on = false,
    t0 = 0,
    u0 = 0,
    dur = 0;

  const rebase = () => {
    t0 = performance.now();
    u0 = tl.u;
    dur = getDur();
  };

  const set = (v) => {
    on = v;
    el.textContent = on ? "Pause" : "Play";
    if (on) rebase();
  };

  el.onclick = () => set(!on);

  return {
    rebase: () => on && rebase(),
    pause: () => on && set(false),
    tick(now) {
      if (!on) return;
      const next = u0 + (now - t0) / dur;
      next >= 1 ? ((tl.u = 1), set(false)) : (tl.u = next);
    },
  };
}

// ── recorder ──

/**
 * Records the canvas to a WebM video by stepping through every frame.
 * @param {HTMLElement}       el     – the render/cancel button
 * @param {HTMLCanvasElement} canvas
 * @param {ReturnType<createTimeline>} tl
 * @param {()=>void}          draw   – draw one frame at the current tl position
 * @param {()=>number}        getDur – returns duration in ms
 * @param {()=>MediaStreamTrack[]} [getAudioTracks] – optional, returns live audio tracks to mix in
 */
export function createRecorder(el, canvas, tl, draw, getDur, getAudioTracks) {
  let active = false;
  const locked = [];

  el.onclick = async () => {
    if (active) {
      active = false;
      return;
    }
    active = true;
    el.textContent = "Cancel";
    locked.forEach((e) => (e.disabled = true));

    const totalFrames = (60 * getDur()) / 1000;
    const frameCount = Math.ceil(totalFrames);
    const stream = canvas.captureStream(0);
    const audioTracks = getAudioTracks ? getAudioTracks() : [];
    audioTracks.forEach((t) => stream.addTrack(t));
    const hasAudio = stream.getAudioTracks().length > 0;
    const track = stream.getVideoTracks()[0];
    const mime = hasAudio
      ? MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm"
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
    const rec = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: 8e6,
    });
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.start();

    for (let f = 0; f <= frameCount && active; f++) {
      tl.u = Math.min(f / totalFrames, 1);
      draw();
      track.requestFrame();
      await new Promise((r) => requestAnimationFrame(r));
    }

    // Hold last frame for 1 extra second (60 frames at ~60fps)
    if (active) {
      tl.u = 1;
      const freezeFrames = 60;
      for (let f = 0; f < freezeFrames && active; f++) {
        draw();
        track.requestFrame();
        await new Promise((r) => requestAnimationFrame(r));
      }
    }

    rec.stop();
    await new Promise((r) => (rec.onstop = r));

    if (active) {
      const a = Object.assign(document.createElement("a"), {
        href: URL.createObjectURL(new Blob(chunks, { type: mime })),
        download: "render.webm",
      });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    stream.getTracks().forEach((t) => t.stop());
    active = false;
    el.textContent = "Render";
    locked.forEach((e) => (e.disabled = false));
  };

  return {
    get active() {
      return active;
    },
    lock(...els) {
      locked.push(...els);
    },
  };
}

// ── animation loop ──

/**
 * Starts a requestAnimationFrame loop that ticks the player and draws,
 * skipping when the recorder is active.
 * @param {ReturnType<createPlayer>}   player
 * @param {ReturnType<createRecorder>} recorder
 * @param {()=>void}                   draw
 */
export function startLoop(player, recorder, draw) {
  function loop() {
    if (!recorder.active) {
      player.tick(performance.now());
      draw();
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

// ── standard wiring helper ──

/**
 * One-call setup that wires Play, Render, scrub, duration and the loop.
 * Returns { tl, player, recorder } for further customisation.
 *
 * @param {object}            opts
 * @param {HTMLCanvasElement}  opts.canvas
 * @param {()=>void}           opts.draw
 * @param {(u:number)=>number} [opts.deriveT]
 * @param {()=>MediaStreamTrack[]} [opts.getAudioTracks]
 */
export function wire({ canvas, draw, deriveT, getAudioTracks } = {}) {
  const $ = (id) => document.getElementById(id);
  const durInput = $("duration");
  const getDur = () => Math.max(100, +durInput.value * 1000);

  const tl = createTimeline($("scrub"), deriveT);
  const player = createPlayer($("playPause"), tl, getDur);
  const recorder = createRecorder($("render"), canvas, tl, draw, getDur, getAudioTracks);

  recorder.lock($("playPause"), durInput);
  $("scrub").oninput = () => player.rebase();
  durInput.oninput = () => player.rebase();

  startLoop(player, recorder, draw);

  return { tl, player, recorder, getDur };
}
