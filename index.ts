
import * as _http from "./http";
import * as by from "./lib/by";
import * as capabilities from "./lib/capabilities";
import * as chrome from "./chrome";
import * as edge from "./edge";
import * as error from "./lib/error";
import * as firefox from "./firefox";
import * as ie from "./ie";
import * as input from "./lib/input";
import * as logging from "./lib/logging";
import * as promise from "./lib/promise";
import * as remote from "./remote";
import * as safari from "./safari";
import * as session from "./lib/session";
import * as until from "./lib/until";
import * as webdriver from "./lib/webdriver";
import * as select from "./lib/select";
import { LogInspector } from "./bidi/logInspector";
import { BrowsingContext } from "./bidi/browsingContext";

import { Browser, Capabilities, Capability, WebDriver } from "./lib/capabilities";

let seleniumServer: { start: () => any }

function startSeleniumServer(jar: string): Promise<void> {
    let seleniumServer;
    if (!seleniumServer) {
        seleniumServer = new remote.SeleniumServer(jar);
    }
    return seleniumServer.start();
}

function ensureFileDetectorsAreEnabled(ctor: any) {
    return class extends ctor {
        /** @param {input.FileDetector} detector */
        setFileDetector(detector: any) {
            webdriver.WebDriver.prototype.setFileDetector.call(this, detector)
        }
    }
}

class ThenableWebDriver {
    static createSession(...args: any[]) {}
}

const THENABLE_DRIVERS = new Map();

function createDriver(ctor: any, ...args: any[]) {
    let thenableWebDriverProxy = THENABLE_DRIVERS.get(ctor)
    if (!thenableWebDriverProxy) {
        thenableWebDriverProxy = class extends ctor {

            constructor(session: any, ...rest: any[]) {
                super(session, ...rest)

                const pd = this.getSession().then((session: any) => {
                    return new ctor(session, ...rest)
                })

                /** @override */
                this.then = pd.then.bind(pd)

                /** @override */
                this.catch = pd.catch.bind(pd)
            }
        }
        THENABLE_DRIVERS.set(ctor, thenableWebDriverProxy)
    }
    return thenableWebDriverProxy.createSession(...args)
}

function checkOptions(caps: { get: (arg0: any) => any }, key: any, optionType: any, setMethod: any) {
    let val = caps.get(key)
    if (val instanceof optionType) {
        throw new error.InvalidArgumentError(
            'Options class extends Capabilities and should not be set as key ' +
            `"${key}"; set browser-specific options with ` +
            `Builder.${setMethod}(). For more information, see the ` +
            'documentation attached to the function that threw this error'
        )
    }
}

class Builder {
    private log_: Logger;
    private url_: string;
    private proxy_: string | null;
    private capabilities_: Capabilities;
    private chromeOptions_: chrome.Options | null;
    private chromeService_: chrome.ServiceBuilder | null;
    private firefoxOptions_: firefox.Options | null;
    private firefoxService_: firefox.ServiceBuilder | null;
    private ieOptions_: ie.Options | null;
    private ieService_: ie.ServiceBuilder | null;
    private safariOptions_: safari.Options | null;
    private edgeOptions_: edge.Options | null;
    private edgeService_: remote.DriverService.Builder | null;
    private ignoreEnv_: boolean;
    private agent_: http.Agent | null;

    constructor() {
        this.log_ = logging.getLogger('webdriver.Builder');
        this.url_ = '';
        this.proxy_ = null;
        this.capabilities_ = new Capabilities();
        this.chromeOptions_ = null;
        this.chromeService_ = null;
        this.firefoxOptions_ = null;
        this.firefoxService_ = null;
        this.ieOptions_ = null;
        this.ieService_ = null;
        this.safariOptions_ = null;
        this.edgeOptions_ = null;
        this.edgeService_ = null;
        this.ignoreEnv_ = false;
        this.agent_ = null;
    }

    disableEnvironmentOverrides(): Builder {
        this.ignoreEnv_ = true;
        return this;
    }

    usingServer(url: string): Builder {
        this.url_ = url;
        return this;
    }

    getServerUrl(): string {
        return this.url_;
    }

