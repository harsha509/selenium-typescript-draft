

import by from './by';
import { RelativeBy } from './by';
import * as command from './command';
import error from './error';
import input from './input';
import logging from './logging';
import promise from './promise';
import Symbols from './symbols';
import cdp from '../devtools/CDPConnection';
import WebSocket from 'ws';
import http from '../http/index';
import fs from 'fs';
import { Capabilities } from './capabilities';
import path from 'path';
import { NoSuchElementError } from './error';

const cdpTargets = ['page', 'browser'];
import { Credential } from './virtual_authenticator';
import webElement from './webelement';
import { isObject } from './util';
import BIDI from '../bidi';



const W3C_CAPABILITY_NAMES = new Set([
    'acceptInsecureCerts',
    'browserName',
    'browserVersion',
    'pageLoadStrategy',
    'platformName',
    'proxy',
    'setWindowRect',
    'strictFileInteractability',
    'timeouts',
    'unhandledPromptBehavior',
    'webSocketUrl',
])

class Condition<T> {
    private readonly description_: string;
    private fn: (driver: any) => T;
    constructor(message: string, fn: (driver: any) => T) {
        this.description_ = 'Waiting ' + message
        this.fn = fn
    }
    description() {
        return this.description_
    }
}


class WebElementCondition extends Condition<any> {
    constructor(message: string, fn: (driver: any) => any) {
        super(message, fn);
    }
}

async function executeCommand(executor: any, command: any) {
    const parameters = await toWireValue(command.getParameters());
    command.setParameters(parameters);
    return executor.execute(command);
}

async function toWireValue(obj: any) {
    let value = await Promise.resolve(obj);
    if (value === undefined || value === null) {
        return value;
    }

    if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
        return value;
    }

    if (Array.isArray(value)) {
        return convertKeys(value);
    }

    if (typeof value === 'function') {
        return '' + value;
    }

    // @ts-ignore
    if (typeof value[Symbols.serialize] === 'function') {
        // @ts-ignore
        return toWireValue(value[Symbols.serialize]());
    } else if (typeof value.toJSON === 'function') {
        return toWireValue(value.toJSON());
    }
    return convertKeys(value);
}


async function convertKeys(obj: any) {
    const isArray = Array.isArray(obj);
    const numKeys = isArray ? obj.length : Object.keys(obj).length;
    const ret = isArray ? new Array(numKeys) : {};
    if (!numKeys) {
        return ret;
    }

    async function forEachKey(obj: any, fn: any) {
        if (Array.isArray(obj)) {
            for (let i = 0, n = obj.length; i < n; i++) {
                await fn(obj[i], i);
            }
        } else {
            for (let key in obj) {
                await fn(obj[key], key);
            }
        }
    }

    await forEachKey(obj, async function (value: any, key: string | number) {
        // @ts-ignore
        ret[key] = await toWireValue(value);
    });

    return ret;
}


function fromWireValue(driver: any, value: any) {
    if (Array.isArray(value)) {
        value = value.map(v => fromWireValue(driver, v));
    } else if (WebElement.isId(value)) {
        let id = WebElement.extractId(value);
        value = new WebElement(driver, id);
    } else if (ShadowRoot.isId(value)) {
        let id = ShadowRoot.extractId(value);
        value = new ShadowRoot(driver, id);
    } else if (isObject(value)) {
        let result = {};
        for (let key in value) {
            if (Object.prototype.hasOwnProperty.call(value, key)) {
                // @ts-ignore
                result[key] = fromWireValue(driver, value[key]);
            }
        }
        value = result;
    }
    return value;
}


function resolveWaitMessage(message: any): string {
    return message
        ? `${typeof message === 'function' ? message() : message}\n`
        : '';
}

interface IWebDriver {
    execute<T>(command: command.Command): Promise<T>;
    setFileDetector(detector: input.FileDetector): void;
    getExecutor(): command.Executor;
    getSession(): Promise<Session>;
    getCapabilities(): Promise<Capabilities>;
    quit(): Promise<void>;
    actions(options?: { async?: boolean, bridge?: boolean }): input.Actions;
    executeScript<T>(script: string | Function, ...args: any[]): Promise<T>;
    executeAsyncScript<T>(script: string | Function, ...args: any[]): Promise<T>;
    wait(
        condition: Promise<any> | Function | Condition,
        timeout?: number,
        message?: string | Function,
        pollTimeout?: number
    ): Promise<any> | WebElementPromise;

    sleep(ms: number): Promise<void>;

    getWindowHandle(): Promise<string>;

    getAllWindowHandles(): Promise<string[]>;

    getPageSource(): Promise<string>;

    close(): Promise<void>;

    get(url: string): Promise<void>;

    getCurrentUrl(): Promise<string>;

    getTitle(): Promise<string>;

    findElement(locator: By | Function): WebElementPromise;
    findElements(locator: By | Function): Promise<WebElement[]>;
    takeScreenshot(): Promise<string>;
    manage(): Options;
    navigate(): Navigation;
    switchTo(): TargetLocator;
    printPage(options: {
        orientation?: string;
        scale?: number;
        background?: boolean;
        width?: number;
        height?: number;
        top?: number;
        bottom?: number;
        left?: number;
        right?: number;
        shrinkToFit?: boolean;
        pageRanges?: Array<any>;
    }): void;
}

function filterNonW3CCaps(capabilities: Capabilities): Capabilities {
    let newCaps = new Capabilities(capabilities);
    for (let k of newCaps.keys()) {
        // Any key containing a colon is a vendor-prefixed capability.
        if (!(W3C_CAPABILITY_NAMES.has(k) || k.indexOf(':') >= 0)) {
            newCaps.delete(k);
        }
    }
    return newCaps;
}


class WebDriver {
    /**
     * @param {!(./session.Session|Promise<!./session.Session>)} session Either
     *     a known session or a promise that will be resolved to a session.
     * @param {!command.Executor} executor The executor to use when sending
     *     commands to the browser.
     * @param {(() => void)=} onQuit A function to call, if any,
     *     when the session is terminated.
     */
    constructor(session: Promise<Session> | Session, executor: command.Executor, onQuit: (() => void) | undefined = undefined) {
        /** @private {!Promise<!Session>} */
        this.session_ = Promise.resolve(session)

        // If session is a rejected promise, add a no-op rejection handler.
        // This effectively hides setup errors until users attempt to interact
        // with the session.
        this.session_.catch(() => {})

        /** @private {!command.Executor} */
        this.executor_ = executor

        /** @private {input.FileDetector} */
        this.fileDetector_ = null

        /** @private @const {(() => void | undefined)} */
        this.onQuit_ = onQuit

        /** @private {./virtual_authenticator}*/
        this.authenticatorId_ = null
    }

