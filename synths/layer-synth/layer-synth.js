import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import { Scheduler } from '@ircam/sc-scheduling';
import {
  decibelToLinear
} from '@ircam/sc-utils';
// import { AudioBufferLoader } from '@ircam/sc-loader';

export const list = [
  'ambient',
  'ambient-nature-1',
  'ambient-nature-2',
  'duel-elec-1',
  'duel-elec-2',
  'dyn-forest-1',
  'dyn-forest-2',
  'dyn-mer-1',
  'dyn-mer-2',
  'elec-beat-1',
  'elec-beat-2',
  'elec-forest-1',
  'elec-forest-2',
  'elec-marche-1',
  'elec-marche-2',
  'gare-mer-1',
  'gare-mer-2',
  'inst',
  'marche-nature-1',
  'marche-nature-2',
  'memory-elec',
  'memory-forest',
  'memory-nature-night',
  'memory-nature-sea',
  'memory-test',
  'memory-urban-out',
  'memory-urban-subway',
  'nature-foret',
  'nature-foret-simple',
  'nature-mer',
  'nature-nuit',
  'textes',
];

export async function createLayerSynth(audioContext, audioBufferLoader, soundbank) {
  if (!list.includes(soundbank)) {
    throw new Error(`Cannot execute "createLayerSynth": soundbank (${soundbank}) does not exists`);
  }

  const layersPathname = path.join(__dirname, 'soundbanks', soundbank, 'layers');
  const layersList = fs.readdirSync(layersPathname, { recursive: true })
    .filter(item => !(/(^|\/)\.[^\/\.]/g).test(item))
    .map(item => path.join(layersPathname, item))
    .filter(item => fs.statSync(item).isFile());

  const layers = await audioBufferLoader.load(layersList);

  const shortsPathname = path.join(__dirname, 'soundbanks', soundbank, 'shorts');
  const shortsList = fs.readdirSync(shortsPathname, { recursive: true })
    .filter(item => !(/(^|\/)\.[^\/\.]/g).test(item))
    .map(item => path.join(shortsPathname, item))
    .filter(item => fs.statSync(item).isFile());

  const shorts = await audioBufferLoader.load(shortsList);

  const synth = new LayerSynth(audioContext);
  synth.soundbank = { layers, shorts };

  return synth;
}

class LayerSynth {
  constructor(audioContext) {
    this.audioContext = audioContext;
    this.scheduler = new Scheduler(() => audioContext.currentTime);
    this.bpm = 54;
    this.numBeatsBetweenLayers = 12;

    this.minInterLayer = 20;
    this.maxInterLayer = 30;

    this.minLayerDuration = 30;
    this.maxLayerDuration = 40;
    this.layerFadeTime = 10;
    this._soundbank = null;

    this.output = this.audioContext.createGain();

    this.layers = new Set();
    this.lastLayerIndex = null;
    this.lastShortIndex = null;

    this.layerDbRange = 6;

    this.starting = true;
  }

  set soundbank(value) {
    this.lastLayerIndex = null;
    this.lastShortIndex = null;

    this._soundbank = value;
  }

  get soundbank() {
    return this._soundbank;
  }

  connect(destination) {
    this.output.connect(destination);
  }

  disconnect() {
    this.output.disconnect();
  }

  start() {
    this.scheduler.add(this.#process);
    this.starting = true;
  }

  stop() {
    if (this.scheduler.has(this.#process)) {
      this.scheduler.remove(this.#process);
    }
    // stop existing layers
    // @todo - add a fadeout
    this.layers.forEach(layer => layer.src.stop());
    this.layers.clear();
  }

  triggerShort() {
    let index;

    // console.log(`► trigger short`);

    // if only 1 layer, don't go to infinite loop
    if (this._soundbank.shorts.length === 1) {
      index = 0;
    // if several ones, pick a new one
    } else {
      do {
        index = Math.floor(Math.random() * this._soundbank.shorts.length);
      } while (index === this.lastShortIndex);
    }

    this.lastShortIndex = index;

    const buffer = this._soundbank.shorts[index];
    const gain = Math.random() * 0.8 + 0.2;

    const env = this.audioContext.createGain();
    env.connect(this.output);
    env.gain.value = gain;

    const src = this.audioContext.createBufferSource();
    src.connect(env);
    src.buffer = buffer;
    src.start();

    src.addEventListener('ended', () => {
      src.disconnect();
      env.disconnect();
    });
  }

  #process = (time) => {
    try {
      // console.log(`
      //   - minInterLayer: ${this.minInterLayer}
      //   - maxInterLayer: ${this.maxInterLayer}
      //   - minLayerDuration: ${this.minLayerDuration}
      //   - maxLayerDuration: ${this.maxLayerDuration}
      //   - layerFadeTime: ${this.layerFadeTime}
      // `);

      // // define which buffer to play
      let index;

      // always start w/ first layer of the list
      if (this.starting) {
        index = 0;
        this.starting = false;
      // if only 1 layer, don't go to infinite loop
      } else if (this._soundbank.layers.length === 1) {
        index = 0;
      } else {
        // pick random layer
        do {
          index = Math.floor(Math.random() * this._soundbank.layers.length);
        } while (index === this.lastLayerIndex);
      }

      const buffer = this._soundbank.layers[index];
      this.lastLayerIndex = index;

      // build layer
      const src = new AudioBufferSourceNode(this.audioContext, { buffer, loop: true });
      const env = new GainNode(this.audioContext, { gain: 0 });

      const spread = 0.;
      const pan = Math.random() * (spread * 2) - spread;
      const panner = new StereoPannerNode(this.audioContext, { pan });
      panner.connect(this.output);

      src.connect(env).connect(panner).connect(this.output);

      const layer = { src, env, panner };
      this.layers.add(layer);

      const offset = Math.random() * buffer.duration;
      const layerDuration = Math.random() * (this.maxLayerDuration - this.minLayerDuration) + this.minLayerDuration;
      const layerFadeTime = this.layerFadeTime > layerDuration / 2 ?
        layerDuration / 2 : this.layerFadeTime;

      const layerVolume = this.layerDbRange * Math.random() * -1;
      const layerGain = decibelToLinear(layerVolume);

      // fade in
      env.gain
        .setValueAtTime(0, time)
        .linearRampToValueAtTime(layerGain, time + layerFadeTime);
      // fade out
      env.gain
        .setValueAtTime(layerGain, time + layerDuration - layerFadeTime)
        .linearRampToValueAtTime(0, time + layerDuration);

      // clean everything when layers are ended
      src.addEventListener('ended', () => {
        this.layers.delete(layer);
        // console.log(`■ layer ${index} - # active layers ${this.layers.size}`);

        src.disconnect();
        env.disconnect();
        panner.disconnect();
      });

      // console.log(`► layer ${index} - duration: ${layerDuration}s, gain: ${layerGain}, panning: ${panning}`);
      src.start(time, offset, layerDuration);
      // make sure synced synth work
      let nextLayerIn = (60 / this.bpm) * this.numBeatsBetweenLayers;

      // we don't want any silence, worst case is a cross-fade between the 2 layers
      if (nextLayerIn > layerDuration - this.layerFadeTime) {
        nextLayerIn = layerDuration - this.layerFadeTime;
      }

      // console.log(`> trigger next layer in ${nextLayerIn}s`);
      return time + nextLayerIn;
    } catch (err) {
      console.log(err.message);
    }
  }
}
