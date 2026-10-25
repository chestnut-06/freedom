(() => {
  const config = window.FREEDOM;
  const $ = id => document.getElementById(id);
  const intro = $('intro'), gallery = $('gallery'), soundButton = $('sound-button');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let entering = false, run = 0, context, gain, source, bufferPromise, playing = false, muted = false;
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  let audioDataPromise;
  function loadAudioData() {
    if (!audioDataPromise) {
      audioDataPromise = fetch(config.audio)
        .then(response => { if (!response.ok) throw Error('Audio unavailable'); return response.arrayBuffer(); })
        .catch(error => { audioDataPromise = null; throw error; });
    }
    return audioDataPromise;
  }
  // Download during the introduction; playback still requires the opening click.
  if (config.audio) loadAudioData().catch(() => {});
  if (config.artwork) {
    $('artwork').onload = () => { $('artwork').hidden = false; $('placeholder').hidden = true; };
    $('artwork').onerror = () => { $('placeholder').querySelector('p').textContent = 'The artwork could not load. Please try again.'; };
    $('artwork').src = config.artwork;
    document.querySelector('.backdrop').style.backgroundImage = `url(${JSON.stringify(config.artwork)})`;
  }
  gallery.style.setProperty('--art-background-opacity', config.backgroundOpacity);
  if (config.audioCredit) { $('audio-credit').textContent = config.audioCredit; $('audio-credit').hidden = false; }
  if (config.audio) {
    $('sound-status').textContent = 'Sound begins after the opening';
    soundButton.disabled = true;
  }
  function prepareAudio() {
    if (!config.audio) return Promise.resolve();
    try {
      if (!context) {
        context = new (window.AudioContext || window.webkitAudioContext)();
        gain = context.createGain(); gain.gain.value = 0; gain.connect(context.destination);
      }
      // Resume within the opening click to unlock sound before the delayed start.
      const resume = context.resume();
      if (!bufferPromise) bufferPromise = loadAudioData()
        .then(data => context.decodeAudioData(data.slice(0)));
      return Promise.all([resume, bufferPromise]);
    } catch (error) { return Promise.reject(error); }
  }
  async function playSound(token) {
    try {
      const result = await prepareAudio();
      if (token !== run || !config.audio) return;
      if (context.state !== 'running') throw Error('Playback requires a click');
      if (source) { source.onended = null; source.stop(); }
      source = context.createBufferSource(); source.buffer = result[1]; source.connect(gain);
      source.onended = () => { if (token === run) { playing = false; soundButton.textContent = 'Play again'; $('sound-status').textContent = 'Soundtrack ended'; } };
      gain.gain.setValueAtTime(0, context.currentTime);
      gain.gain.linearRampToValueAtTime(muted ? 0 : .8, context.currentTime + .6);
      gallery.classList.add('active');
      gallery.dataset.titleRevealedAt = String(performance.now());
      source.start(); playing = true;
      soundButton.disabled = false;
      gallery.dataset.soundStartedAt = String(performance.now());
      soundButton.textContent = muted ? 'Unmute' : 'Mute';
      $('sound-status').textContent = 'Soundtrack playing';
      // Tie the reveal to actual playback, including a successful manual retry.
      await delay(config.artworkDelayAfterSoundMs);
      if (token === run) {
        gallery.classList.add('art-visible');
        gallery.dataset.artworkRevealedAt = String(performance.now());
      }
    } catch (_) {
      if (token !== run) return;
      bufferPromise = null;
      $('sound-status').textContent = 'Select Play sound to start or retry';
      soundButton.textContent = 'Play sound'; soundButton.disabled = false;
      // Keep the artwork accessible if sound is unavailable or blocked.
      gallery.classList.add('active', 'art-visible');
    }
  }
  $('enter').addEventListener('click', async () => {
    if (entering) return;
    entering = true; const token = ++run;
    prepareAudio().catch(() => {});
    intro.classList.add('leaving');
    await delay(reduced ? 100 : config.introFadeMs);
    if (token !== run) return;
    intro.hidden = true; gallery.hidden = false;
    gallery.dataset.enteredAt = String(performance.now());
    gallery.focus({preventScroll:true});
    if (config.audio) $('sound-status').textContent = 'Sound begins in a moment';
    if (token === run && config.audio) playSound(token);
    else if (token === run) {
      gallery.classList.add('active');
      await delay(config.artworkDelayAfterSoundMs);
      if (token === run) gallery.classList.add('art-visible');
    }
  });
  soundButton.addEventListener('click', () => {
    if (!playing) { playSound(run); return; }
    muted = !muted;
    gain.gain.setTargetAtTime(muted ? 0 : .8, context.currentTime, .15);
    soundButton.textContent = muted ? 'Unmute' : 'Mute';
    $('sound-status').textContent = muted ? 'Sound muted' : 'Soundtrack playing';
  });
  $('restart').addEventListener('click', async () => {
    ++run; entering = false;
    if (source) { source.onended = null; source.stop(); source = null; }
    playing = false; muted = false;
    soundButton.disabled = true;
    soundButton.textContent = 'Play sound';
    $('sound-status').textContent = config.audio ? 'Sound begins after the opening' : 'Soundtrack not yet added';
    setReading(false, false);
    gallery.classList.remove('active','art-visible'); gallery.hidden = true;
    intro.hidden = false; intro.classList.remove('leaving'); $('enter').focus();
  });
  if (!document.fullscreenEnabled) $('fullscreen').hidden = true;
  $('fullscreen').addEventListener('click', async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('cinema').requestFullscreen(); }
    catch (_) { $('fullscreen').textContent = 'Full screen unavailable'; }
  });
  document.addEventListener('fullscreenchange', () => { $('fullscreen').textContent = document.fullscreenElement ? 'Exit full screen' : 'Full screen'; });
  function setReading(open, restoreFocus = true) {
    gallery.classList.toggle('reading', open);
    $('about-button').setAttribute('aria-expanded', String(open));
    $('about').setAttribute('aria-hidden', String(!open));
    $('about').inert = !open;
    if (open) {
      $('about').scrollTop = 0;
      $('about-close').focus({preventScroll:true});
    } else if (restoreFocus) {
      $('about-button').focus({preventScroll:true});
    }
  }
  $('about-button').addEventListener('click', () => setReading(true));
  $('about-close').addEventListener('click', () => setReading(false));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && gallery.classList.contains('reading')) setReading(false);
  });
})();
