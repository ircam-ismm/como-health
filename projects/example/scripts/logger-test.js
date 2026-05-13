const {
  audioContext,
  audioBufferLoader,
  como,
} = getGlobalScriptingContext();

import {
  getTime
} from '@ircam/sc-utils';

import { add } from './lib/add.js';

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

let writer;

export async function enter(context) {
  const { output, state, soundbank, scriptName } = context;
  console.log('enter script', scriptName, state.getValues());
  console.log('coucou');
  const buffer = await como.soundbankManager.getBuffer('10-shake.mp3');

  state.onUpdate(updates => {
    if ('play' in updates) {
      const now = audioContext.currentTime;
      const src = new AudioBufferSourceNode(audioContext, { buffer });
      src.connect(output);
      src.start(now);
      src.stop(now + 1);

      throw new Error('test');
    }

    if ('coucou' in updates) {
      const result = add(updates.coucou, 2);
      console.log(result)
    }
  }, true);

  // setTimeout(() => {
  //   throw Error('Pouet');
  // }, 1000);
  writer = await como.logger.createWriter('test.txt');
  setInterval(() => {
    writer.write(`coucou ${Math.random()}`)
  }, 1000);
}

export async function exit(context) {
  const { output, state, soundbank, scriptName } = context;
  console.log('exit script', scriptName, state.getValues());

  await writer.close();
}

export async function process(context, frame) {
  frame.timestamp = getTime();
  writer.write(frame);

  // const { state } = context;
  // console.log('process', frame);
}