    usingWebDriverProxy(proxy: string): Builder {
        this.proxy_ = proxy;
        return this;
    }

    getWebDriverProxy(): string | null {
        return this.proxy_;
    }

    usingHttpAgent(agent: http.Agent): Builder {
        this.agent_ = agent;
        return this;
    }

    getHttpAgent(): http.Agent | null {
        return this.agent_;
    }


    withCapabilities(capabilities: Capabilities): Builder {
        this.capabilities_ = new Capabilities(capabilities);
        return this;
    }

    getCapabilities(): Capabilities {
        return this.capabilities_;
    }

    setCapability(key: string, value: any): Builder {
        this.capabilities_.set(key, value);
        return this;
    }

    forBrowser(name: string, opt_version?: string, opt_platform?: string): Builder {
        this.capabilities_.setBrowserName(name);
        if (opt_version) {
            this.capabilities_.setBrowserVersion(opt_version);
        }
        if (opt_platform) {
            this.capabilities_.setPlatform(opt_platform);
        }
        return this;
    }

    setProxy(config: any): Builder {
        this.capabilities_.setProxy(config);
        return this;
    }

    setLoggingPrefs(prefs: any): Builder {
        this.capabilities_.setLoggingPrefs(prefs);
        return this;
    }

    setAlertBehavior(behavior: string): Builder {
        this.capabilities_.setAlertBehavior(behavior);
        return this;
    }

    setChromeOptions(options: chrome.Options): Builder {
        this.chromeOptions_ = options;
        return this;
    }

    getChromeOptions(): chrome.Options | null {
        return this.chromeOptions_;
    }

    setChromeService(service: chrome.ServiceBuilder): Builder {
        if (service && !(service instanceof chrome.ServiceBuilder)) {
            throw new TypeError('not a chrome.ServiceBuilder object');
        }
        this.chromeService_ = service;
        return this;
    }

    setFirefoxOptions(options: any): this {
        this.firefoxOptions_ = options;
        return this;
    }

    getFirefoxOptions(): any {
        return this.firefoxOptions_;
    }

    setFirefoxService(service: any): this {
        if (service && !(service instanceof firefox.ServiceBuilder)) {
            throw new TypeError('not a firefox.ServiceBuilder object');
        }
        this.firefoxService_ = service;
        return this;
    }

    setIeOptions(options: any): this {
        this.ieOptions_ = options;
        return this;
    }

    setIeService(service: any): this {
        this.ieService_ = service;
        return this;
    }

    setEdgeOptions(options: any): this {
        this.edgeOptions_ = options;
        return this;
    }

    setEdgeService(service: any): this {
        if (service && !(service instanceof edge.ServiceBuilder)) {
            throw new TypeError('not a edge.ServiceBuilder object');
        }
        this.edgeService_ = service;
        return this;
    }

    getSafariOptions(): any {
        return this.safariOptions_;
    }

    setSafariOptions(options: any): this {
        this.safariOptions_ = options;
        return this;
    }

