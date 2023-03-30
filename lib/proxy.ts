
const Type = {
  AUTODETECT: 'autodetect',
  DIRECT: 'direct',
  MANUAL: 'manual',
  PAC: 'pac',
  SYSTEM: 'system',
}

/**
 * Describes how a proxy should be configured for a WebDriver session.
 * @record
 */
function Config() {}

/**
 * The proxy type.
 * @type {Type}
 */
Config.prototype.proxyType

/**
 * Describes how to configure a PAC proxy.
 * @record
 * @extends {Config}
 */
function PacConfig() {}

/**
 * URL for the PAC file to use.
 *
 * @type {string}
 */
PacConfig.prototype.proxyAutoconfigUrl

/**
 * Record object that defines a manual proxy configuration. Manual
 * configurations can be easily created using either the
 * {@link ./proxy.manual proxy.manual()} or {@link ./proxy.socks proxy.socks()}
 * factory method.
 *
 * @record
 * @extends {Config}
 */
function ManualConfig() {}

/**
 * The proxy host for FTP requests.
 *
 * @type {(string|undefined)}
 */
ManualConfig.prototype.ftpProxy

/**
 * The proxy host for HTTP requests.
 *
 * @type {(string|undefined)}
 */
ManualConfig.prototype.httpProxy

/**
 * An array of hosts which should bypass all proxies.
 *
 * @type {(Array<string>|undefined)}
 */
ManualConfig.prototype.noProxy

/**
 * The proxy host for HTTPS requests.
 *
 * @type {(string|undefined)}
 */
ManualConfig.prototype.sslProxy

/**
 * Defines the host and port for the SOCKS proxy to use.
 *
 * @type {(number|undefined)}
 */
ManualConfig.prototype.socksProxy

/**
 * Defines the SOCKS proxy version. Must be a number in the range [0, 255].
 *
 * @type {(number|undefined)}
 */
ManualConfig.prototype.socksVersion

// PUBLIC API

/** @const */ exports.Config = Config
/** @const */ exports.ManualConfig = ManualConfig
/** @const */ exports.PacConfig = PacConfig
/** @const */ exports.Type = Type

/**
 * Configures WebDriver to bypass all browser proxies.
 * @return {!Config} A new proxy configuration object.
 */
export function direct() {
  return { proxyType: Type.DIRECT }
}

// @ts-ignore
export function manual({ ftp, http, https, bypass }) {
  return {
    proxyType: Type.MANUAL,
    ftpProxy: ftp,
    httpProxy: http,
    sslProxy: https,
    noProxy: bypass,
  }
}

/**
 * Creates a proxy configuration for a socks proxy.
 *
 * __Example:__
 *
 *     const {Capabilities} = require('selenium-webdriver');
 *     const proxy = require('selenium-webdriver/lib/proxy');
 *
 *     let capabilities = new Capabilities();
 *     capabilities.setProxy(proxy.socks('localhost:1234'));
 *
 *     // Or, to include authentication.
 *     capabilities.setProxy(proxy.socks('bob:password@localhost:1234'));
 *
 *
 * @param {string} socksProxy The proxy host, in the form `hostname:port`.
 * @param {number=} socksVersion The SOCKS proxy version.
 * @return {!ManualConfig} A new proxy configuration object.
 * @see https://en.wikipedia.org/wiki/SOCKS
 */
export function socks(socksProxy: any, socksVersion: any) {
  return /** @type {!Config} */ ({
    proxyType: Type.MANUAL,
    socksProxy,
    socksVersion,
  })
}

/**
 * Configures WebDriver to configure the browser proxy using the PAC file at
 * the given URL.
 * @param {string} proxyAutoconfigUrl URL for the PAC proxy to use.
 * @return {!PacConfig} A new proxy configuration object.
 */
export function pac(proxyAutoconfigUrl: any) {
  return { proxyType: Type.PAC, proxyAutoconfigUrl }
}

/**
 * Configures WebDriver to use the current system's proxy.
 * @return {!Config} A new proxy configuration object.
 */
export function system() {
  return { proxyType: Type.SYSTEM }
}