    static async createSession(executor: any, capabilities: any, onQuit: any = undefined) {
        let cmd = new command.Command(command.Name.NEW_SESSION)

        cmd.setParameter('capabilities', {
            firstMatch: [{}],
            alwaysMatch: filterNonW3CCaps(capabilities),
        })

        let session = await executeCommand(executor, cmd)
        if (typeof onQuit === 'function') {
            session = session.catch((err) => {
                return Promise.resolve(onQuit.call(void 0)).then((_) => {
                    throw err
                })
            })
        }
        return new this(session, executor, onQuit)
    }

    async execute(command: any) {
        command.setParameter('sessionId', this.session_)

        let parameters = await toWireValue(command.getParameters())
        command.setParameters(parameters)
        let value = await this.executor_.execute(command)
        return fromWireValue(this, value)
    }

    setFileDetector(detector: any) {
        this.fileDetector_ = detector
    }

    getExecutor() {
        return this.executor_
    }

    getSession() {
        return this.session_
    }

    async getCapabilities() {
        return (await this.session_).getCapabilities()
    }

    async quit() {
        let result = this.execute(new command.Command(command.Name.QUIT))
        return promise.finally(result, async () => {
            this.session_ = Promise.reject(
                new error.NoSuchSessionError(
                    'This driver instance does not have a valid session ID ' +
                    '(did you call WebDriver.quit()?) and may no longer be used.'
                )
            )

            this.session_.catch(function () {})

            if (this.onQuit_) {
                return this.onQuit_.call(void 0)
            }
        })
    }

    actions(options: any) {
        return new input.Actions(this, options || undefined)
    }

    executeScript(script: any, ...args: any[]) {
        if (typeof script === 'function') {
            script = 'return (' + script + ').apply(null, arguments);'
        }
        return this.execute(
            new command.Command(command.Name.EXECUTE_SCRIPT)
                .setParameter('script', script)
                .setParameter('args', args)
        )
    }

    executeAsyncScript(script: any, ...args: any[]) {
        if (typeof script === 'function') {
            script = 'return (' + script + ').apply(null, arguments);'
        }
        return this.execute(
            new command.Command(command.Name.EXECUTE_ASYNC_SCRIPT)
                .setParameter('script', script)
                .setParameter('args', args)
        )
    }


    wait(condition: any, timeout = 0, message?: string, pollTimeout = 200): Promise<any> {
    if (typeof timeout !== 'number' || timeout < 0) {
        throw new TypeError(`timeout must be a number >= 0: ${timeout}`);
    }

    if (typeof pollTimeout !== 'number' || pollTimeout < 0) {
        throw new TypeError(`pollTimeout must be a number >= 0: ${pollTimeout}`);
    }

    if (promise.isPromise(condition)) {
        return new Promise((resolve, reject) => {
            if (!timeout) {
                resolve(condition);
                return;
            }

            let start = Date.now();
            let timer = setTimeout(() => {
                timer = null;
                try {
                    let timeoutMessage = resolveWaitMessage(message);
                    reject(
                        new error.TimeoutError(
                            `${timeoutMessage}Timed out waiting for promise to resolve after ${Date.now() - start}ms`
                        )
                    );
                } catch (ex) {
                    reject(
                        new error.TimeoutError(
                            `${ex.message}\nTimed out waiting for promise to resolve after ${Date.now() - start}ms`
                        )
                    );
                }
            }, timeout);
            const clearTimer = () => {
                if (timer) clearTimeout(timer);
            };

            (condition as Promise<any>).then(
                (value) => {
                    clearTimer();
                    resolve(value);
                },
                (error) => {
                    clearTimer();
                    reject(error);
                }
            );
        });
    }

    let fn = condition as Function;
    if (condition instanceof Condition) {
        message = message || condition.description();
        fn = condition.fn;
    }

    if (typeof fn !== 'function') {
        throw new TypeError(
            'Wait condition must be a promise-like object, function, or a Condition object'
        );
    }

    const driver = this;

    function evaluateCondition(): Promise<any> {
        return new Promise((resolve, reject) => {
            try {
                resolve(fn(driver));
            } catch (ex) {
                reject(ex);
            }
        });
    }

    const result = new Promise<any>((resolve, reject) => {
            const startTime = Date.now();
            const pollCondition = async () => {
                evaluateCondition().then((value) => {
                    const elapsed = Date.now() - startTime;
                    if (value) {
                        resolve(value);
                    } else if (timeout && elapsed >= timeout) {
                        try {
                            let timeoutMessage = resolveWaitMessage(message);
                            reject(
                                new error.TimeoutError(
                                    `${timeoutMessage}Wait timed out after ${elapsed}ms`
                                )
                            );
                        } catch (ex) {
                            reject(
                                new error.TimeoutError(
                                    `${ex.message}\nWait timed out after ${elapsed}ms`
                                )
                            );
                        }
                    } else {
                        setTimeout(pollCondition, pollTimeout);
                    }
                }, reject);
            };
            pollCondition();
        });
    let typedResult: Promise<WebElement | any> = result;
    if (condition instanceof WebElementCondition) {
            typedResult = new WebElementPromise(
                this,
                result.then((value) => {
                    if (!(value instanceof WebElement)) {
                        throw new TypeError(
                            `WebElementCondition did not resolve to a WebElement: ${Object.prototype.toString.call(
                                value
                            )}`
                        );
                    }
                    return value;
                })
            );
        }
    return typedResult;
    }


    async sleep(ms: number) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async getWindowHandle() {
        return await this.execute(
            new command.Command(command.Name.GET_CURRENT_WINDOW_HANDLE)
        );
    }

    async getAllWindowHandles() {
        return await this.execute(
            new command.Command(command.Name.GET_WINDOW_HANDLES)
        );
    }

    async getPageSource(): Promise<string> {
        return this.execute(new command.Command(command.Name.GET_PAGE_SOURCE));
    }

    async close(): Promise<void> {
        return this.execute(new command.Command(command.Name.CLOSE));
    }

    async get(url: string): Promise<void> {
        return this.navigate().to(url);
    }

