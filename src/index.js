import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	app,
	BrowserWindow,
	ipcMain,
	Menu,
	nativeImage,
	session,nativeTheme
} from "electron";
import keytar from "keytar";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let authWindow, guestToken, mainWindow;

(async () => {
	const { guest_token } = await (
		await fetch("https://api.twitter.com/1.1/guest/activate.json", {
			headers: {
				accept: "*/*",
				"accept-language": "en-US,en;q=0.9",
				authorization:
					"Bearer AAAAAAAAAAAAAAAAAAAAAOLv4AAAAAAAQubRLkVexZO02uKUva6eI9ZHmMY%3D3jfkYEj27hoTzTlXvxRiMg0wSb285GH9h2WfCvEeOh53QyxA5j",
				priority: "u=1, i",
				"sec-ch-ua": '"Chromium";v="143", "Not A(Brand";v="24"',
				"sec-ch-ua-mobile": "?0",
				"sec-ch-ua-platform": '"macOS"',
				"sec-fetch-dest": "empty",
				"sec-fetch-mode": "cors",
				"sec-fetch-site": "same-site",
				"sec-gpc": "1",
				"x-csrf-token":
					"f16b9ac6913a17f9bef5a4bdce9ae376ceb03e9d741c988c10729b8a35b73acc13ac2f41b92d9439527a4a8d767859a5f757c312ea9906a6ef40787f5179cafbc94eaa689fa3ab55a506013ac966b736",
			},
			method: "POST",
		})
	).json();

	guestToken = guest_token;
})();

const createWindow = () => {
	mainWindow = new BrowserWindow({
		width: 400,
		height: 640,
		resizable: false,
		show: false,
		autoHideMenuBar: true,
		...(process.platform === "darwin" ? { titleBarStyle: "hidden", trafficLightPosition: { x: 16, y: 16 } } : {}),
		icon: path.join(import.meta.dirname, "src/assets/icon.png"),
		backgroundColor: "#15171a",
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
			contextIsolation: true,
			nodeIntegration: false,
			webviewTag: true,
		},
	});

	const template = [
		{
			label: "File",
			submenu: [{ role: "quit" }],
		},
		{
			label: "Edit",
			submenu: [{ role: "cut" }, { role: "copy" }, { role: "paste" }],
		},
	];

	const menu = Menu.buildFromTemplate(template);
	Menu.setApplicationMenu(menu);

	mainWindow.loadFile(path.join(__dirname, "index.html"));
	mainWindow.once("ready-to-show", () => {
		mainWindow.show();
	});

	app.dock.setIcon(nativeImage.createFromPath("src/assets/dockIcon.png"));
};