    build(): any {
        // Create a copy for any changes we may need to make based on the current
        // environment.
        const capabilities = new Capabilities(this.capabilities_)

        let browser
        if (!this.ignoreEnv_ && process.env.SELENIUM_BROWSER) {
            this.log_.fine(`SELENIUM_BROWSER=${process.env.SELENIUM_BROWSER}`)
            browser = process.env.SELENIUM_BROWSER.split(/:/, 3)
            capabilities.setBrowserName(browser[0])

            browser[1] && capabilities.setBrowserVersion(browser[1])
            browser[2] && capabilities.setPlatform(browser[2])
        }

        browser = capabilities.get(Capability.BROWSER_NAME)

        if (typeof browser !== 'string') {
            throw TypeError(
                `Target browser must be a string, but is <${typeof browser}>;` +
                ' did you forget to call forBrowser()?'
            )
        }

        if (browser === 'ie') {
            browser = Browser.INTERNET_EXPLORER
        }

        // Apply browser specific overrides.
        if (browser === Browser.CHROME && this.chromeOptions_) {
            capabilities.merge(this.chromeOptions_)
        } else if (browser === Browser.FIREFOX && this.firefoxOptions_) {
            capabilities.merge(this.firefoxOptions_)
        } else if (browser === Browser.INTERNET_EXPLORER && this.ieOptions_) {
            capabilities.merge(this.ieOptions_)
        } else if (browser === Browser.SAFARI && this.safariOptions_) {
            capabilities.merge(this.safariOptions_)
        } else if (browser === Browser.EDGE && this.edgeOptions_) {
            capabilities.merge(this.edgeOptions_)
        }

        checkOptions(
            capabilities,
            'chromeOptions',
            chrome.Options,
            'setChromeOptions'
        )
        checkOptions(
            capabilities,
            'moz:firefoxOptions',
            firefox.Options,
            'setFirefoxOptions'
        )
        checkOptions(
            capabilities,
            'safari.options',
            safari.Options,
            'setSafariOptions'
        )

        // Check for a remote browser.
        let url = this.url_
        if (!this.ignoreEnv_) {
            if (process.env.SELENIUM_REMOTE_URL) {
                this.log_.fine(`SELENIUM_REMOTE_URL=${process.env.SELENIUM_REMOTE_URL}`)
                url = process.env.SELENIUM_REMOTE_URL
            } else if (process.env.SELENIUM_SERVER_JAR) {
                this.log_.fine(`SELENIUM_SERVER_JAR=${process.env.SELENIUM_SERVER_JAR}`)
                url = startSeleniumServer(process.env.SELENIUM_SERVER_JAR)
            }
        }

        if (url) {
            this.log_.fine('Creating session on remote server')
            let client = Promise.resolve(url).then(
                (url) => new _http.HttpClient(url, this.agent_, this.proxy_)
            )
            let executor = new _http.Executor(client)

            if (browser === Browser.CHROME) {
                const driver = ensureFileDetectorsAreEnabled(chrome.Driver)
                return createDriver(driver, capabilities, executor)
            }

            if (browser === Browser.FIREFOX) {
                const driver = ensureFileDetectorsAreEnabled(firefox.Driver)
                return createDriver(driver, capabilities, executor)
            }
            return createDriver(WebDriver, executor, capabilities)
        }

        // Check for a native browser.
        switch (browser) {
            case Browser.CHROME: {
                let service = null
                if (this.chromeService_) {
                    service = this.chromeService_.build()
                }
                return createDriver(chrome.Driver, capabilities, service)
            }

            case Browser.FIREFOX: {
                let service = null
                if (this.firefoxService_) {
                    service = this.firefoxService_.build()
                }
                return createDriver(firefox.Driver, capabilities, service)
            }

            case Browser.INTERNET_EXPLORER: {
                let service = null
                if (this.ieService_) {
                    service = this.ieService_.build()
                }
                return createDriver(ie.Driver, capabilities, service)
            }

            case Browser.EDGE: {
                let service = null
                if (this.edgeService_) {
                    service = this.edgeService_.build()
                }
                return createDriver(edge.Driver, capabilities, service)
            }

            case Browser.SAFARI:
                return createDriver(safari.Driver, capabilities)

            default:
                throw new Error(
                    'Do not know how to build driver: ' +
                    browser +
                    '; did you forget to call usingServer(url)?'
                )
        }
    }
}

export const Browser = capabilities.Browser;
export const Builder = Builder;
export const Button = input.Button;
export const By = by.By;
export const RelativeBy = by.RelativeBy;
export const withTagName = by.withTagName;
export const locateWith = by.locateWith;
export const Capabilities = capabilities.Capabilities;
export const Capability = capabilities.Capability;
export const Condition = webdriver.Condition;
export const FileDetector = input.FileDetector;
export const Key = input.Key;
export const Origin = input.Origin;
export const Session = session.Session;
export const ThenableWebDriver = ThenableWebDriver;
export const WebDriver = webdriver.WebDriver;
export const WebElement = webdriver.WebElement;
export const WebElementCondition = webdriver.WebElementCondition;
export const WebElementPromise = webdriver.WebElementPromise;
export const error = error;
export const logging = logging;
export const promise = promise;
export const until = until;
export const Select = select.Select;
export const LogInspector = LogInspector;
export const BrowsingContext = BrowsingContext;