    async getCurrentUrl(): Promise<string> {
        return this.execute(new command.Command(command.Name.GET_CURRENT_URL));
    }

    async getTitle(): Promise<string> {
        return this.execute(new command.Command(command.Name.GET_TITLE));
    }

    async findElement(locator: by.Locator): Promise<WebElement> {
        let id: any;
        let cmd: any = null;

        if (locator instanceof RelativeBy) {
            cmd = new command.Command(
                command.Name.FIND_ELEMENTS_RELATIVE
            ).setParameter("args", locator.marshall());
        } else {
            locator = by.checkedLocator(locator);
        }

        if (typeof locator === "function") {
            id = await this.findElementInternal_(locator, this);
            return new WebElementPromise(this, id);
        } else if (cmd === null) {
            cmd = new command.Command(command.Name.FIND_ELEMENT)
                .setParameter("using", locator.using)
                .setParameter("value", locator.value);
        }

        id = await this.execute(cmd);
        if (locator instanceof RelativeBy) {
            return this.normalize_(id);
        } else {
            return new WebElementPromise(this, id);
        }
    }

    async normalize_(webElementPromise: Promise<WebElement | WebElement[]>): Promise<WebElement> {
        let result = await webElementPromise;
        if (Array.isArray(result) && result.length === 0) {
            throw new NoSuchElementError(
                "Cannot locate an element with provided parameters"
            );
        } else if (!Array.isArray(result)) {
            return result;
        } else {
            return result[0];
        }
    }

    async findElementInternal_(locatorFn: (context: any) => any, context: any): Promise<WebElement> {
        let result = await locatorFn(context);
        if (Array.isArray(result)) {
            result = result[0];
        }
        if (!(result instanceof WebElement)) {
            throw new TypeError('Custom locator did not return a WebElement');
        }
        return result;
    }

    async findElements(locator: By | ((context: any) => any)): Promise<WebElement[]> {
        let cmd: Command | null = null;
        if (locator instanceof RelativeBy) {
            cmd = new Command(
                Name.FIND_ELEMENTS_RELATIVE
            ).setParameter('args', locator.marshall());
        } else {
            locator = by.checkedLocator(locator);
        }

        if (typeof locator === 'function') {
            return this.findElementsInternal_(locator, this);
        } else if (cmd === null) {
            cmd = new Command(Name.FIND_ELEMENTS)
                .setParameter('using', locator.using)
                .setParameter('value', locator.value);
        }
        try {
            let res = await this.execute(cmd);
            return Array.isArray(res) ? res : [];
        } catch (ex) {
            if (ex instanceof NoSuchElementError) {
                return [];
            }
            throw ex;
        }
    }

    async findElementsInternal_(locatorFn: (context: any) => any, context: any): Promise<WebElement[]> {
        const result = await locatorFn(context);
        if (result instanceof WebElement) {
            return [result];
        }

        if (!Array.isArray(result)) {
            return [];
        }

        return result.filter(function (item: any) {
            return item instanceof WebElement;
        });
    }

    async takeScreenshot(): Promise<any> {
        return this.execute(new command.Command(command.Name.SCREENSHOT));
    }

    manage(): Options {
        return new Options(this);
    }

    navigate(): Navigation {
        return new Navigation(this);
    }

    switchTo(): TargetLocator {
        return new TargetLocator(this);
    }

    private validatePrintPageParams(keys: any, object: any): any {
        let page = {};
        let margin = {};
        let data: any;
        Object.keys(keys).forEach(function (key) {
            data = keys[key];
            let obj = {
                orientation: function () {
                    object.orientation = data;
                },

                scale: function () {
                    object.scale = data;
                },

                background: function () {
                    object.background = data;
                },

                width: function () {
                    page.width = data;
                    object.page = page;
                },

                height: function () {
                    page.height = data;
                    object.page = page;
                },

                top: function () {
                    margin.top = data;
                    object.margin = margin;
                },

                left: function () {
                    margin.left = data;
                    object.margin = margin;
                },

                bottom: function () {
                    margin.bottom = data;
                    object.margin = margin;
                },

                right: function () {
                    margin.right = data;
                    object.margin = margin;
                },

                shrinkToFit: function () {
                    object.shrinkToFit = data;
                },

                pageRanges: function () {
                    object.pageRanges = data;
                },
            };

            if (!Object.prototype.hasOwnProperty.call(obj, key)) {
                throw new error.InvalidArgumentError(`Invalid Argument '${key}'`);
            } else {
                obj[key]();
            }
        });

        return object;
    }

    async printPage(options: any = {}): Promise<any> {
        let keys = options;
        let params = {};
        let resultObj;

        resultObj = this.validatePrintPageParams(keys, params);

        return this.execute(
            new command.Command(command.Name.PRINT_PAGE).setParameters(resultObj)
        );
    }

    async createCDPConnection(target: any): Promise<cdp.CdpConnection> {
        let debuggerUrl: string | null = null;

        const caps = await this.getCapabilities();

        if (process.env.SELENIUM_REMOTE_URL) {
            const host = new URL(process.env.SELENIUM_REMOTE_URL).host;
            const sessionId = await this.getSession().then((session) => session.getId());
            debuggerUrl = `ws://${host}/session/${sessionId}/se/cdp`;
        } else {
            const seCdp = caps['map_'].get('se:cdp');
            const vendorInfo =
                caps['map_'].get(this.VENDOR_COMMAND_PREFIX + ':chromeOptions') ||
                caps['map_'].get(this.VENDOR_CAPABILITY_PREFIX + ':edgeOptions') ||
                caps['map_'].get('moz:debuggerAddress') ||
                new Map();
            debuggerUrl = seCdp || vendorInfo['debuggerAddress'] || vendorInfo;
        }

        this._wsUrl = await this.getWsUrl(debuggerUrl, target, caps);

        return new Promise((resolve, reject) => {
            try {
                this._wsConnection = new WebSocket(this._wsUrl.replace('localhost', '127.0.0.1'));
                this._cdpConnection = new cdp.CdpConnection(this._wsConnection);
            } catch (err) {
                reject(err);
                return;
            }

            this._wsConnection.on('open', async () => {
                await this.getCdpTargets();
            });

            this._wsConnection.on('message', async (message: any) => {
                const params = JSON.parse(message);
                if (params.result) {
                    if (params.result.targetInfos) {
                        const targets = params.result.targetInfos;
                        const page = targets.find((info) => info.type === 'page');
                        if (page) {
                            this.targetID = page.targetId;
                            this._cdpConnection.execute(
                                'Target.attachToTarget',
                                { targetId: this.targetID, flatten: true },
                                null
                            );
                        } else {
                            reject('Unable to find Page target.');
                        }
                    }
                    if (params.result.sessionId) {
                        this.sessionId = params.result.sessionId;
                        this._cdpConnection.sessionId = this.sessionId;
                        resolve(this._cdpConnection);
                    }
                }
            });

            this._wsConnection.on('error', (error: any) => {
                reject(error);
            });
        });
    }

