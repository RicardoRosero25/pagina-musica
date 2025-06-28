let audioContext = new (window.AudioContext || window.webkitAudioContext)();
let audioBuffer;

document.getElementById('thresholdSlider').addEventListener('input', function () {
    document.getElementById('thresholdValue').textContent = this.value + ' dB';
});

document.getElementById('audioFile').addEventListener('change', function (event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            audioContext.decodeAudioData(e.target.result, function (buffer) {
                audioBuffer = buffer;
                console.log("Audio cargado correctamente.");
            });
        };
        reader.readAsArrayBuffer(file);
    }
});

function applyLimiter() {
    if (!audioBuffer) return alert("Primero carga un archivo de audio.");

    const thresholdDb = parseFloat(document.getElementById('thresholdSlider').value);
    const threshold = Math.pow(10, thresholdDb / 20); 
    const ratio = parseFloat(document.getElementById('ratioSelect').value);

    const limitedBuffer = audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate
    );

    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
        const input = audioBuffer.getChannelData(ch);
        const output = limitedBuffer.getChannelData(ch);

        for (let i = 0; i < input.length; i++) {
            const x = input[i];
            const absX = Math.abs(x);

            if (absX <= threshold) {
                output[i] = x;
            } else {
                output[i] = Math.sign(x) * (threshold + (absX - threshold) / ratio);
            }
        }
    }

    exportBuffer(limitedBuffer);
}

function exportBuffer(buffer) {
    const offlineCtx = new OfflineAudioContext(
        buffer.numberOfChannels,
        buffer.length,
        buffer.sampleRate
    );
    const source = offlineCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(offlineCtx.destination);
    source.start(0);

    offlineCtx.startRendering().then(renderedBuffer => {
        const wav = audioBufferToWav(renderedBuffer);
        const blob = new Blob([wav], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        document.getElementById('audioPlayer').src = url;
    });
}

function audioBufferToWav(buffer) {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const bufferView = new ArrayBuffer(length);
    const view = new DataView(bufferView);

    let offset = 0;

    function writeString(str) {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset++, str.charCodeAt(i));
        }
    }

    function writeInt16(val) {
        view.setInt16(offset, val, true);
        offset += 2;
    }

    writeString('RIFF');
    view.setUint32(offset, length - 8, true); offset += 4;
    writeString('WAVE');
    writeString('fmt ');
    view.setUint32(offset, 16, true); offset += 4;
    view.setUint16(offset, 1, true); offset += 2;
    view.setUint16(offset, numOfChan, true); offset += 2;
    view.setUint32(offset, buffer.sampleRate, true); offset += 4;
    view.setUint32(offset, buffer.sampleRate * numOfChan * 2, true); offset += 4;
    view.setUint16(offset, numOfChan * 2, true); offset += 2;
    view.setUint16(offset, 16, true); offset += 2;
    writeString('data');
    view.setUint32(offset, buffer.length * numOfChan * 2, true); offset += 4;

    for (let i = 0; i < buffer.length; i++) {
        for (let channel = 0; channel < numOfChan; channel++) {
            let sample = buffer.getChannelData(channel)[i];
            sample = Math.max(-1, Math.min(1, sample));
            writeInt16(sample * 0x7FFF);
        }
    }

    return view;
}