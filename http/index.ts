
import http from 'node:http'
import https from 'node:https'
import url,{ UrlWithStringQuery } from 'node:url'

const httpLib = require('../lib/http')
export function getRequestOptions(aUrl: string) {
  let options = url.parse(aUrl)
  if (!options.hostname) {
    throw new Error('Invalid URL: ' + aUrl)
  }

  options.search = null
  options.hash = null
  options.path = options.pathname
  return options
}

const PLATFORM = {
  darwin: "mac",
  win32: 'windows',
  linux: 'linux',
  aix: 'aix',
  freebsd:  'freebsd',
  openbsd: 'openbsd',
  sunos: 'sunos',
  android: 'android',
  haiku :'haiku',
  cygwin: 'cygwin',
  netbsd: 'netbsd',
}

const USER_AGENT: string = (function () {
  const version = require('../package.json').version
  const platform  = PLATFORM[process.platform]
  return `selenium/${version} (js ${platform})`
})()

export class HttpClient {
  private readonly agent_: any;
  private options_: UrlWithStringQuery;
  private readonly client_options: {[key: string]: string };
  private readonly proxyOptions_: UrlWithStringQuery;

  constructor(serverUrl: string, opt_agent: any, opt_proxy: string, client_options: { [key: string]: string } ) {
    this.agent_ = opt_agent || null

    this.options_ = getRequestOptions(serverUrl)

    this.client_options = client_options

    this.keepAlive = this.client_options['keep-alive']

    this.proxyOptions_ = opt_proxy ? getRequestOptions(opt_proxy) : null
  }

  get keepAlive() {
    return this.agent_.keepAlive
  }

  set keepAlive(value) {
    if (value === 'true' || value === true) {
      this.agent_.keepAlive = true
    }
  }

  send(httpRequest: { headers: any[]; method: string; data: any; path: string }) {
    let data: string | NodeJS.ArrayBufferView | ArrayBuffer

    let headers :{[key: string]: string|boolean|number } = {}

    if (httpRequest.headers) {
      httpRequest.headers.forEach(function (value, name) {
        headers[name] = value
      })
    }

    headers['User-Agent'] = this.client_options['user-agent'] || USER_AGENT
    headers['Content-Length'] = 0
    if (httpRequest.method == 'POST' || httpRequest.method == 'PUT') {
      data = JSON.stringify(httpRequest.data)
      headers['Content-Length'] = Buffer.byteLength(data, 'utf8')
      headers['Content-Type'] = 'application/json;charset=UTF-8'
    }

    let path = this.options_.path
    if (path.endsWith('/') && httpRequest.path.startsWith('/')) {
      path += httpRequest.path.substring(1)
    } else {
      path += httpRequest.path
    }

    let parsedPath = url.parse(path)

    let options = {
      agent: this.agent_ || null,
      method: httpRequest.method,

      auth: this.options_.auth,
      hostname: this.options_.hostname,
      port: this.options_.port,
      protocol: this.options_.protocol,

      path: parsedPath.path,
      pathname: parsedPath.pathname,
      search: parsedPath.search,
      hash: parsedPath.hash,

      headers,
    }

    return new Promise((fulfill, reject) => {
      sendRequest(options, fulfill, reject, data, this.proxyOptions_)
    })
  }
}

export function sendRequest(options:{[key:string]: any}, onOk:any, onError: any, opt_data: any, opt_proxy: url.UrlWithStringQuery, opt_retries?: number) {
  const hostname = options.hostname
  const port = options.port

  if (opt_proxy) {
    let proxy = opt_proxy

    let absoluteUri = url.format(options)

    // RFC 2616, section 14.23:
    // An HTTP/1.1 proxy MUST ensure that any request message it forwards does
    // contain an appropriate Host header field that identifies the service
    // being requested by the proxy.
    let targetHost = options.hostname
    if (options.port) {
      targetHost += ':' + options.port
    }

    // Update the request options with our proxy info.
    options.headers['Host'] = targetHost
    options.path = absoluteUri
    options.host = proxy.host
    options.hostname = proxy.hostname
    options.port = proxy.port

    // Update the protocol to avoid EPROTO errors when the webdriver proxy
    // uses a different protocol from the remote selenium server.
    options.protocol = opt_proxy.protocol

    if (proxy.auth) {
      options.headers['Proxy-Authorization'] =
        'Basic ' + Buffer.from(proxy.auth).toString('base64')
    }
  }

  let requestFn = options.protocol === 'https:' ? https.request : http.request
  const request = requestFn(options, function onResponse(response) {
    if (response.statusCode == 302 || response.statusCode == 303) {
      let location
      try {
        // eslint-disable-next-line node/no-deprecated-api
        location = url.parse(response.headers['location'])
      } catch (ex) {
        onError(
          Error(
            'Failed to parse "Location" header for server redirect: ' +
              ex.message +
              '\nResponse was: \n' +
              new httpLib.Response(response.statusCode, response.headers, '')
          )
        )
        return
      }

      if (!location.hostname) {
        location.hostname = hostname
        location.port = port
        location.auth = options.auth
      }

      request.destroy()
      sendRequest(
        {
          method: 'GET',
          protocol: location.protocol || options.protocol,
          hostname: location.hostname,
          port: location.port,
          path: location.path,
          auth: location.auth,
          pathname: location.pathname,
          search: location.search,
          hash: location.hash,
          headers: {
            Accept: 'application/json; charset=utf-8',
            'User-Agent': options.headers['User-Agent'] || USER_AGENT,
          },
        },
        onOk,
        onError,
        undefined,
        opt_proxy
      )
      return
    }

    const body: any[] = []
    response.on('data', body.push.bind(body))
    response.on('end', function () {
      const resp = new httpLib.Response(
        /** @type {number} */ (response.statusCode),
        /** @type {!Object<string>} */ (response.headers),
        Buffer.concat(body).toString('utf8').replace(/\0/g, '')
      )
      onOk(resp)
    })
  })

  request.on('error', function (e) {
    if (typeof opt_retries === 'undefined') {
      opt_retries = 0
    }

    if (shouldRetryRequest(opt_retries, e)) {
      opt_retries += 1
      setTimeout(function () {
        sendRequest(options, onOk, onError, opt_data, opt_proxy, opt_retries)
      }, 15)
    } else {
      let message = e.message
      // @ts-ignore
      if (e.code) {
        // @ts-ignore
        message = e.code + ' ' + message
      }
      onError(new Error(message))
    }
  })

  if (opt_data) {
    request.write(opt_data)
  }

  request.end()
}

const MAX_RETRIES = 3

export function shouldRetryRequest(retries: number, err: any) {
  return retries < MAX_RETRIES && isRetryableNetworkError(err)
}

export function isRetryableNetworkError(err: { code: string }) {
  if (err && err.code) {
    return (
      err.code === 'ECONNABORTED' ||
      err.code === 'ECONNRESET' ||
      err.code === 'ECONNREFUSED' ||
      err.code === 'EADDRINUSE' ||
      err.code === 'EPIPE' ||
      err.code === 'ETIMEDOUT'
    )
  }

  return false
}

