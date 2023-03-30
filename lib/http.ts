import path from 'node:path'
import * as cmd from './command'
import * as error from './error'
import logging from './logging'
import * as promise from './promise'
import {Session} from './session'
import * as webElement from './webelement'
import {isObject} from './util'

const getAttribute = requireAtom(
  'get-attribute.js',
  '//javascript/node/selenium-webdriver/lib/atoms:get-attribute.js'
)
const isDisplayed = requireAtom(
  'is-displayed.js',
  '//javascript/node/selenium-webdriver/lib/atoms:is-displayed.js'
)
const findElements = requireAtom(
  'find-elements.js',
  '//javascript/node/selenium-webdriver/lib/atoms:find-elements.js'
)

function requireAtom(module: string, bazelTarget: string) {
  try {
    return require('./atoms/' + module)
  } catch (ex) {
    try {
      const file = bazelTarget.slice(2).replace(':', '/')
      console.log(`../../../bazel-bin/${file}`)
      return require(path.resolve(`../../../bazel-bin/${file}`))
    } catch (ex2) {
      console.log(ex2)
      throw Error(
        `Failed to import atoms module ${module}. If running in dev mode, you` +
          ` need to run \`bazel build ${bazelTarget}\` from the project` +
          `root: ${ex}`
      )
    }
  }
}

function headersToString(headers: any) {
  const ret: string[] = []
  headers.forEach(function (value: any, name: string) {
    ret.push(`${name.toLowerCase()}: ${value}`)
  })
  return ret.join('\n')
}

class Request {
  private readonly method: any;
  private readonly path: any;
  private readonly data: any;
  private readonly headers: Map<string, string>;
  constructor(method: any, path: any, opt_data: any) {
    this.method = /** string */ method
    this.path = /** string */ path
    this.data = /** Object */ opt_data
    this.headers = /** !Map<string, string> */ new Map([
      ['Accept', 'application/json; charset=utf-8'],
    ])
  }

  /** @override */
  toString() {
    let ret = `${this.method} ${this.path} HTTP/1.1\n`
    ret += headersToString(this.headers) + '\n\n'
    if (this.data) {
      ret += JSON.stringify(this.data)
    }
    return ret
  }
}

/**
 * Represents a HTTP response message.
 * @final
 */
class Response {
  private readonly status: any;
  private readonly headers: Map<any, any>;
  private readonly body: any;
  constructor(status: any, headers: { [x: string]: any }, body: any) {
    this.status = /** number */ status
    this.body = /** string */ body
    this.headers = /** !Map<string, string>*/ new Map()
    for (let header in headers) {
      this.headers.set(header.toLowerCase(), headers[header])
    }
  }

  /** @override */
  toString() {
    let ret = `HTTP/1.1 ${this.status}\n${headersToString(this.headers)}\n\n`
    if (this.body) {
      ret += this.body
    }
    return ret
  }
}

/** @enum {!Function} */
const Atom = {
  GET_ATTRIBUTE: getAttribute,
  IS_DISPLAYED: isDisplayed,
  FIND_ELEMENTS: findElements,
}

const LOG = logging.getLogger('webdriver.http')

function post(path: string) {
  return resource('POST', path)
}
function del(path: string) {
  return resource('DELETE', path)
}
function get(path: string) {
  return resource('GET', path)
}
function resource(method: string, path: string) {
  return { method: method, path: path }
}

/** @typedef {{method: string, path: string}} */
let CommandSpec // eslint-disable-line

/** @typedef {function(!cmd.Command): !cmd.Command} */
let CommandTransformer // eslint-disable-line

class InternalTypeError extends TypeError {}

function toExecuteAtomCommand(command: { getParameter: (arg0: string) => any }, atom: any, ...params: string[]) {
  if (typeof atom !== 'function') {
    throw new InternalTypeError('atom is not a function: ' + typeof atom)
  }

  return new cmd.Command(cmd.Name.EXECUTE_SCRIPT)
    .setParameter('sessionId', command.getParameter('sessionId'))
    .setParameter('script', `return (${atom}).apply(null, arguments)`)
    .setParameter(
      'args',
      params.map((param) => command.getParameter(param))
    )
}

