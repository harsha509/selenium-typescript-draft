import fs from "node:fs";
import * as http from './http';
import * as io from './io';
import * as portprober from './net/portprober';
import * as remote from './remote';
import * as webdriver from './lib/webdriver';
import { Browser, Capabilities } from './lib/capabilities';
import * as error from './lib/error';
import { driverLocation } from './common/seleniumManager';

const IEDRIVER_EXE = 'IEDriverServer.exe';
const OPTIONS_CAPABILITY_KEY = 'se:ieOptions';
const SCROLL_BEHAVIOUR = {
    BOTTOM: 1,
    TOP: 0,
};


const Level = {
    FATAL: 'FATAL',
    ERROR: 'ERROR',
    WARN: 'WARN',
    INFO: 'INFO',
    DEBUG: 'DEBUG',
    TRACE: 'TRACE',
};

const Key: {
    [key: string]: string;
} = {
    IGNORE_PROTECTED_MODE_SETTINGS: 'ignoreProtectedModeSettings',
    IGNORE_ZOOM_SETTING: 'ignoreZoomSetting',
    INITIAL_BROWSER_URL: 'initialBrowserUrl',
    ENABLE_PERSISTENT_HOVER: 'enablePersistentHover',
    ENABLE_ELEMENT_CACHE_CLEANUP: 'enableElementCacheCleanup',
    ELEMENT_SCROLL_BEHAVIOR: 'elementScrollBehavior',
    REQUIRE_WINDOW_FOCUS: 'requireWindowFocus',
    BROWSER_ATTACH_TIMEOUT: 'browserAttachTimeout',
    FORCE_CREATE_PROCESS: 'ie.forceCreateProcessApi',
    BROWSER_COMMAND_LINE_SWITCHES: 'ie.browserCommandLineSwitches',
    USE_PER_PROCESS_PROXY: 'ie.usePerProcessProxy',
    ENSURE_CLEAN_SESSION: 'ie.ensureCleanSession',
    LOG_FILE: 'logFile',
    LOG_LEVEL: 'logLevel',
    HOST: 'host',
    EXTRACT_PATH: 'extractPath',
    SILENT: 'silent',
    FILE_UPLOAD_DIALOG_TIMEOUT: 'ie.fileUploadDialogTimeout',
    ATTACH_TO_EDGE_CHROMIUM: 'ie.edgechromium',
    EDGE_EXECUTABLE_PATH: 'ie.edgepath',
};

class Options extends Capabilities {
    private options_: any;

    constructor(other: Capabilities | Map<string, any> | object = undefined) {
        super(other);

        this.options_ = this.get(OPTIONS_CAPABILITY_KEY) || {};

        this.set(OPTIONS_CAPABILITY_KEY, this.options_);
        this.setBrowserName(Browser.INTERNET_EXPLORER);
    }

    introduceFlakinessByIgnoringProtectedModeSettings(ignoreSettings: boolean): Options {
        this.options_[Key.IGNORE_PROTECTED_MODE_SETTINGS] = !!ignoreSettings;
        return this;
    }

    ignoreZoomSetting(ignore: boolean): Options {
        this.options_[Key.IGNORE_ZOOM_SETTING] = !!ignore;
        return this;
    }

    initialBrowserUrl(url: string): Options {
        this.options_[Key.INITIAL_BROWSER_URL] = url;
        return this;
    }

    enablePersistentHover(enable: boolean): Options {
        this.options_[Key.ENABLE_PERSISTENT_HOVER] = !!enable;
        return this;
    }

    enableElementCacheCleanup(enable: boolean): Options {
        this.options_[Key.ENABLE_ELEMENT_CACHE_CLEANUP] = !!enable;
        return this;
    }

    requireWindowFocus(require: boolean): Options {
        this.options_[Key.REQUIRE_WINDOW_FOCUS] = !!require;
        return this;
    }

    browserAttachTimeout(timeout: number): Options {
        this.options_[Key.BROWSER_ATTACH_TIMEOUT] = Math.max(timeout, 0);
        return this;
    }

    forceCreateProcessApi(force: boolean): Options{
        this.options_[Key.FORCE_CREATE_PROCESS] = !!force;
        return this;
    }

    addBrowserCommandSwitches(...args: string[]): Options {
        let current = this.options_[Key.BROWSER_COMMAND_LINE_SWITCHES] || [];
        if (typeof current == 'string') current = current.split(' ');
        this.options_[Key.BROWSER_COMMAND_LINE_SWITCHES] = current
            .concat(args)
            .join(' ');
        return this;
    }

    addArguments(...args: string[]): Options {
        let current = this.options_[Key.BROWSER_COMMAND_LINE_SWITCHES] || [];
        if (typeof current == 'string') current = current.split(' ');
        this.options_[Key.BROWSER_COMMAND_LINE_SWITCHES] = current
            .concat(args)
            .join(' ');
        return this;
    }

    usePerProcessProxy(enable: boolean): Options {
        this.options_[Key.USE_PER_PROCESS_PROXY] = !!enable;
        return this;
    }

    ensureCleanSession(cleanSession: boolean): Options {
        this.options_[Key.ENSURE_CLEAN_SESSION] = !!cleanSession;
        return this;
    }