    async getBidi(): Promise<BIDI> {
        const caps = await this.getCapabilities();
        let WebSocketUrl = caps['map_'].get('webSocketUrl');
        return new BIDI(WebSocketUrl.replace('localhost', '127.0.0.1'));
    }

    async getCdpTargets(): Promise<void> {
        this._cdpConnection.execute('Target.getTargets');
    }

    async getWsUrl(
        debuggerAddress: string,
        target: string | undefined,
        caps: any
    ): Promise<string> {
        if (target && cdpTargets.indexOf(target.toLowerCase()) === -1) {
            throw new Error('invalid target value');
        }

        if (debuggerAddress.match(/\/se\/cdp/)) {
            return debuggerAddress;
        }

        let path: string;
        if (
            target === 'page' &&
            caps['map_'].get('browserName') !== 'firefox'
        ) {
            path = '/json';
        } else if (target === 'page' && caps['map_'].get('browserName') === 'firefox') {
            path = '/json/list';
        } else {
            path = '/json/version';
        }

        const request = new http.Request('GET', path);
        const client = new http.HttpClient(`http://${debuggerAddress}`);
        const response = await client.send(request);

        if (target && target.toLowerCase() === 'page') {
            return JSON.parse(response.body)[0]['webSocketDebuggerUrl'];
        } else {
            return JSON.parse(response.body)['webSocketDebuggerUrl'];
        }
    }

    async register(username: string, password: string, connection: any) {
        this._wsConnection.on('message', (message: string) => {
            const params = JSON.parse(message);

            if (params.method === 'Fetch.authRequired') {
                const requestParams = params['params'];
                connection.execute('Fetch.continueWithAuth', {
                    requestId: requestParams['requestId'],
                    authChallengeResponse: {
                        response: 'ProvideCredentials',
                        username: username,
                        password: password,
                    },
                });
            } else if (params.method === 'Fetch.requestPaused') {
                const requestPausedParams = params['params'];
                connection.execute('Fetch.continueRequest', {
                    requestId: requestPausedParams['requestId'],
                });
            }
        });

        await connection.execute('Fetch.enable', { handleAuthRequests: true }, null);
        await connection.execute('Network.setCacheDisabled', { cacheDisabled: true }, null);
    }

    async  onIntercept(
        connection: any,
        httpResponse: { urlToIntercept: string; headers: any; body: string },
        callback: () => void
    ): Promise<void> {
        this._wsConnection.on('message', (message: any) => {
            const params = JSON.parse(message);
            if (params.method === 'Fetch.requestPaused') {
                const requestPausedParams = params['params'];
                if (requestPausedParams.request.url === httpResponse.urlToIntercept) {
                    connection.execute('Fetch.fulfillRequest', {
                        requestId: requestPausedParams['requestId'],
                        responseCode: 200,
                        responseHeaders: httpResponse.headers,
                        body: httpResponse.body,
                    });
                    callback();
                } else {
                    connection.execute('Fetch.continueRequest', {
                        requestId: requestPausedParams['requestId'],
                    });
                }
            }
        });

        await connection.execute('Fetch.enable', {}, null);
        await connection.execute('Network.setCacheDisabled', { cacheDisabled: true }, null);
    }


    async onLogEvent(connection: any, callback: (event: any) => void) {
        this._wsConnection.on('message', (message: string) => {
            const params = JSON.parse(message);
            if (params.method === 'Runtime.consoleAPICalled') {
                const consoleEventParams = params['params'];
                let event = {
                    type: consoleEventParams['type'],
                    timestamp: new Date(consoleEventParams['timestamp']),
                    args: consoleEventParams['args'],
                };

                callback(event);
            }

            if (params.method === 'Log.entryAdded') {
                const logEventParams = params['params'];
                const logEntry = logEventParams['entry'];
                let event = {
                    level: logEntry['level'],
                    timestamp: new Date(logEntry['timestamp']),
                    message: logEntry['text'],
                };

                callback(event);
            }
        });
        await connection.execute('Runtime.enable', {}, null);
    }

    async onLogException(connection: any, callback: (event: any) => void) {
        await connection.execute('Runtime.enable', {}, null);

        this._wsConnection.on('message', (message: string) => {
            const params = JSON.parse(message);

            if (params.method === 'Runtime.exceptionThrown') {
                const exceptionEventParams = params['params'];
                let event = {
                    exceptionDetails: exceptionEventParams['exceptionDetails'],
                    timestamp: new Date(exceptionEventParams['timestamp']),
                };

                callback(event);
            }
        });
    }

    async logMutationEvents(connection: any, callback: (event: any) => void) {
        await connection.execute('Runtime.enable', {}, null);
        await connection.execute('Page.enable', {}, null);

        await connection.execute(
            'Runtime.addBinding',
            {
                name: '__webdriver_attribute',
            },
            null
        );

        let mutationListener = '';
        try {
            mutationListener = fs
                .readFileSync(
                    './javascript/node/selenium-webdriver/lib/atoms/mutation-listener.js',
                    'utf-8'
                )
                .toString();
        } catch {
            mutationListener = fs
                .readFileSync(
                    path.resolve(__dirname, './atoms/mutation-listener.js'),
                    'utf-8'
                )
                .toString();
        }

        await this.executeScript(mutationListener);

        await connection.execute(
            'Page.addScriptToEvaluateOnNewDocument',
            {
                source: mutationListener,
            },
            null
        );

        this._wsConnection.on('message', async (message: string) => {
            const params = JSON.parse(message);
            if (params.method === 'Runtime.bindingCalled') {
                let payload = JSON.parse(params['params']['payload']);
                let elements = await this.findElements({
                    css: '*[data-__webdriver_id=' + by.escapeCss(payload['target']) + ']',
                });

                if (elements.length === 0) {
                    return;
                }

                let event = {
                    element: elements[0],
                    attribute_name: payload['name'],
                    current_value: payload['value'],
                    old_value: payload['oldValue'],
                };
                callback(event);
            }
        });
    }