const W3C_COMMAND_MAP = new Map<string,any>([
  // Session management.
  [cmd.Name.NEW_SESSION, post('/session')],
  [cmd.Name.QUIT, del('/session/:sessionId')],

  // Server status.
  [cmd.Name.GET_SERVER_STATUS, get('/status')],

  // timeouts
  [cmd.Name.GET_TIMEOUT, get('/session/:sessionId/timeouts')],
  [cmd.Name.SET_TIMEOUT, post('/session/:sessionId/timeouts')],

  // Navigation.
  [cmd.Name.GET_CURRENT_URL, get('/session/:sessionId/url')],
  [cmd.Name.GET, post('/session/:sessionId/url')],
  [cmd.Name.GO_BACK, post('/session/:sessionId/back')],
  [cmd.Name.GO_FORWARD, post('/session/:sessionId/forward')],
  [cmd.Name.REFRESH, post('/session/:sessionId/refresh')],

  // Page inspection.
  [cmd.Name.GET_PAGE_SOURCE, get('/session/:sessionId/source')],
  [cmd.Name.GET_TITLE, get('/session/:sessionId/title')],

  // Script execution.
  [cmd.Name.EXECUTE_SCRIPT, post('/session/:sessionId/execute/sync')],
  [cmd.Name.EXECUTE_ASYNC_SCRIPT, post('/session/:sessionId/execute/async')],

  // Frame selection.
  [cmd.Name.SWITCH_TO_FRAME, post('/session/:sessionId/frame')],
  [cmd.Name.SWITCH_TO_FRAME_PARENT, post('/session/:sessionId/frame/parent')],

  // Window management.
  [cmd.Name.GET_CURRENT_WINDOW_HANDLE, get('/session/:sessionId/window')],
  [cmd.Name.CLOSE, del('/session/:sessionId/window')],
  [cmd.Name.SWITCH_TO_WINDOW, post('/session/:sessionId/window')],
  [cmd.Name.SWITCH_TO_NEW_WINDOW, post('/session/:sessionId/window/new')],
  [cmd.Name.GET_WINDOW_HANDLES, get('/session/:sessionId/window/handles')],
  [cmd.Name.GET_WINDOW_RECT, get('/session/:sessionId/window/rect')],
  [cmd.Name.SET_WINDOW_RECT, post('/session/:sessionId/window/rect')],
  [cmd.Name.MAXIMIZE_WINDOW, post('/session/:sessionId/window/maximize')],
  [cmd.Name.MINIMIZE_WINDOW, post('/session/:sessionId/window/minimize')],
  [cmd.Name.FULLSCREEN_WINDOW, post('/session/:sessionId/window/fullscreen')],

  // Actions.
  [cmd.Name.ACTIONS, post('/session/:sessionId/actions')],
  [cmd.Name.CLEAR_ACTIONS, del('/session/:sessionId/actions')],
  [cmd.Name.PRINT_PAGE, post('/session/:sessionId/print')],

  // Locating elements.
  [cmd.Name.GET_ACTIVE_ELEMENT, get('/session/:sessionId/element/active')],
  [cmd.Name.FIND_ELEMENT, post('/session/:sessionId/element')],
  [cmd.Name.FIND_ELEMENTS, post('/session/:sessionId/elements')],
  [
    cmd.Name.FIND_ELEMENTS_RELATIVE,
    (cmd: { getParameter: (arg0: string) => any }) => {
      return toExecuteAtomCommand(cmd, Atom.FIND_ELEMENTS, 'args')
    },
  ],
  [
    cmd.Name.FIND_CHILD_ELEMENT,
    post('/session/:sessionId/element/:id/element'),
  ],
  [
    cmd.Name.FIND_CHILD_ELEMENTS,
    post('/session/:sessionId/element/:id/elements'),
  ],
  // Element interaction.
  [cmd.Name.GET_ELEMENT_TAG_NAME, get('/session/:sessionId/element/:id/name')],
  [
    cmd.Name.GET_DOM_ATTRIBUTE,
    get('/session/:sessionId/element/:id/attribute/:name'),
  ],
  [
    cmd.Name.GET_ELEMENT_ATTRIBUTE,
    (cmd: { getParameter: (arg0: string) => any }) => {
      return toExecuteAtomCommand(cmd, Atom.GET_ATTRIBUTE, 'id', 'name')
    },
  ],
  [
    cmd.Name.GET_ELEMENT_PROPERTY,
    get('/session/:sessionId/element/:id/property/:name'),
  ],
  [
    cmd.Name.GET_ELEMENT_VALUE_OF_CSS_PROPERTY,
    get('/session/:sessionId/element/:id/css/:propertyName'),
  ],
  [cmd.Name.GET_ELEMENT_RECT, get('/session/:sessionId/element/:id/rect')],
  [cmd.Name.CLEAR_ELEMENT, post('/session/:sessionId/element/:id/clear')],
  [cmd.Name.CLICK_ELEMENT, post('/session/:sessionId/element/:id/click')],
  [
    cmd.Name.SEND_KEYS_TO_ELEMENT,
    post('/session/:sessionId/element/:id/value'),
  ],
  [cmd.Name.GET_ELEMENT_TEXT, get('/session/:sessionId/element/:id/text')],
  [
    cmd.Name.GET_COMPUTED_ROLE,
    get('/session/:sessionId/element/:id/computedrole'),
  ],
  [
    cmd.Name.GET_COMPUTED_LABEL,
    get('/session/:sessionId/element/:id/computedlabel'),
  ],
  [cmd.Name.IS_ELEMENT_ENABLED, get('/session/:sessionId/element/:id/enabled')],
  [
    cmd.Name.IS_ELEMENT_SELECTED,
    get('/session/:sessionId/element/:id/selected'),
  ],

  [
    cmd.Name.IS_ELEMENT_DISPLAYED,
    (cmd: { getParameter: (arg0: string) => any }) => {
      return toExecuteAtomCommand(cmd, Atom.IS_DISPLAYED, 'id')
    },
  ],

  // Cookie management.
  [cmd.Name.GET_ALL_COOKIES, get('/session/:sessionId/cookie')],
  [cmd.Name.ADD_COOKIE, post('/session/:sessionId/cookie')],
  [cmd.Name.DELETE_ALL_COOKIES, del('/session/:sessionId/cookie')],
  [cmd.Name.GET_COOKIE, get('/session/:sessionId/cookie/:name')],
  [cmd.Name.DELETE_COOKIE, del('/session/:sessionId/cookie/:name')],

  // Alert management.
  [cmd.Name.ACCEPT_ALERT, post('/session/:sessionId/alert/accept')],
  [cmd.Name.DISMISS_ALERT, post('/session/:sessionId/alert/dismiss')],
  [cmd.Name.GET_ALERT_TEXT, get('/session/:sessionId/alert/text')],
  [cmd.Name.SET_ALERT_TEXT, post('/session/:sessionId/alert/text')],

  // Screenshots.
  [cmd.Name.SCREENSHOT, get('/session/:sessionId/screenshot')],
  [
    cmd.Name.TAKE_ELEMENT_SCREENSHOT,
    get('/session/:sessionId/element/:id/screenshot'),
  ],

  // Shadow Root
  [cmd.Name.GET_SHADOW_ROOT, get('/session/:sessionId/element/:id/shadow')],
  [
    cmd.Name.FIND_ELEMENT_FROM_SHADOWROOT,
    post('/session/:sessionId/shadow/:id/element'),
  ],
  [
    cmd.Name.FIND_ELEMENTS_FROM_SHADOWROOT,
    post('/session/:sessionId/shadow/:id/elements'),
  ],
  // Log extensions.
  [cmd.Name.GET_LOG, post('/session/:sessionId/se/log')],
  [cmd.Name.GET_AVAILABLE_LOG_TYPES, get('/session/:sessionId/se/log/types')],

  // Server Extensions
  [cmd.Name.UPLOAD_FILE, post('/session/:sessionId/se/file')],

  // Virtual Authenticator
  [
    cmd.Name.ADD_VIRTUAL_AUTHENTICATOR,
    post('/session/:sessionId/webauthn/authenticator'),
  ],
  [
    cmd.Name.REMOVE_VIRTUAL_AUTHENTICATOR,
    del('/session/:sessionId/webauthn/authenticator/:authenticatorId'),
  ],
  [
    cmd.Name.ADD_CREDENTIAL,
    post(
      '/session/:sessionId/webauthn/authenticator/:authenticatorId/credential'
    ),
  ],
  [
    cmd.Name.GET_CREDENTIALS,
    get(
      '/session/:sessionId/webauthn/authenticator/:authenticatorId/credentials'
    ),
  ],
  [
    cmd.Name.REMOVE_CREDENTIAL,
    del(
      '/session/:sessionId/webauthn/authenticator/:authenticatorId/credentials/:credentialId'
    ),
  ],
  [
    cmd.Name.REMOVE_ALL_CREDENTIALS,
    del(
      '/session/:sessionId/webauthn/authenticator/:authenticatorId/credentials'
    ),
  ],
  [
    cmd.Name.SET_USER_VERIFIED,
    post('/session/:sessionId/webauthn/authenticator/:authenticatorId/uv'),
  ],
])

