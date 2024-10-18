function waitForDOMContentLoaded() {
  return new Promise((resolve) => {
    if (
      document.readyState === 'complete' ||
      document.readyState === 'interactive'
    ) {
      resolve();
    } else {
      document.addEventListener('DOMContentLoaded', resolve);
    }
  });
}

await import('../blocky-formats/vendor/commonmark.min.js');
const { markdownToBlocks, blocks2markdown } = await import(
  '../blocky-formats/src/markdown.js'
);
const formatConverters = {
  markdown: {
    toBlocks: markdownToBlocks,
    fromBlocks: blocks2markdown,
  },
};

function populateEditorWithFormattedText(text, format) {
  debugger;
  if (!(format in formatConverters)) {
    throw new Error('Unsupported format');
  }

  const createBlocks = (blocks) =>
    blocks.map((block) =>
      wp.blocks.createBlock(
        block.name,
        block.attributes,
        createBlocks(block.innerBlocks)
      )
    );
  const rawBlocks = formatConverters[format].toBlocks(text);

  window.wp.data
    .dispatch('core/block-editor')
    .resetBlocks(createBlocks(rawBlocks));
}

function pushEditorContentsToParent(format) {
  const blocks = wp.data.select('core/block-editor').getBlocks();
  window.parent.postMessage(
    {
      command: 'playgroundEditorTextChanged',
      format: format,
      text: formatConverters[format].fromBlocks(blocks),
      type: 'relay',
    },
    '*'
  );
}

function pushSaveEvent() {
  window.parent.postMessage(
    {
      command: 'saveOccurred',
      type: 'relay',
    },
    '*'
  );
}

// Accept commands from the parent window
window.addEventListener('message', (event) => {
  if (typeof event.data !== 'object') {
    return;
  }

  const { command, format, text } = event.data;
  lastKnownFormat = format;

  if (command === 'setEditorContent') {
    populateEditorWithFormattedText(text, format);
  } else if (command === 'getEditorContent') {
    const blocks = wp.data.select('core/block-editor').getBlocks();
    window.parent.postMessage(
      {
        command: 'playgroundEditorTextChanged',
        format: format,
        text: formatConverters[format].fromBlocks(blocks),
        type: 'relay',
      },
      '*'
    );
  }
});

// Populate the editor with the initial value
let lastKnownFormat = initialFormat;
waitForDOMContentLoaded().then(() => {
  // @TODO: Don't do timeout.
  //        Instead, populate the editor immediately after it's ready.
  setTimeout(() => {
    console.log('initialValue', initialValue);
    populateEditorWithFormattedText(initialValue, lastKnownFormat);

    const debouncedPushEditorContents = debounce(
      pushEditorContentsToParent,
      600
    );
    let previousBlocks = undefined;
    let subscribeInitialized = false;
    let isSaving = false;
    wp.data.subscribe(() => {
      // if ( isSaving !== wp.data.select('core/editor').isSavingPost() ) {
      //    pushSaveEvent();
      //    return;
      // }

      if (previousBlocks === undefined) {
        previousBlocks = wp.data.select('core/block-editor').getBlocks();
        return;
      }
      const currentBlocks = wp.data.select('core/block-editor').getBlocks();
      if (previousBlocks !== currentBlocks) {
        debouncedPushEditorContents(lastKnownFormat);
        previousBlocks = currentBlocks;
      }
    });
  }, 500);

  // Experiment with sending the updated value back to the parent window
  // when typing. Debounce by 600ms.
  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  }
});