    virtualAuthenticatorId() {
        return this.authenticatorId_;
    }

    async addVirtualAuthenticator(options: any) {
        this.authenticatorId_ = await this.execute(
            new Command(CommandName.ADD_VIRTUAL_AUTHENTICATOR).setParameters(
                options.toDict()
            )
        );
    }

    async removeVirtualAuthenticator() {
        await this.execute(
            new Command(CommandName.REMOVE_VIRTUAL_AUTHENTICATOR)
                .setParameter('authenticatorId', this.authenticatorId_!)
        );
        this.authenticatorId_ = null;
    }

    async addCredential(credential: any) {
        const credentialData = credential.toDict();
        credentialData['authenticatorId'] = this.authenticatorId_;
        await this.execute(
            new command.Command(command.Name.ADD_CREDENTIAL).setParameters(credentialData)
        );
    }

    async getCredentials(): Promise<any[]> {
        const credentialData = await this.execute(
            new command.Command(command.Name.GET_CREDENTIALS).setParameter(
                'authenticatorId',
                this.virtualAuthenticatorId()
            )
        );
        const credentialList = [];
        for (let i = 0; i < credentialData.length; i++) {
            credentialList.push(new Credential().fromDict(credentialData[i]));
        }
        return credentialList;
    }

    async removeCredential(credentialId: any) {
        let credentialIdString: string;
        if (Array.isArray(credentialId)) {
            credentialIdString = Buffer.from(credentialId).toString('base64url');
        } else {
            credentialIdString = credentialId;
        }

        await this.execute(
            new command.Command(command.Name.REMOVE_CREDENTIAL)
                .setParameter('credentialId', credentialIdString)
                .setParameter('authenticatorId', this.authenticatorId_)
        );
    }


    async removeAllCredentials(): Promise<void> {
        await this.execute(
            new command.Command(command.Name.REMOVE_ALL_CREDENTIALS).setParameter(
                'authenticatorId',
                this.authenticatorId_
            )
        );
    }

    async setUserVerified(verified: boolean): Promise<void> {
        await this.execute(
            new command.Command(command.Name.SET_USER_VERIFIED)
                .setParameter('authenticatorId', this.authenticatorId_)
                .setParameter('isUserVerified', verified)
        );
    }
}


class Navigation {
    private driver_: WebDriver;

    constructor(driver: WebDriver) {
        this.driver_ = driver;
    }

    async to(url: string) {
        return this.driver_.execute(
            new command.Command(command.Name.GET).setParameter('url', url)
        );
    }

    async back() {
        return this.driver_.execute(new command.Command(command.Name.GO_BACK));
    }

    async forward() {
        return this.driver_.execute(new command.Command(command.Name.GO_FORWARD));
    }

    async refresh() {
        return this.driver_.execute(new command.Command(command.Name.REFRESH));
    }
}




class Options {
    private driver_: WebDriver;

    constructor(driver: WebDriver) {
        this.driver_ = driver;
    }

    async addCookie({ name, value, path, domain, secure, httpOnly, expiry, sameSite }: Options.Cookie) {
        if (/[;=]/.test(name)) {
            throw new error.InvalidArgumentError(`Invalid cookie name "${name}"`);
        }
        if (/;/.test(value)) {
            throw new error.InvalidArgumentError(`Invalid cookie value "${value}"`);
        }
        if (typeof expiry === 'number') {
            expiry = Math.floor(expiry);
        } else if (expiry instanceof Date) {
            const date = expiry as Date;
            expiry = Math.floor(date.getTime() / 1000);
        }
        if (sameSite && !['Strict', 'Lax', 'None'].includes(sameSite)) {
            throw new error.InvalidArgumentError(
                `Invalid sameSite cookie value '${sameSite}'. It should be one of "Lax", "Strict" or "None"`
            );
        }
        if (sameSite === 'None' && !secure) {
            throw new error.InvalidArgumentError(
                'Invalid cookie configuration: SameSite=None must be Secure'
            );
        }

        return this.driver_.execute(
            new command.Command(command.Name.ADD_COOKIE).setParameter('cookie', {
                name,
                value,
                path,
                domain,
                secure: !!secure,
                httpOnly: !!httpOnly,
                expiry,
                sameSite,
            })
        );
    }

    async deleteAllCookies() {
        return this.driver_.execute(
            new command.Command(command.Name.DELETE_ALL_COOKIES)
        );
    }

    async deleteCookie(name: string) {
        return this.driver_.execute(
            new command.Command(command.Name.DELETE_COOKIE).setParameter('name', name)
        );
    }

    async getCookies() {
        return this.driver_.execute(
            new command.Command(command.Name.GET_ALL_COOKIES)
        );
    }

    async getCookie(name: string) {
        try {
            const cookie = await this.driver_.execute(
                new command.Command(command.Name.GET_COOKIE).setParameter('name', name)
            );
            return cookie;
        } catch (err) {
            if (
                !(err instanceof error.UnknownCommandError) &&
                !(err instanceof error.UnsupportedOperationError)
            ) {
                throw err;
            }

            const cookies = await this.getCookies();
            for (let cookie of cookies) {
                if (cookie && cookie['name'] === name) {
                    return cookie;
                }
            }
            return null;
        }
    }

    getTimeouts(): Promise<any> {
        return this.driver_.execute(new command.Command(command.Name.GET_TIMEOUT));
    }

    setTimeouts({ script, pageLoad, implicit }: { script?: number; pageLoad?: number; implicit?: number } = {}): Promise<void> {
        let cmd = new command.Command(command.Name.SET_TIMEOUT);

        let valid = false;
        function setParam(key: string, value: number | null) {
            if (value === null || typeof value === 'number') {
                valid = true;
                cmd.setParameter(key, value);
            } else if (typeof value !== 'undefined') {
                throw new TypeError(
                    `invalid timeouts configuration: expected "${key}" to be a number, got ${typeof value}`
                );
            }
        }
        setParam('implicit', implicit);
        setParam('pageLoad', pageLoad);
        setParam('script', script);

        if (valid) {
            return this.driver_.execute(cmd).catch(() => {
                // Fallback to the legacy method.
                let cmds = [];
                if (typeof script === 'number') {
                    cmds.push(legacyTimeout(this.driver_, 'script', script));
                }
                if (typeof implicit === 'number') {
                    cmds.push(legacyTimeout(this.driver_, 'implicit', implicit));
                }
                if (typeof pageLoad === 'number') {
                    cmds.push(legacyTimeout(this.driver_, 'page load', pageLoad));
                }
                return Promise.all(cmds);
            });
        }
        throw new TypeError('no timeouts specified');
    }

