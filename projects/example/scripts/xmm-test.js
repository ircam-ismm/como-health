const {
  audioContext,
  audioBufferLoader,
  como,
} = getGlobalScriptingContext();

export async function defineSharedState(como) {
  return {
    classDescription: {
      labels: {
        type: 'any',
        default: [],
      },
      previewLabel: {
        type: 'string',
        // default: '08-clicks.mp3',
        default: null,
        nullable: true,
      },
      recordLabel: {
        type: 'string',
        default: null,
        nullable: true,
      },
      record: {
        type: 'boolean',
        default: false,
      },
    },
    // initValues:  { play: false },
  };
}

let labels = null;
let model = null;
let currentLabel = null; // the label that is currently played
let previewLabel = null; // bypass decoded label to preview some soundfile
let recordExample = null; // array containing the example when record is true
let src = null;

export async function enter(context) {
  const { output, state, soundbank, scriptName } = context;

  labels = Object.keys(soundbank);
  model = await como.modelManager.getModel('test');

  console.log(`> model "${model.state.get('id')}" loaded`, model.state.get('infos'));

  await state.set('labels', labels);
  // lazily create a shared model if it doesn't exists yet

  state.onUpdate(async updates => {
    for (let [key, value] of Object.entries(updates)) {
      switch (key) {
        case 'record': {
          // @todo - ack or refuse example
          if (Array.isArray(recordExample) && value === false) {
            const label = state.get('recordLabel');
            model.addExample(label, recordExample);
            recordExample = null;
          } else {
            recordExample = [];
          }
        }
        break;
      }
    }
  }, true);
}

export async function exit(context) {
  const { output, state, soundbank, scriptName } = context;
  console.log('xmm-test exit()');

  if (src) {
    src.stop();
  }
}

export async function process(context, frame) {
  const { output, state, soundbank, scriptName } = context;
  // console.log('xmm-test process()');
  let label = false;

  // motion stream processsing and packing
  const xmmFrame = [
    frame[0].accelerometer.x,
    frame[0].accelerometer.y,
    frame[0].accelerometer.z,
  ];

  // preview, record & run logic
  const previewLabel = state.get('previewLabel') || null; // force empty string to null (workaround simple gui)

  if (state.get('record')) {
    console.log('record');
    label = state.get('recordLabel');
    recordExample.push(xmmFrame);
  } else {
    const result = model.process(xmmFrame);
    label = result ? result.likeliest : null;
  }
  // if preview is enabled, we still want to possibly record
  if (previewLabel !== null) {
    label = previewLabel;
  }

  // audio synthesis
  if (label !== currentLabel) {
    currentLabel = label;
    console.log('label changed', currentLabel)
    if (src) {
      src.stop();
      src = null;
    }

    if (currentLabel) {
      if (labels.includes(currentLabel)) {
        const buffer = soundbank[currentLabel];
        console.log('play:', currentLabel, buffer);
        src = new AudioBufferSourceNode(audioContext, { buffer, loop: true });
        src.connect(output);
        src.start();
      } else {
        console.log(`Didn't find ${label} in soundbank`);
      }
    }
  }
}