    setLogFile(file: string): Options {
        this.options_[Key.LOG_FILE] = file;
        return this;
    }

    setLogLevel(level: string): Options {
        this.options_[Key.LOG_LEVEL] = level;
        return this;
    }

    setHost(host: string): Options {
        this.options_[Key.HOST] = host;
        return this;
    }

    setExtractPath(path: string): Options {
        this.options_[Key.EXTRACT_PATH] = path;
        return this;
    }

    silent(silent: boolean): Options {
        this.options_[Key.SILENT] = silent;
        return this;
    }

    fileUploadDialogTimeout(timeout: number): Options {
        this.options_[Key.FILE_UPLOAD_DIALOG_TIMEOUT] = Math.max(timeout, 0);
        return this;
    }

    setEdgePath(path: string): this {
        this.options_[Key.EDGE_EXECUTABLE_PATH] = path;
        return this;
    }

    setEdgeChromium(attachEdgeChromium: boolean): Options {
        this.options_[Key.ATTACH_TO_EDGE_CHROMIUM] = !!attachEdgeChromium;
        return this;
    }

    setScrollBehavior(behavior: string): Options {
        if (
            behavior &&
            behavior !== SCROLL_BEHAVIOUR.TOP &&
            behavior !== SCROLL_BEHAVIOUR.BOTTOM
        ) {
            throw new Error(`Element Scroll Behavior out of range.
      It should be either ${SCROLL_BEHAVIOUR.TOP} or ${SCROLL_BEHAVIOUR.BOTTOM}`);
        }
        this.options_[Key.ELEMENT_SCROLL_BEHAVIOR] = behavior;
        return this;
    }

}

function locateSynchronously(): string | null {
    return process.platform === 'win32' ? io.findInPath(IEDRIVER_EXE, true) : null;
}

function createServiceFromCapabilities(capabilities: Map<string, any>): remote.DriverService {
    if (process.platform !== 'win32') {
        throw new Error(
            `The IEDriver may only be used on Windows, but you appear to be on ${process.platform}. Did you mean to run against a remote WebDriver server?`
        );
    }

    let exe = locateSynchronously();
    if (!exe) {
        console.log(
            `The ${IEDRIVER_EXE} executable could not be found on the current PATH, trying Selenium Manager`
        );

        try {
            exe = driverLocation('iexplorer');
        } catch (err) {
            console.log(`Unable to obtain driver using Selenium Manager: ${err}`);
        }
    }

    if (!exe || !fs.existsSync(exe)) {
        throw new Error(
            `${IEDRIVER_EXE} could not be found on the current PATH. Please download the latest version of ${IEDRIVER_EXE} from https://www.selenium.dev/downloads/ and ensure it can be found on your system PATH.`
        );
    }

    let args: string[] = [];
    if (capabilities.has(Key.HOST)) {
        args.push(`--host=${capabilities.get(Key.HOST)}`);
    }
    if (capabilities.has(Key.LOG_FILE)) {
        args.push(`--log-file=${capabilities.get(Key.LOG_FILE)}`);
    }
    if (capabilities.has(Key.LOG_LEVEL)) {
        args.push(`--log-level=${capabilities.get(Key.LOG_LEVEL)}`);
    }
    if (capabilities.has(Key.EXTRACT_PATH)) {
        args.push(`--extract-path=${capabilities.get(Key.EXTRACT_PATH)}`);
    }
    if (capabilities.get(Key.SILENT)) {
        args.push('--silent');
    }

    let port = portprober.findFreePort();
    return new remote.DriverService(exe, {
        loopback: true,
        port: port,
        args: port.then(port => args.concat(`--port=${port}`)),
        stdio: 'ignore',
    });
}

class ServiceBuilder extends remote.DriverService.Builder {
    /**
     * @param {string=} opt_exe Path to the server executable to use. If omitted,
     *     the builder will attempt to locate the IEDriverServer on the system PATH.
     */
    constructor(opt_exe?: string) {
        super(opt_exe || IEDRIVER_EXE);
        this.setLoopback(true); // Required.
    }
}

class Driver extends webdriver.WebDriver {
    /**
     * Creates a new session for Microsoft's Internet Explorer.
     *
     * @param {(Capabilities|Options)=} options The configuration options.
     * @param {(remote.DriverService)=} opt_service The `DriverService` to use
     *   to start the IEDriverServer in a child process, optionally.
     * @return {!Driver} A new driver instance.
     */
    static createSession(options?: Capabilities | Options, opt_service?: remote.DriverService): Driver {
        options = options || new Options();

        let service: remote.DriverService;

        if (opt_service instanceof remote.DriverService) {
            service = opt_service;
        } else {
            service = createServiceFromCapabilities(options);
        }

        let client = service.start().then((url) => new http.HttpClient(url));
        let executor = new http.Executor(client);

        return super.createSession(executor, options, () => service.kill()) as Driver;
    }

    /**
     * This function is a no-op as file detectors are not supported by this
     * implementation.
     * @override
     */
    setFileDetector(): void {}
}

export { Driver, Options, Level, ServiceBuilder, Key, SCROLL_BEHAVIOUR as Behavior, locateSynchronously };
