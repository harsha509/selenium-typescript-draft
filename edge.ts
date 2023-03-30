import { Browser } from './lib/capabilities';
import * as io from './io';
import * as chromium from './chromium';
import { driverLocation } from './common/seleniumManager';

const EDGEDRIVER_CHROMIUM_EXE = process.platform === 'win32' ? 'msedgedriver.exe' : 'msedgedriver';

class ServiceBuilder extends chromium.ServiceBuilder {
    constructor(optExe?: string) {
        let exe = optExe || locateSynchronously();

        if (!exe) {
            console.log(
                `The WebDriver for Edge could not be found on the current PATH, trying Selenium Manager`
            );

            try {
                exe = driverLocation('edge');
            } catch (err) {
                console.log(`Unable to obtain driver using Selenium Manager: ${err}`);
            }
        }

        if (!exe) {
            throw Error(
                `The WebDriver for Edge could not be found on the current PATH. Please download the latest version of ${EDGEDRIVER_CHROMIUM_EXE} from https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/ and ensure it can be found on your PATH.`
            );
        }

        super(exe);
        this.setLoopback(true);
    }
}

class Options extends chromium.Options {
    setEdgeChromiumBinaryPath(path: string) {
        return this.setBinaryPath(path);
    }
}

class Driver extends chromium.Driver {
    static createSession(optConfig?: Options, optServiceExecutor?: ServiceBuilder) {
        let caps = optConfig || new Options();
        return /** @type {!Driver} */ (super.createSession(caps, optServiceExecutor));
    }

    static getDefaultService() {
        return new ServiceBuilder().build();
    }

    setFileDetector() {}
}

function locateSynchronously() {
    return io.findInPath(EDGEDRIVER_CHROMIUM_EXE, true);
}

Object.defineProperties(Options.prototype, {
    BROWSER_NAME_VALUE: { value: Browser.EDGE },
    CAPABILITY_KEY: { value: 'ms:edgeOptions' }
});

Object.defineProperties(Driver.prototype, {
    VENDOR_CAPABILITY_PREFIX: { value: 'ms' }
});

export { Options, Driver, ServiceBuilder };
