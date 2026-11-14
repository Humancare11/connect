// Runs on the audio thread (AudioWorklet). Used by src/features/translation/micPipeline.js - keep the name in sync with WORKLET_NAME.
// Collects the 128-frame blocks the browser hands over into chunks of options.processorOptions.chunk samples (default 4096) and posts them.
class HcMicCapture extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.size = (options && options.processorOptions && options.processorOptions.chunk) || 4096;
    this.buf = new Float32Array(this.size);
    this.n = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    let i = 0;
    while (i < ch.length) {
      const take = Math.min(ch.length - i, this.size - this.n);
      this.buf.set(ch.subarray(i, i + take), this.n);
      this.n += take;
      i += take;
      if (this.n === this.size) {
        const out = this.buf;
        this.port.postMessage(out, [out.buffer]);
        this.buf = new Float32Array(this.size);
        this.n = 0;
      }
    }
    return true;
  }
}
registerProcessor("hc-mic-capture", HcMicCapture);