ipcMain.on("from-renderer", async (evt, data) => {
	if (data === "request-auth") {
		try {
			const auth = await keytar.getPassword(
				"twittercat-archiver",
				"auth-cookies",
			);
			if (!auth) return;

			evt.sender.send("from-main", { type: "auth-cookies", data: auth });
		} catch {}
	}

	if (data.startsWith("query:")) {
		if (!guestToken) {
			await new Promise((r) => {
				const i = setInterval(() => {
					if (guestToken) {
						clearInterval(i);
						r();
					}
				}, 50);
			});
		}

		const query = decodeURIComponent(data.replace("query:", ""));

		evt.sender.send("from-main", {
			type: "search-results",
			data: JSON.stringify({
				query,

				res: await (
					await fetch(
						`https://api.twitter.com/1.1/users/search.json?q=${encodeURIComponent(query)}`,
						{
							headers: {
								authorization:
									"Bearer AAAAAAAAAAAAAAAAAAAAAOLv4AAAAAAAQubRLkVexZO02uKUva6eI9ZHmMY%3D3jfkYEj27hoTzTlXvxRiMg0wSb285GH9h2WfCvEeOh53QyxA5j",
								priority: "u=1, i",
								"user-agent":
									"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
								"x-csrf-token": "631158103118564b5907c9507d47186f",
								"x-guest-token": guestToken,
							},
						},
					)
				).json(),
			}),
		});
	}

	if (data === "logout") {
		await keytar.deletePassword("twittercat-archiver", "auth-cookies");
		await keytar.deletePassword("twittercat-archiver", "user-agent");
	}

	if (data.startsWith("start-archiving:")) {
		const username = data.replace("start-archiving:", "");

		try {
			const authCookiesStr = await keytar.getPassword(
				"twittercat-archiver",
				"auth-cookies",
			);

			if (!authCookiesStr) {
				evt.sender.send("from-main", {
					type: "archive-error",
					data: "Not authenticated",
				});
				return;
			}

			const cookies = JSON.parse(authCookiesStr);

			let userAgent = await keytar.getPassword(
				"twittercat-archiver",
				"user-agent",
			);
			if (!userAgent) {
				userAgent =
					"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36";
			}

			const webviewSession = session.fromPartition("persist:twitter");

			await webviewSession.clearStorageData({ storages: ["cookies"] });

			for (const cookie of cookies) {
				try {
					const domain = cookie.domain.startsWith(".")
						? cookie.domain.slice(1)
						: cookie.domain;
					await webviewSession.cookies.set({
						url: `https://${domain}${cookie.path}`,
						name: cookie.name,
						value: cookie.value,
						domain: cookie.domain,
						path: cookie.path,
						secure: cookie.secure,
						httpOnly: cookie.httpOnly,
						expirationDate: cookie.expirationDate,
					});
				} catch (err) {
					console.log("cookie error:", cookie.name, err.message);
				}
			}

			evt.sender.send("from-main", {
				type: "start-archive-webview",
				data: JSON.stringify({
					username,
					userAgent,
				}),
			});
		} catch (err) {
			console.error("Error starting archive:", err);
			evt.sender.send("from-main", {
				type: "archive-error",
				data: err.message,
			});
		}
	}

	if (data === "expand-window") {
		if (mainWindow) {
			const [width, height] = mainWindow.getSize();
			mainWindow.setSize(width + 600, height, false);
		}
	}

	if (data === "shrink-window") {
		if (mainWindow) {
			mainWindow.setSize(400, 640, false);
		}
	}

	if (data.startsWith("start-auth:") && !authWindow) {
		const browserData = JSON.parse(
			decodeURIComponent(data.replace("start-auth:", "")),
		);

		function buildUA(h) {
			if (h.platform === "macOS") {
				return `Mozilla/5.0 (Macintosh; Intel Mac OS X ${h.platformVersion.replaceAll(".", "_")}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${h.uaFullVersion} Safari/537.36`;
			}

			if (h.platform === "Windows") {
				return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${h.uaFullVersion} Safari/537.36`;
			}

			if (h.platform === "Linux") {
				return `Mozilla/5.0 (X11; Linux ${h.architecture}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${h.uaFullVersion} Safari/537.36`;
			}

			throw new Error("unsupported platform");
		}

		const userAgent = buildUA(browserData);

		authWindow = new BrowserWindow({
			width: 600,
			height: 800,
			autoHideMenuBar: true,
			backgroundColor: nativeTheme.shouldUseDarkColors ? "#000" : "fff",
			webPreferences: {
				preload: path.join(__dirname, "preload.js"),
				contextIsolation: true,
				nodeIntegration: false,
				webviewTag: true,
			},
		});

		authWindow.webContents.setUserAgent(userAgent);

		authWindow.loadURL("https://x.com/i/flow/login");

		authWindow.on("closed", () => {
			authWindow = null;
		});

		authWindow.webContents.on("will-navigate", async (_, url) => {
			if (url.endsWith("/home")) {
				const cookies = await authWindow.webContents.session.cookies.get({});
				await keytar.setPassword(
					"twittercat-archiver",
					"auth-cookies",
					JSON.stringify(cookies),
				);
				await keytar.setPassword(
					"twittercat-archiver",
					"user-agent",
					userAgent,
				);

				authWindow.close();
			}
		});
	}
});

app.setName("TwitterArchiver");
app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
	app.quit();
});

try {
	app.dock.setIcon(nativeImage.createFromPath("src/assets/dockIcon.png"));
} catch {}