/**
 * Handles sending HTTP messages to a remote end.
 *
 * @interface
 */
class Client {
  private _httpRequest: any;
  send(httpRequest: any) {
    this._httpRequest = httpRequest;
  }
}

function buildRequest(customCommands: any, command: { getName: any; getParameters?: any }) {
  LOG.finest(() => `Translating command: ${command.getName()}`)
  let spec = customCommands && customCommands.get(command.getName())
  if (spec) {
    return toHttpRequest(spec)
  }

  spec = W3C_COMMAND_MAP.get(command.getName())
  if (typeof spec === 'function') {
    LOG.finest(() => `Transforming command for W3C: ${command.getName()}`)
    let newCommand = spec(command)
    return buildRequest(customCommands, newCommand)
  } else if (spec) {
    return toHttpRequest(spec)
  }
  throw new error.UnknownCommandError(
    'Unrecognized command: ' + command.getName()
  )

  /**
   * @param {CommandSpec} resource
   * @return {!Request}
   */
  function toHttpRequest(resource: { path: any; method: any }) {
    LOG.finest(() => `Building HTTP request: ${JSON.stringify(resource)}`)
    let parameters = command.getParameters()
    let path = buildPath(resource.path, parameters)
    return new Request(resource.method, path, parameters)
  }
}

