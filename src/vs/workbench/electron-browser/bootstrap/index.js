/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Warning: Do not use the `let` declarator in this file, it breaks our minification

'use strict';

/*global window,document,define*/

const perf = require('../../../base/common/performance');
perf.mark('renderer/started');

const path = require('path');
const electron = require('electron');
const remote = electron.remote;
const ipc = electron.ipcRenderer;

process.lazyEnv = new Promise(function (resolve) {
	const handle = setTimeout(function () {
		resolve();
		console.warn('renderer did not receive lazyEnv in time');
	}, 10000);
	ipc.once('vscode:acceptShellEnv', function (event, shellEnv) {
		clearTimeout(handle);
		assign(process.env, shellEnv);
		resolve(process.env);
	});
	ipc.send('vscode:fetchShellEnv', remote.getCurrentWindow().id);
});

function onError(error, enableDeveloperTools) {
	if (enableDeveloperTools) {
		remote.getCurrentWebContents().openDevTools();
	}

	console.error('[uncaught exception]: ' + error);

	if (error.stack) {
		console.error(error.stack);
	}
}

function assign(destination, source) {
	return Object.keys(source)
		.reduce(function (r, key) { r[key] = source[key]; return r; }, destination);
}

function parseURLQueryArgs() {
	const search = window.location.search || '';

	return search.split(/[?&]/)
		.filter(function (param) { return !!param; })
		.map(function (param) { return param.split('='); })
		.filter(function (param) { return param.length === 2; })
		.reduce(function (r, param) { r[param[0]] = decodeURIComponent(param[1]); return r; }, {});
}

// {{SQL CARBON EDIT}}
function createScript(src, onload) {
	const script = document.createElement('script');
	script.src = src;
	script.addEventListener('load', onload);

	const head = document.getElementsByTagName('head')[0];
	head.insertBefore(script, head.lastChild);
}

function uriFromPath(_path) {
	var pathName = path.resolve(_path).replace(/\\/g, '/');
	if (pathName.length > 0 && pathName.charAt(0) !== '/') {
		pathName = '/' + pathName;
	}

	return encodeURI('file://' + pathName);
}

function registerListeners(enableDeveloperTools) {

	// Devtools & reload support
	var listener;
	if (enableDeveloperTools) {
		const extractKey = function (e) {
			return [
				e.ctrlKey ? 'ctrl-' : '',
				e.metaKey ? 'meta-' : '',
				e.altKey ? 'alt-' : '',
				e.shiftKey ? 'shift-' : '',
				e.keyCode
			].join('');
		};

		const TOGGLE_DEV_TOOLS_KB = (process.platform === 'darwin' ? 'meta-alt-73' : 'ctrl-shift-73'); // mac: Cmd-Alt-I, rest: Ctrl-Shift-I
		const RELOAD_KB = (process.platform === 'darwin' ? 'meta-82' : 'ctrl-82'); // mac: Cmd-R, rest: Ctrl-R

		listener = function (e) {
			const key = extractKey(e);
			if (key === TOGGLE_DEV_TOOLS_KB) {
				remote.getCurrentWebContents().toggleDevTools();
			} else if (key === RELOAD_KB) {
				remote.getCurrentWindow().reload();
			}
		};
		window.addEventListener('keydown', listener);
	}

	process.on('uncaughtException', function (error) { onError(error, enableDeveloperTools); });

	return function () {
		if (listener) {
			window.removeEventListener('keydown', listener);
			listener = void 0;
		}
	};
}

// {{SQL CARBON EDIT}}

/* eslint-disable */

// SQL global imports
require('slickgrid/slick.core');
const Slick = window.Slick;
require('slickgrid/slick.grid');
require('slickgrid/slick.editors');;
require('reflect-metadata');
require('zone.js');

const _ = require('underscore')._;