    logs() {
        return new Logs(this.driver_);
    }

    window() {
        return new Window(this.driver_);
    }

}
function legacyTimeout(driver: WebDriver, type: string, ms: number): Promise<void> {
    return driver.execute(
        new command.Command(command.Name.SET_TIMEOUT)
            .setParameter('type', type)
            .setParameter('ms', ms)
    );
}

declare namespace Options {
    interface Cookie {
        name: string;
        value: string;
        path?: string;
        domain?: string;
        secure?: boolean;
        httpOnly?: boolean;
        expiry?: number | Date;
        sameSite?: 'Strict' | 'Lax' | 'None';
    }
}


class Window {
    private driver_: WebDriver;

    constructor(driver: WebDriver) {
        this.driver_ = driver;
    }

    public getRect(): Promise<{ x: number, y: number, width: number, height: number }> {
        return this.driver_.execute(
            new command.Command(command.Name.GET_WINDOW_RECT)
        );
    }

    public setRect({ x, y, width, height }: { x?: number, y?: number, width?: number, height?: number }): Promise<{ x: number, y: number, width: number, height: number }> {
        return this.driver_.execute(
            new command.Command(command.Name.SET_WINDOW_RECT).setParameters({
                x,
                y,
                width,
                height,
            })
        );
    }

    public maximize(): Promise<void> {
        return this.driver_.execute(
            new command.Command(command.Name.MAXIMIZE_WINDOW).setParameter(
                'windowHandle',
                'current'
            )
        );
    }

    public minimize(): Promise<void> {
        return this.driver_.execute(
            new command.Command(command.Name.MINIMIZE_WINDOW)
        );
    }

    public fullscreen(): Promise<void> {
        return this.driver_.execute(
            new command.Command(command.Name.FULLSCREEN_WINDOW)
        );
    }

    public async getSize(windowHandle: string = 'current'): Promise<{ width: number, height: number }> {
        if (windowHandle !== 'current') {
            console.warn(`Only 'current' window is supported for W3C compatible browsers.`);
        }

        const rect = await this.getRect();
        return { height: rect.height, width: rect.width };
    }

    public async setSize({ x = 0, y = 0, width = 0, height = 0 }: { x?: number, y?: number, width?: number, height?: number }, windowHandle: string = 'current'): Promise<void> {
        if (windowHandle !== 'current') {
            console.warn(`Only 'current' window is supported for W3C compatible browsers.`);
        }

        await this.setRect({ x, y, width, height });
    }
}

class Logs {
    private driver_: WebDriver;

    constructor(driver: WebDriver) {
        this.driver_ = driver;
    }

    get(type: logging.Type): Promise<logging.Entry[]> {
        let cmd = new command.Command(command.Name.GET_LOG).setParameter(
            'type',
            type
        );
        return this.driver_.execute(cmd).then((entries) => {
            return entries.map((entry) => {
                if (!(entry instanceof logging.Entry)) {
                    return new logging.Entry(
                        entry['level'],
                        entry['message'],
                        entry['timestamp'],
                        entry['type']
                    );
                }
                return entry;
            });
        });
    }

    getAvailableLogTypes(): Promise<logging.Type[]> {
        return this.driver_.execute(
            new command.Command(command.Name.GET_AVAILABLE_LOG_TYPES)
        );
    }
}

class TargetLocator {
    private driver_: WebDriver;

    constructor(driver: WebDriver) {
        this.driver_ = driver;
    }

    activeElement(): WebElementPromise {
        const id = this.driver_.execute(
            new Command(Name.GET_ACTIVE_ELEMENT)
        );
        return new WebElementPromise(this.driver_, id);
    }

    defaultContent(): Promise<void> {
        return this.driver_.execute(
            new Command(Name.SWITCH_TO_FRAME).setParameter('id', null)
        );
    }

    async frame(id: number | string | WebElement | null): Promise<void> {
        let frameReference = id;
        if (typeof id === 'string') {
            frameReference = await this.driver_
                .findElement({ id })
                .catch((_) => this.driver_.findElement({ name: id }));
        }

        return this.driver_.execute(
            new Command(Name.SWITCH_TO_FRAME).setParameter(
                'id',
                frameReference
            )
        );
    }

    parentFrame(): Promise<void> {
        return this.driver_.execute(
            new Command(Name.SWITCH_TO_FRAME_PARENT)
        );
    }

    window(nameOrHandle: string): Promise<void> {
        return this.driver_.execute(
            new Command(Name.SWITCH_TO_WINDOW)
                .setParameter('name', nameOrHandle)
                .setParameter('handle', nameOrHandle)
        );
    }

    newWindow(typeHint: any) {
        const driver = this.driver_;
        return this.driver_
            .execute(
                new command.Command(command.Name.SWITCH_TO_NEW_WINDOW).setParameter(
                    'type',
                    typeHint
                )
            )
            .then((response: any) => {
                return driver.switchTo().window(response.handle);
            });
    }

    /**
     * Changes focus to the active modal dialog, such as those opened by
     * `window.alert()`, `window.confirm()`, and `window.prompt()`. The returned
     * promise will be rejected with a
     * {@linkplain error.NoSuchAlertError} if there are no open alerts.
     *
     * @return {!AlertPromise} The open alert.
     */
    alert(): AlertPromise {
        const text = this.driver_.execute(
            new command.Command(command.Name.GET_ALERT_TEXT)
        );
        const driver = this.driver_;
        return new AlertPromise(
            driver,
            text.then((text: any) => {
                return new Alert(driver, text);
            })
        );
    }
}


class WebElement {
    private driver_: WebDriver;
    private id_: Promise<string>;

    constructor(driver: WebDriver, id: string | Promise<string>) {
        this.driver_ = driver;
        this.id_ = Promise.resolve(id);
    }

    static buildId(id: string, noLegacy = false): object {
        return noLegacy
            ? { [ELEMENT_ID_KEY]: id }
            : { [ELEMENT_ID_KEY]: id, [LEGACY_ELEMENT_ID_KEY]: id };
    }

