module.exports = (api) => {
	api.cache(true);
	const plugins = [];
	return {
		plugins,
		presets: [
			[
				"babel-preset-expo",
				{
					native: {
						unstable_transformImportMeta: true,
					},
				},
			],
		],
	};
};