const CLIENTS =
  /** !WeakMap<!Executor, !(Client|IThenable<!Client>)> */ new WeakMap()

/**
 * A command executor that communicates with the server using JSON over HTTP.
 *
 * By default, each instance of this class will use the legacy wire protocol
 * from [Selenium project][json]. The executor will automatically switch to the
 * [W3C wire protocol][w3c] if the remote end returns a compliant response to
 * a new session command.
 *
 * [json]: https://github.com/SeleniumHQ/selenium/wiki/JsonWireProtocol
 * [w3c]: https://w3c.github.io/webdriver/webdriver-spec.html
 *
 * @implements {cmd.Executor}
 */
class Executor {
  private customCommands_: Map<any, any>;
  private log_: any;
  private w3c: any;
  /**
   * @param {!(Client|IThenable<!Client>)} client The client to use for sending
   *     requests to the server, or a promise-like object that will resolve
   *     to the client.
   */
  constructor(client:any) {
    CLIENTS.set(this, client)

    /** @private {Map<string, CommandSpec>} */
    this.customCommands_ = null

    /** @private {!logging.Logger} */
    this.log_ = logging.getLogger('webdriver.http.Executor')
  }

  defineCommand(name: any, method: any, path: any) {
    if (!this.customCommands_) {
      this.customCommands_ = new Map()
    }
    this.customCommands_.set(name, { method, path })
  }

