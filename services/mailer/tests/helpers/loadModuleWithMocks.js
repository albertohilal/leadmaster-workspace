const path = require('path');

function normalizeExports(exportsValue) {
  return exportsValue === undefined ? {} : exportsValue;
}

function loadModuleWithMocks(modulePath, mocks) {
  const resolvedModulePath = require.resolve(modulePath);
  const previousEntries = new Map();
  const mockEntries = [];

  for (const [targetPath, exportsValue] of Object.entries(mocks || {})) {
    const resolvedTarget = require.resolve(targetPath);
    previousEntries.set(resolvedTarget, require.cache[resolvedTarget]);
    require.cache[resolvedTarget] = {
      id: resolvedTarget,
      filename: resolvedTarget,
      loaded: true,
      exports: normalizeExports(exportsValue),
      path: path.dirname(resolvedTarget)
    };
    mockEntries.push(resolvedTarget);
  }

  const previousModuleEntry = require.cache[resolvedModulePath];
  delete require.cache[resolvedModulePath];

  try {
    return require(resolvedModulePath);
  } finally {
    delete require.cache[resolvedModulePath];

    if (previousModuleEntry) {
      require.cache[resolvedModulePath] = previousModuleEntry;
    }

    for (const resolvedTarget of mockEntries) {
      const previousEntry = previousEntries.get(resolvedTarget);
      if (previousEntry) {
        require.cache[resolvedTarget] = previousEntry;
      } else {
        delete require.cache[resolvedTarget];
      }
    }
  }
}

module.exports = {
  loadModuleWithMocks
};