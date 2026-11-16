// This package ships podspecs for plain-Swift consumption, not a React Native module.
// Opt out of RN CLI / Expo autolinking so consumer apps do not compile the bare `Voidhash`
// SDK: the RN SDK links `VoidhashCore` explicitly through its podspec + config plugin.
module.exports = {
  dependency: {
    platforms: {
      ios: null,
      android: null,
    },
  },
};
