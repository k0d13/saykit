const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const { withSayKit } = require('babel-plugin-saykit/metro');

const config = withSayKit(getDefaultConfig(__dirname));

// Two copies of React break hooks, so force every request to this app's copy
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    return context.resolveRequest(
      { ...context, originModulePath: path.join(__dirname, 'index.ts') },
      moduleName,
      platform,
    );
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
