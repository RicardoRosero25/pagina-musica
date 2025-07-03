// script.js

const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let audioBuffer = null;

// UI elements
const thresholdSlider = document.getElementById('thresholdSlider');
const thresholdValue  = document.getElementById('thresholdValue');
const ratioSelect     = document.getElementById('ratioSelect');
const kneeSlider      = document.getElementById('kneeSlider');
const kneeValue       = document.getElementById('kneeValue');
const applyBtn        = document.getElementById('applyBtn');
const audioPlayer     = document.getElementById('audioPlayer');

// Update labels
thresholdSlider.addEventListener('input', () => {
  thresholdValue.textContent = `${thresholdSlider.value} dB`;
});
kneeSlider.addEventListener('input', () => {
  kneeValue.textContent = `${kneeSlider.value} dB`;
});

// Load and decode audio
document.getElementById('audioFile').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const arrayBuffer = await file.arrayBuffer();
    audioBuffer = await new Promise((res, rej) =>
      audioContext.decodeAudioData(arrayBuffer, res, rej)
    );
    console.log('✅ Audio cargado y decodificado.');
  } catch (err) {
    console.error('❌ Error al decodificar audio:', err);
    alert('No se pudo cargar el audio. Revisa la consola para más detalles.');
  }
});

// Apply limiting with DynamicsCompressorNode
applyBtn.addEventListener('click', async () => {
  if (!audioBuffer) {
    return alert('Primero carga un archivo de audio.');
  }

  const thresholdDb = parseFloat(thresholdSlider.value);
  const ratio       = parseFloat(ratioSelect.value);
  const kneeDb      = parseFloat(kneeSlider.value);
  const attackSec   = 0.003;  // 3 ms
  const releaseSec  = 0.250;  // 250 ms

  const offlineCtx = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );

  const source     = offlineCtx.createBufferSource();
  source.buffer    = audioBuffer;
  const compressor = offlineCtx.createDynamicsCompressor();

  // Set compressor params
  compressor.threshold.value = thresholdDb;
  compressor.ratio.value     = ratio;
  compressor.knee.value      = kneeDb;
  compressor.attack.value    = attackSec;
  compressor.release.value   = releaseSec;

  source.connect(compressor).connect(offlineCtx.destination);
  source.start(0);

  let renderedBuffer;
  try {
    renderedBuffer = await offlineCtx.startRendering();
  } catch (err) {
    console.error('❌ Error al renderizar:', err);
    return alert('Fallo al procesar el audio.');
  }

  const wavData = audioBufferToWav(renderedBuffer);
  const blob    = new Blob([wavData], { type: 'audio/wav' });
  audioPlayer.src = URL.createObjectURL(blob);
});

// Convert AudioBuffer to WAV
function audioBufferToWav(buffer) {
  const numChan = buffer.numberOfChannels;
  const len     = buffer.length * numChan * 2 + 44;
  const bufView = new ArrayBuffer(len);
  const dv      = new DataView(bufView);
  let offset    = 0;

  function writeStr(s) { for (let i = 0; i < s.length; i++) dv.setUint8(offset++, s.charCodeAt(i)); }
  function writeInt16(v) { dv.setInt16(offset, v, true); offset += 2; }

  writeStr('RIFF');
  dv.setUint32(offset, len - 8, true); offset += 4;
  writeStr('WAVEfmt ');
  dv.setUint32(offset, 16, true); offset += 4;
  dv.setUint16(offset, 1, true);  offset += 2;
  dv.setUint16(offset, numChan, true); offset += 2;
  dv.setUint32(offset, buffer.sampleRate, true); offset += 4;
  dv.setUint32(offset, buffer.sampleRate * numChan * 2, true); offset += 4;
  dv.setUint16(offset, numChan * 2, true); offset += 2;
  dv.setUint16(offset, 16, true); offset += 2;
  writeStr('data');
  dv.setUint32(offset, buffer.length * numChan * 2, true); offset += 4;

  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChan; ch++) {
      let s = buffer.getChannelData(ch)[i];
      s     = Math.max(-1, Math.min(1, s));
      writeInt16(s * 0x7FFF);
    }
  }

  return bufView;
}

