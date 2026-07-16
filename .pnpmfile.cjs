module.exports = {
  hooks: {
    readPackage(pkg) {
      if (pkg.name !== "@earendil-works/pi-ai" || pkg.version !== "0.80.7") return pkg;
      // Google is a lazily loaded provider and is not part of the supported host model set.
      const dependencies = { ...pkg.dependencies };
      delete dependencies["@google/genai"];
      return { ...pkg, dependencies };
    },
  },
};