  /** @override */
  async execute(command: { getName: any }) {
    let request = buildRequest(this.customCommands_, command)
    this.log_.finer(() => `>>> ${request.method} ${request.path}`)

    let client = CLIENTS.get(this)
    if (promise.isPromise(client)) {
      client = await client
      CLIENTS.set(this, client)
    }

    let response = await client.send(request)
    this.log_.finer(() => `>>>\n${request}\n<<<\n${response}`)

    let httpResponse = /** @type {!Response} */ (response)

    let { isW3C, value } = parseHttpResponse(command, httpResponse)

    if (command.getName() === cmd.Name.NEW_SESSION) {
      if (!value || !value.sessionId) {
        throw new error.WebDriverError(
          `Unable to parse new session response: ${response.body}`
        )
      }

      // The remote end is a W3C compliant server if there is no `status`
      // field in the response.
      if (command.getName() === cmd.Name.NEW_SESSION) {
        this.w3c = this.w3c || isW3C
      }

      // No implementations use the `capabilities` key yet...
      let capabilities = value.capabilities || value.value
      return new Session(
        /** @type {{sessionId: string}} */ (value).sessionId,
        capabilities
      )
    }

    return typeof value === 'undefined' ? null : value
  }
}

/**
 * @param {string} str .
 * @return {?} .
 */
function tryParse(str: string) {
  try {
    return JSON.parse(str)
  } catch (ignored) {
    // Do nothing.
  }
}

/**
 * Callback used to parse {@link Response} objects from a
 * {@link HttpClient}.
 *
 * @param {!cmd.Command} command The command the response is for.
 * @param {!Response} httpResponse The HTTP response to parse.
 * @return {{isW3C: boolean, value: ?}} An object describing the parsed
 *     response. This object will have two fields: `isW3C` indicates whether
 *     the response looks like it came from a remote end that conforms with the
 *     W3C WebDriver spec, and `value`, the actual response value.
 * @throws {WebDriverError} If the HTTP response is an error.
 */
function parseHttpResponse(command: { getName: () => string }, httpResponse: { status: number; body: string }) {
  if (httpResponse.status < 200) {
    // This should never happen, but throw the raw response so users report it.
    throw new error.WebDriverError(`Unexpected HTTP response:\n${httpResponse}`)
  }

  let parsed = tryParse(httpResponse.body)

  if (parsed && typeof parsed === 'object') {
    let value = parsed.value
    let isW3C = isObject(value) && typeof parsed.status === 'undefined'

    if (!isW3C) {
      error.checkLegacyResponse(parsed)

      // Adjust legacy new session responses to look like W3C to simplify
      // later processing.
      if (command.getName() === cmd.Name.NEW_SESSION) {
        value = parsed
      }
    } else if (httpResponse.status > 399) {
      error.throwDecodedError(value)
    }

    return { isW3C, value }
  }

  if (parsed !== undefined) {
    return { isW3C: false, value: parsed }
  }

  let value = httpResponse.body.replace(/\r\n/g, '\n')

  // 404 represents an unknown command; anything else > 399 is a generic unknown
  // error.
  if (httpResponse.status === 404) {
    throw new error.UnsupportedOperationError(command.getName() + ': ' + value)
  } else if (httpResponse.status >= 400) {
    throw new error.WebDriverError(value)
  }

  return { isW3C: false, value: value || null }
}

/**
 * Builds a fully qualified path using the given set of command parameters. Each
 * path segment prefixed with ':' will be replaced by the value of the
 * corresponding parameter. All parameters spliced into the path will be
 * removed from the parameter map.
 * @param {string} path The original resource path.
 * @param {!Object<*>} parameters The parameters object to splice into the path.
 * @return {string} The modified path.
 */
function buildPath(path: string, parameters: { [x: string]: any }) {
  let pathParameters = path.match(/\/:(\w+)\b/g)
  if (pathParameters) {
    for (let i = 0; i < pathParameters.length; ++i) {
      let key = pathParameters[i].substring(2) // Trim the /:
      if (key in parameters) {
        let value = parameters[key]
        if (webElement.isId(value)) {
          // When inserting a WebElement into the URL, only use its ID value,
          // not the full JSON.
          value = webElement.extractId(value)
        }
        path = path.replace(pathParameters[i], '/' + value)
        delete parameters[key]
      } else {
        throw new error.InvalidArgumentError(
          'Missing required parameter: ' + key
        )
      }
    }
  }
  return path
}
