import { createLayerSynth, list } from '../../../synths/layer-synth/layer-synth.js';

const {
  audioContext,
  audioBufferLoader,
} = getGlobalScriptingContext();

export async function defineSharedState(como) {
  return {
    classDescription: {
      play: {
        type: 'boolean',
        event: true,
      },
      energy: {
        type: 'float',
        default: 0.5,
      },
      coucou: {
        type: 'float',
        default: 0.5,
      },
    },
    // initValues:  { play: false },
  };
}

const synth = await createLayerSynth(audioContext, audioBufferLoader, 'dn-forest-1');

export async function enter(context) {
  const { output, state, soundbank, scriptName } = context;
  console.log('enter script', scriptName, output, state.getValues());

  // console.log(synth);
  synth.connect(audioContext.destination);
  try {
    synth.start();
  } catch (err) {
    console.log(err.message);
  }
  // const buffer = await como.soundbankManager.getBuffer('10-shake.mp3');
}

export async function exit(context) {
  // const { output, state, soundbank, scriptName } = context;
  // console.log('exit script', scriptName, state.getValues());
  synth.stop();
}

export async function process(context, frame) {
  // const { state } = context;
  // console.log('process', frame);
}
