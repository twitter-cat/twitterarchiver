import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { FusesPlugin } from "@electron-forge/plugin-fuses";

export default {
	packagerConfig: {
		asar: true,
		icon: "./src/assets/icon",

    executableName: "twitterarchiver",
    name: "TwitterArchiver",
	},
	rebuildConfig: {},
	makers: [
		// === windows ===
		{
			name: "@electron-forge/maker-squirrel",
			config: {
				// iconUrl: "https://url/to/icon.ico",
				setupIcon: "./src/assets/icon.ico",
				authors: "twitter.cat",
				description: "twitter profile archiver",
				name: "twitterarchiver",
				productName: "TwitterArchiver",
			},
		},
		// === macos ===
		{
			name: "@electron-forge/maker-dmg",
			platforms: ["darwin"],
			config: {
				icon: "./src/assets/icon.png",
				name: "twitterarchiver",
				title: "TwitterArchiver",
				background: "./assets/dmg_background.png",
				iconSize: 100,
				contents: (opts) => [
					{ x: 390 + 50, y: 122 + 50, type: "link", path: "/Applications" },
					{ x: 167 + 50, y: 122 + 50, type: "file", path: opts.appPath },
				],
				additionalDMGOptions: {
					title: "Get TwitterArchiver",
					window: {
						width: 658,
						height: 498,
					},
				},
			},
		},
		{
			name: "@electron-forge/maker-zip",
			platforms: ["darwin"],
		},
		// === linux ===
		{
			name: "@electron-forge/maker-deb",
			config: {
				options: {
				name: "twitterarchiver",
					icon: "./src/assets/icon.png",
					executable: "twitterarchiver",
				},
			},
		},
		{
			name: "@electron-forge/maker-rpm",
			config: {
				options: {
					name: "twitterarchiver",
					productName: "TwitterArchiver",
					homepage: "https://twitter.cat",
					icon: "./src/assets/icon.png",
					executable: "twitterarchiver",
				},
			},
		},
	],
	plugins: [
		{
			name: "@electron-forge/plugin-auto-unpack-natives",
			config: {},
		},

		new FusesPlugin({
			version: FuseVersion.V1,
			[FuseV1Options.RunAsNode]: false,
			[FuseV1Options.EnableCookieEncryption]: true,
			[FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
			[FuseV1Options.EnableNodeCliInspectArguments]: false,
			[FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
			[FuseV1Options.OnlyLoadAppFromAsar]: true,
		}),
	],
};