    static extractId(obj: any): string {
        return webElement.extractId(obj);
    }

    static isId(obj: any): boolean {
        return webElement.isId(obj);
    }

    static async equals(a: WebElement, b: WebElement): Promise<boolean> {
        if (a === b) {
            return true;
        }
        return a.driver_.executeScript('return arguments[0] === arguments[1]', a, b);
    }

    getDriver(): WebDriver {
        return this.driver_;
    }

    getId(): Promise<any> {
        return Promise.resolve(this.id_);
    }

    [Symbols.serialize](): Promise<any> {
        return this.getId().then((id: any) => WebElement.buildId(id));
    }

    execute_(command: any): Promise<any> {
        command.setParameter("id", this);
        return this.driver_.execute(command);
    }

    findElement(locator: any): WebElementPromise {
        locator = by.checkedLocator(locator);
        let id: any;
        if (typeof locator === "function") {
            id = this.driver_.findElementInternal_(locator, this);
        } else {
            let cmd = new command.Command(command.Name.FIND_CHILD_ELEMENT)
                .setParameter("using", locator.using)
                .setParameter("value", locator.value);
            id = this.execute_(cmd);
        }
        return new WebElementPromise(this.driver_, id);
    }

    async findElements(locator: any): Promise<any[]> {
        locator = by.checkedLocator(locator);
        if (typeof locator === "function") {
            return this.driver_.findElementsInternal_(locator, this);
        } else {
            let cmd = new command.Command(command.Name.FIND_CHILD_ELEMENTS)
                .setParameter("using", locator.using)
                .setParameter("value", locator.value);
            let result = await this.execute_(cmd);
            return Array.isArray(result) ? result : [];
        }
    }

    click(): Promise<void> {
        return this.execute_(new command.Command(command.Name.CLICK_ELEMENT));
    }

    async sendKeys(...args: (string | number)[]) {
        let keys: string[] = [];
        (await Promise.all(args)).forEach((key) => {
            let type = typeof key;
            if (type === "number") {
                key = String(key);
            } else if (type !== "string") {
                throw new TypeError(
                    `each key must be a number or string; got ${type}`
                );
            }

            // The W3C protocol requires keys to be specified as an array where
            // each element is a single key.
            keys.push(...key.toString());
        });

        if (!this.driver_.fileDetector_) {
            return this.execute_(
                new command.Command(command.Name.SEND_KEYS_TO_ELEMENT)
                    .setParameter("text", keys.join(""))
                    .setParameter("value", keys)
            );
        }

        try {
            keys = await this.driver_.fileDetector_.handleFile(
                this.driver_,
                keys.join("")
            );
        } catch (ex) {
            console.log(
                `Error trying parse string as a file with file detector; sending keys instead ${ex}`
            );
        }

        return this.execute_(
            new command.Command(command.Name.SEND_KEYS_TO_ELEMENT)
                .setParameter("text", keys)
                .setParameter("value", keys.split(""))
        );
    }

    async getTagName(): Promise<string> {
        return this.execute_(new command.Command(command.Name.GET_ELEMENT_TAG_NAME)) as Promise<string>;
    }

    async getCssValue(cssStyleProperty: string): Promise<string> {
        const name = command.Name.GET_ELEMENT_VALUE_OF_CSS_PROPERTY;
        return this.execute_(
            new command.Command(name).setParameter('propertyName', cssStyleProperty)
        ) as Promise<string>;
    }

    async getAttribute(attributeName: string): Promise<string | null> {
        return this.execute_(
            new command.Command(command.Name.GET_ELEMENT_ATTRIBUTE).setParameter(
                'name',
                attributeName
            )
        ) as Promise<string | null>;
    }

    async getDomAttribute(attributeName: string): Promise<string | null> {
        return this.execute_(
            new command.Command(command.Name.GET_DOM_ATTRIBUTE).setParameter(
                'name',
                attributeName
            )
        ) as Promise<string | null>;
    }

    async getProperty(propertyName: string): Promise<any> {
        return this.execute_(
            new command.Command(command.Name.GET_ELEMENT_PROPERTY).setParameter(
                'name',
                propertyName
            )
        ) as Promise<any>;
    }

    async getShadowRoot(): Promise<any> {
        return this.execute_(new command.Command(command.Name.GET_SHADOW_ROOT)) as Promise<any>;
    }

    async getText(): Promise<string> {
        return this.execute_(new command.Command(command.Name.GET_ELEMENT_TEXT)) as Promise<string>;
    }

    getAriaRole(): Promise<any> {
        return this.execute_(new command.Command(command.Name.GET_COMPUTED_ROLE));
    }

    getAccessibleName(): Promise<any> {
        return this.execute_(new command.Command(command.Name.GET_COMPUTED_LABEL));
    }

    getRect(): Promise<any> {
        return this.execute_(new command.Command(command.Name.GET_ELEMENT_RECT));
    }

    isEnabled(): Promise<any> {
        return this.execute_(new command.Command(command.Name.IS_ELEMENT_ENABLED));
    }

    isSelected(): Promise<any> {
        return this.execute_(new command.Command(command.Name.IS_ELEMENT_SELECTED));
    }

    submit() {
        const script =
            '/* submitForm */var form = arguments[0];\n' +
            'while (form.nodeName != "FORM" && form.parentNode) {\n' +
            '  form = form.parentNode;\n' +
            '}\n' +
            "if (!form) { throw new Error('Unable to find containing form element'); }\n" +
            "if (!form.ownerDocument) { throw new Error('Unable to find owning document'); }\n" +
            "var e = form.ownerDocument.createEvent('Event');\n" +
            "e.initEvent('submit', true, true);\n" +
            'if (form.dispatchEvent(e)) { HTMLFormElement.prototype.submit.call(form) }\n'

        this.driver_.executeScript(script, this)
    }

    async clear(): Promise<void> {
        await this.execute_(new command.Command(command.Name.CLEAR_ELEMENT));
    }

    async isDisplayed(): Promise<boolean> {
        return this.execute_(new command.Command(command.Name.IS_ELEMENT_DISPLAYED));
    }

    async takeScreenshot(): Promise<string> {
        return this.execute_(new command.Command(command.Name.TAKE_ELEMENT_SCREENSHOT));
    }
}

