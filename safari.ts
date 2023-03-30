import * as http from './http';
import * as io from './io';
import * as remote from './remote';
import * as webdriver from './lib/webdriver';
import { Browser, Capabilities } from './lib/capabilities';

/**
 * _Synchronously_ attempts to locate the IE driver executable on the current
 * system.
 *
 * @return {string | null} the located executable, or `null`.
 */
function locateSynchronously(): string | null {
    return process.platform === 'darwin'
        ? io.findInPath('safaridriver', true)
        : null;
}

/**
 * @return {string} .
 * @throws {Error}
 */
function findSafariDriver(): string {
    let exe = locateSynchronously();
    if (!exe) {
        throw new Error(
            `The safaridriver executable could not be found on the current PATH.
      Please ensure you are using Safari 10.0 or above.`
        );
    }
    return exe;
}

/**
 * Creates {@link selenium-webdriver/remote.DriverService} instances that manage
 * a [safaridriver] server in a child process.
 *
 * [safaridriver]: https://developer.apple.com/library/prerelease/content/releasenotes/General/WhatsNewInSafari/Articles/Safari_10_0.html#//apple_ref/doc/uid/TP40014305-CH11-DontLinkElementID_28
 */
class ServiceBuilder extends remote.DriverService.Builder {
    /**
     * @param {string=} opt_exe Path to the server executable to use. If omitted,
     *     the builder will attempt to locate the safaridriver on the system PATH.
     */
    constructor(opt_exe: string | undefined = undefined) {
        super(opt_exe || findSafariDriver());
        this.setLoopback(true); // Required.
    }
}

const OPTIONS_CAPABILITY_KEY = 'safari.options';
const TECHNOLOGY_PREVIEW_OPTIONS_KEY = 'technologyPreview';


class Options extends Capabilities {
    /**
     * @param {(Capabilities | Map<string, any> | object)=} other Another set of
     *     capabilities to initialize this instance from.
     */
    constructor(other: Capabilities | Map<string, any> | object = undefined) {
        super(other);

        /** @private {object} */
        this.options_ = this.get(OPTIONS_CAPABILITY_KEY) || {};

        this.set(OPTIONS_CAPABILITY_KEY, this.options_);
        this.setBrowserName(Browser.SAFARI);
    }

    /**
     * Instruct the SafariDriver to use the Safari Technology Preview if true.
     * Otherwise, use the release version of Safari. Defaults to using the release version of Safari.
     *
     * @param {boolean} useTechnologyPreview
     * @return {Options} A self reference.
     */
    set TechnologyPreview(useTechnologyPreview: boolean) {
        this.options_[TECHNOLOGY_PREVIEW_OPTIONS_KEY] = !!useTechnologyPreview;
        return this;
    }
}


function useTechnologyPreview(o: Options | object) {
    if (o instanceof Capabilities) {
        let options = o.get(OPTIONS_CAPABILITY_KEY)
        return !!(options && options[TECHNOLOGY_PREVIEW_OPTIONS_KEY])
    }

    if (o && typeof o === 'object') {
        return !!o[TECHNOLOGY_PREVIEW_OPTIONS_KEY]
    }

    return false
}

const SAFARIDRIVER_TECHNOLOGY_PREVIEW_EXE =
    '/Applications/Safari Technology Preview.app/Contents/MacOS/safaridriver'

class Driver extends webdriver.WebDriver {
    static createSession(options?: Options | Capabilities) {
        let caps = options || new Options()

        let exe: string
        if (useTechnologyPreview(caps.get(OPTIONS_CAPABILITY_KEY))) {
            exe = SAFARIDRIVER_TECHNOLOGY_PREVIEW_EXE
        }

        let service = new ServiceBuilder(exe).build()
        let executor = new http.Executor(
            service.start().then((url) => new http.HttpClient(url))
        )

        return /** @type {!Driver} */ (
            super.createSession(executor, caps, () => service.kill())
        )
    }
}

export { Driver, Options, ServiceBuilder, locateSynchronously }