function main() {
	const webFrame = require('electron').webFrame;
	const args = parseURLQueryArgs();
	const configuration = JSON.parse(args['config'] || '{}') || {};

	// Correctly inherit the parent's environment
	assign(process.env, configuration.userEnv);
	perf.importEntries(configuration.perfEntries);

	// Get the nls configuration into the process.env as early as possible.
	var nlsConfig = { availableLanguages: {} };
	const config = process.env['VSCODE_NLS_CONFIG'];
	if (config) {
		process.env['VSCODE_NLS_CONFIG'] = config;
		try {
			nlsConfig = JSON.parse(config);
		} catch (e) { /*noop*/ }
	}

	var locale = nlsConfig.availableLanguages['*'] || 'en';
	if (locale === 'zh-tw') {
		locale = 'zh-Hant';
	} else if (locale === 'zh-cn') {
		locale = 'zh-Hans';
	}

	window.document.documentElement.setAttribute('lang', locale);

	const enableDeveloperTools = (process.env['VSCODE_DEV'] || !!configuration.extensionDevelopmentPath) && !configuration.extensionTestsPath;
	const unbind = registerListeners(enableDeveloperTools);

	// disable pinch zoom & apply zoom level early to avoid glitches
	const zoomLevel = configuration.zoomLevel;
	webFrame.setVisualZoomLevelLimits(1, 1);
	if (typeof zoomLevel === 'number' && zoomLevel !== 0) {
		webFrame.setZoomLevel(zoomLevel);
	}

	  // {{SQL CARBON EDIT}}
	// Load the loader and start loading the workbench
	const appRoot = uriFromPath(configuration.appRoot);
	const rootUrl = appRoot + '/out';

	createScript(appRoot + '/node_modules/chart.js/dist/Chart.js', undefined);

	const loaderFilename = configuration.appRoot + '/out/vs/loader.js';
	const loaderSource = require('fs').readFileSync(loaderFilename);
	require('vm').runInThisContext(loaderSource, { filename: loaderFilename });

	window.nodeRequire = require.__$__nodeRequire;

	define('fs', ['original-fs'], function (originalFS) { return originalFS; }); // replace the patched electron fs with the original node fs for all AMD code

	window.MonacoEnvironment = {};

	const onNodeCachedData = window.MonacoEnvironment.onNodeCachedData = [];

	// {{SQL CARBON EDIT}}
	require.config({
		baseUrl: uriFromPath(configuration.appRoot) + '/out',
		'vs/nls': nlsConfig,
		recordStats: !!configuration.performance,
		nodeCachedDataDir: configuration.nodeCachedDataDir,
		onNodeCachedData: function () { onNodeCachedData.push(arguments); },
		nodeModules: [
			'@angular/common',
			'@angular/core',
			'@angular/forms',
			'@angular/platform-browser',
			'@angular/platform-browser-dynamic',
			'@angular/router',
			'angular2-grid',
			'pretty-data',
			'html-query-plan',
			'ng2-charts/ng2-charts',
			'rxjs/Observable',
			'rxjs/Subject',
			'rxjs/Observer'
		]
	});

	if (nlsConfig.pseudo) {
		require(['vs/nls'], function (nlsPlugin) {
			nlsPlugin.setPseudoTranslation(nlsConfig.pseudo);
		});
	}

	// Perf Counters
	const timers = window.MonacoEnvironment.timers = {
		isInitialStartup: !!configuration.isInitialStartup,
		hasAccessibilitySupport: !!configuration.accessibilitySupport,
		start: configuration.perfStartTime,
		appReady: configuration.perfAppReady,
		windowLoad: configuration.perfWindowLoadTime,
		beforeLoadWorkbenchMain: Date.now()
	};

	const workbenchMainClock = perf.time('loadWorkbenchMain');
	require([
		'vs/workbench/workbench.main',
		'vs/nls!vs/workbench/workbench.main',
		'vs/css!vs/workbench/workbench.main'
	], function () {
		workbenchMainClock.stop();
		timers.afterLoadWorkbenchMain = Date.now();

		process.lazyEnv.then(function () {
			perf.mark('main/startup');
			require('vs/workbench/electron-browser/main')
				.startup(configuration)
				.done(function () {
					unbind(); // since the workbench is running, unbind our developer related listeners and let the workbench handle them
				}, function (error) {
					onError(error, enableDeveloperTools);
				});
		});
	});

}

main();