class WebElementPromise extends WebElement {
    private then: any;
    private catch: any;
    constructor(driver: WebDriver, el: Promise<WebElement>) {
        super(driver, 'unused');

        this.then = el.then.bind(el);
        this.catch = el.catch.bind(el);

        this.getId = () => {
            return el.then((elem: WebElement) => {
                return elem.getId();
            });
        };
    }
}

class ShadowRoot {
    private driver_: any;
    private id_: any;

    constructor(driver: any, id: string) {
        this.driver_ = driver
        this.id_ = id
    }

    static extractId(obj: any) {
        if (obj && typeof obj === 'object') {
            if (typeof obj[SHADOW_ROOT_ID_KEY] === 'string') {
                return obj[SHADOW_ROOT_ID_KEY]
            }
        }
        throw new TypeError('object is not a ShadowRoot ID')
    }

    static isId(obj: any) {
        return (
            obj &&
            typeof obj === 'object' &&
            typeof obj[SHADOW_ROOT_ID_KEY] === 'string'
        )
    }

    [Symbols.serialize]() {
        return this.getId()
    }

    private execute_(command: any) {
        command.setParameter('id', this)
        return this.driver_.execute(command)
    }

    findElement(locator: any) {
        locator = by.checkedLocator(locator)
        let id
        if (typeof locator === 'function') {
            id = this.driver_.findElementInternal_(locator, this)
        } else {
            let cmd = new command.Command(command.Name.FIND_ELEMENT_FROM_SHADOWROOT)
                .setParameter('using', locator.using)
                .setParameter('value', locator.value)
            id = this.execute_(cmd)
        }
        return new ShadowRootPromise(this.driver_, id)
    }

    async findElements(locator: any) {
        locator = by.checkedLocator(locator)
        if (typeof locator === 'function') {
            return this.driver_.findElementsInternal_(locator, this)
        } else {
            let cmd = new command.Command(command.Name.FIND_ELEMENTS_FROM_SHADOWROOT)
                .setParameter('using', locator.using)
                .setParameter('value', locator.value)
            let result = await this.execute_(cmd)
            return Array.isArray(result) ? result : []
        }
    }

    getId() {
        return this.id_
    }
}


class ShadowRootPromise extends ShadowRoot {
    private then: any;
    private catch: any;
    /**
     * @param {!WebDriver} driver The parent WebDriver instance for this
     *     element.
     * @param {!Promise<!ShadowRoot>} shadow A promise
     *     that will resolve to the promised element.
     */
    constructor(driver: WebDriver, shadow: Promise<ShadowRoot>) {
        super(driver, 'unused')

        /** @override */
        this.then = shadow.then.bind(shadow)

        /** @override */
        this.catch = shadow.catch.bind(shadow)

        /**
         * Defers returning the ShadowRoot ID until the wrapped WebElement has been
         * resolved.
         * @override
         */
        this.getId = function () {
            return shadow.then(function (shadow) {
                return shadow.getId()
            })
        }
    }
}

class Alert {
    private driver_: WebDriver;
    private readonly text_: Promise<string>;
    /**
     * @param {!WebDriver} driver The driver controlling the browser this alert
     *     is attached to.
     * @param {string} text The message text displayed with this alert.
     */
    constructor(driver: WebDriver, text: string) {
        /** @private {!WebDriver} */
        this.driver_ = driver

        /** @private {!Promise<string>} */
        this.text_ = Promise.resolve(text)
    }

    /**
     * Retrieves the message text displayed with this alert. For instance, if the
     * alert were opened with alert("hello"), then this would return "hello".
     *
     * @return {!Promise<string>} A promise that will be
     *     resolved to the text displayed with this alert.
     */
    getText() {
        return this.text_
    }

    /**
     * Accepts this alert.
     *
     * @return {!Promise<void>} A promise that will be resolved
     *     when this command has completed.
     */
    accept() {
        return this.driver_.execute(new command.Command(command.Name.ACCEPT_ALERT))
    }

    /**
     * Dismisses this alert.
     *
     * @return {!Promise<void>} A promise that will be resolved
     *     when this command has completed.
     */
    dismiss() {
        return this.driver_.execute(new command.Command(command.Name.DISMISS_ALERT))
    }

    /**
     * Sets the response text on this alert. This command will return an error if
     * the underlying alert does not support response text (e.g. window.alert and
     * window.confirm).
     *
     * @param {string} text The text to set.
     * @return {!Promise<void>} A promise that will be resolved
     *     when this command has completed.
     */
    sendKeys(text: any) {
        return this.driver_.execute(
            new command.Command(command.Name.SET_ALERT_TEXT).setParameter(
                'text',
                text
            )
        )
    }
}


class AlertPromise extends Alert {
    private then: any;
    private catch: any;
    /**
     * @param {!WebDriver} driver The driver controlling the browser this
     *     alert is attached to.
     * @param {!Promise<!Alert>} alert A thenable
     *     that will be fulfilled with the promised alert.
     */
    constructor(driver: WebDriver, alert: Promise<Alert>) {
        super(driver, 'unused')

        /** @override */
        this.then = alert.then.bind(alert)

        /** @override */
        this.catch = alert.catch.bind(alert)

        /**
         * Defer returning text until the promised alert has been resolved.
         * @override
         */
        this.getText = function () {
            return alert.then(function (alert) {
                return alert.getText()
            })
        }

        /**
         * Defers action until the alert has been located.
         * @override
         */
        this.accept = function () {
            return alert.then(function (alert) {
                return alert.accept()
            })
        }

        /**
         * Defers action until the alert has been located.
         * @override
         */
        this.dismiss = function () {
            return alert.then(function (alert) {
                return alert.dismiss()
            })
        }

        /**
         * Defers action until the alert has been located.
         * @override
         */
        this.sendKeys = function (text) {
            return alert.then(function (alert) {
                return alert.sendKeys(text)
            })
        }
    }
}



const LEGACY_ELEMENT_ID_KEY = 'ELEMENT'
const ELEMENT_ID_KEY = 'element-6066-11e4-a52e-4f735466cecf'
const SHADOW_ROOT_ID_KEY = 'shadow-6066-11e4-a52e-4f735466cecf'

export {
    Alert,
    AlertPromise,
    Condition,
    Logs,
    Navigation,
    Options,
    ShadowRoot,
    TargetLocator,
    IWebDriver,
    WebDriver,
    WebElement,
    WebElementCondition,
    WebElementPromise,
    Window
}
