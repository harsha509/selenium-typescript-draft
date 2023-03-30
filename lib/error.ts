
const { isObject } = require('./util')


export class WebDriverError extends Error {
  remoteStacktrace: string;

  constructor(opt_error: string) {
    super(opt_error)

    this.name = this.constructor.name

    this.remoteStacktrace = ''
  }
}

export class DetachedShadowRootError extends WebDriverError {
  constructor(opt_error: string) {
    super(opt_error)
  }
}

export class ElementClickInterceptedError extends WebDriverError {
  constructor(opt_error: string | undefined) {
    super(opt_error)
  }
}


export class ElementNotSelectableError extends WebDriverError {
  constructor(opt_error: string) {
    super(opt_error)
  }
}

export class ElementNotInteractableError extends WebDriverError {

  constructor(opt_error: string) {
    super(opt_error)
  }
}

export class InsecureCertificateError extends WebDriverError {
  constructor(opt_error: string) {
    super(opt_error)
  }
}

export class InvalidArgumentError extends WebDriverError {
  constructor(opt_error: string) {
    super(opt_error)
  }
}

export class InvalidCookieDomainError extends WebDriverError {
  constructor(opt_error: string) {
    super(opt_error)
  }
}

export class InvalidCoordinatesError extends WebDriverError {
  constructor(opt_error: string) {
    super(opt_error)
  }
}

export class InvalidElementStateError extends WebDriverError {
  constructor(opt_error: string) {
    super(opt_error)
  }
}

export class InvalidSelectorError extends WebDriverError {
  constructor(opt_error: string) {
    super(opt_error)
  }
}

export class NoSuchSessionError extends WebDriverError {
  constructor(opt_error: string) {
    super(opt_error)
  }
}

export class JavascriptError extends WebDriverError {
  constructor(opt_error: string) {
    super(opt_error)
  }
}

export class MoveTargetOutOfBoundsError extends WebDriverError {
  constructor(opt_error: string) {
    super(opt_error)
  }
}

export class NoSuchAlertError extends WebDriverError {
  constructor(opt_error: string) {
    super(opt_error)
  }
}

export class NoSuchCookieError extends WebDriverError {
  constructor(opt_error: string) {
    super(opt_error)
  }
}


export class NoSuchElementError extends WebDriverError {
  constructor(opt_error: string) {
    super(opt_error)
  }
}

/**
 * A ShadowRoot could not be located on the element
 */
class NoSuchShadowRootError extends WebDriverError {
  /** @param {string=} opt_error the error message, if any. */
  constructor(opt_error: string | undefined) {
    super(opt_error)
  }
}

/**
 * A request to switch to a frame could not be satisfied because the frame
 * could not be found.
 */
class NoSuchFrameError extends WebDriverError {
  /** @param {string=} opt_error the error message, if any. */
  constructor(opt_error: string ) {
    super(opt_error)
  }
}

/**
 * A request to switch to a window could not be satisfied because the window
 * could not be found.
 */
class NoSuchWindowError extends WebDriverError {
  /** @param {string=} opt_error the error message, if any. */
  constructor(opt_error: string ) {
    super(opt_error)
  }
}

/**
 * A script did not complete before its timeout expired.
 */
class ScriptTimeoutError extends WebDriverError {
  /** @param {string=} opt_error the error message, if any. */
  constructor(opt_error: string ) {
    super(opt_error)
  }
}

/**
 * A new session could not be created.
 */
class SessionNotCreatedError extends WebDriverError {
  /** @param {string=} opt_error the error message, if any. */
  constructor(opt_error: string ) {
    super(opt_error)
  }
}

/**
 * An element command failed because the referenced element is no longer
 * attached to the DOM.
 */
class StaleElementReferenceError extends WebDriverError {
  /** @param {string=} opt_error the error message, if any. */
  constructor(opt_error: string ) {
    super(opt_error)
  }
}

/**
 * An operation did not complete before its timeout expired.
 */
class TimeoutError extends WebDriverError {
  /** @param {string=} opt_error the error message, if any. */
  constructor(opt_error: string ) {
    super(opt_error)
  }
}

/**
 * A request to set a cookie’s value could not be satisfied.
 */
class UnableToSetCookieError extends WebDriverError {
  /** @param {string=} opt_error the error message, if any. */
  constructor(opt_error: string ) {
    super(opt_error)
  }
}

/**
 * A screen capture operation was not possible.
 */
class UnableToCaptureScreenError extends WebDriverError {
  /** @param {string=} opt_error the error message, if any. */
  constructor(opt_error: string ) {
    super(opt_error)
  }
}

/**
 * A modal dialog was open, blocking this operation.
 */
class UnexpectedAlertOpenError extends WebDriverError {
  private readonly text_: string;
  /**
   * @param {string=} opt_error the error message, if any.
   * @param {string=} opt_text the text of the open dialog, if available.
   */
  constructor(opt_error: string | undefined, opt_text: string | undefined) {
    super(opt_error)

    /** @private {(string|undefined)} */
    this.text_ = opt_text
  }

  /**
   * @return {(string|undefined)} The text displayed with the unhandled alert,
   *     if available.
   */
  getAlertText() {
    return this.text_
  }
}

/**
 * A command could not be executed because the remote end is not aware of it.
 */
export class UnknownCommandError extends WebDriverError {
  /** @param {string=} opt_error the error message, if any. */
  constructor(opt_error: string | undefined) {
    super(opt_error)
  }
}

/**
 * The requested command matched a known URL but did not match an method for
 * that URL.
 */
export class UnknownMethodError extends WebDriverError {
  /** @param {string=} opt_error the error message, if any. */
  constructor(opt_error: string | undefined) {
    super(opt_error)
  }
}

/**
 * Reports an unsupported operation.
 */
export class UnsupportedOperationError extends WebDriverError {
  /** @param {string=} opt_error the error message, if any. */
  constructor(opt_error: string | undefined) {
    super(opt_error)
  }
}

// TODO(jleyba): Define UnknownError as an alias of WebDriverError?

/**
 * Enum of legacy error codes.
 * TODO: remove this when all code paths have been switched to the new error
 * types.
 * @deprecated
 * @enum {number}
 */
const ErrorCode = {
  SUCCESS: 0,
  NO_SUCH_SESSION: 6,
  NO_SUCH_ELEMENT: 7,
  NO_SUCH_FRAME: 8,
  UNKNOWN_COMMAND: 9,
  UNSUPPORTED_OPERATION: 9,
  STALE_ELEMENT_REFERENCE: 10,
  ELEMENT_NOT_VISIBLE: 11,
  INVALID_ELEMENT_STATE: 12,
  UNKNOWN_ERROR: 13,
  ELEMENT_NOT_SELECTABLE: 15,
  JAVASCRIPT_ERROR: 17,
  XPATH_LOOKUP_ERROR: 19,
  TIMEOUT: 21,
  NO_SUCH_WINDOW: 23,
  INVALID_COOKIE_DOMAIN: 24,
  UNABLE_TO_SET_COOKIE: 25,
  UNEXPECTED_ALERT_OPEN: 26,
  NO_SUCH_ALERT: 27,
  SCRIPT_TIMEOUT: 28,
  INVALID_ELEMENT_COORDINATES: 29,
  IME_NOT_AVAILABLE: 30,
  IME_ENGINE_ACTIVATION_FAILED: 31,
  INVALID_SELECTOR_ERROR: 32,
  SESSION_NOT_CREATED: 33,
  MOVE_TARGET_OUT_OF_BOUNDS: 34,
  SQL_DATABASE_ERROR: 35,
  INVALID_XPATH_SELECTOR: 51,
  INVALID_XPATH_SELECTOR_RETURN_TYPE: 52,
  ELEMENT_NOT_INTERACTABLE: 60,
  INVALID_ARGUMENT: 61,
  NO_SUCH_COOKIE: 62,
  UNABLE_TO_CAPTURE_SCREEN: 63,
  ELEMENT_CLICK_INTERCEPTED: 64,
  METHOD_NOT_ALLOWED: 405,
}

const LEGACY_ERROR_CODE_TO_TYPE = new Map<any, any>([
  [ErrorCode.NO_SUCH_SESSION, NoSuchSessionError],
  [ErrorCode.NO_SUCH_ELEMENT, NoSuchElementError],
  [ErrorCode.NO_SUCH_FRAME, NoSuchFrameError],
  [ErrorCode.UNSUPPORTED_OPERATION, UnsupportedOperationError],
  [ErrorCode.STALE_ELEMENT_REFERENCE, StaleElementReferenceError],
  [ErrorCode.INVALID_ELEMENT_STATE, InvalidElementStateError],
  [ErrorCode.UNKNOWN_ERROR, WebDriverError],
  [ErrorCode.ELEMENT_NOT_SELECTABLE, ElementNotSelectableError],
  [ErrorCode.JAVASCRIPT_ERROR, JavascriptError],
  [ErrorCode.XPATH_LOOKUP_ERROR, InvalidSelectorError],
  [ErrorCode.TIMEOUT, TimeoutError],
  [ErrorCode.NO_SUCH_WINDOW, NoSuchWindowError],
  [ErrorCode.INVALID_COOKIE_DOMAIN, InvalidCookieDomainError],
  [ErrorCode.UNABLE_TO_SET_COOKIE, UnableToSetCookieError],
  [ErrorCode.UNEXPECTED_ALERT_OPEN, UnexpectedAlertOpenError],
  [ErrorCode.NO_SUCH_ALERT, NoSuchAlertError],
  [ErrorCode.SCRIPT_TIMEOUT, ScriptTimeoutError],
  [ErrorCode.INVALID_ELEMENT_COORDINATES, InvalidCoordinatesError],
  [ErrorCode.INVALID_SELECTOR_ERROR, InvalidSelectorError],
  [ErrorCode.SESSION_NOT_CREATED, SessionNotCreatedError],
  [ErrorCode.MOVE_TARGET_OUT_OF_BOUNDS, MoveTargetOutOfBoundsError],
  [ErrorCode.INVALID_XPATH_SELECTOR, InvalidSelectorError],
  [ErrorCode.INVALID_XPATH_SELECTOR_RETURN_TYPE, InvalidSelectorError],
  [ErrorCode.ELEMENT_NOT_INTERACTABLE, ElementNotInteractableError],
  [ErrorCode.INVALID_ARGUMENT, InvalidArgumentError],
  [ErrorCode.NO_SUCH_COOKIE, NoSuchCookieError],
  [ErrorCode.UNABLE_TO_CAPTURE_SCREEN, UnableToCaptureScreenError],
  [ErrorCode.ELEMENT_CLICK_INTERCEPTED, ElementClickInterceptedError],
  [ErrorCode.METHOD_NOT_ALLOWED, UnsupportedOperationError],
])

const ERROR_CODE_TO_TYPE = new Map<string, any>([
  ['unknown error', WebDriverError],
  ['detached shadow root', DetachedShadowRootError],
  ['element click intercepted', ElementClickInterceptedError],
  ['element not interactable', ElementNotInteractableError],
  ['element not selectable', ElementNotSelectableError],
  ['insecure certificate', InsecureCertificateError],
  ['invalid argument', InvalidArgumentError],
  ['invalid cookie domain', InvalidCookieDomainError],
  ['invalid coordinates', InvalidCoordinatesError],
  ['invalid element state', InvalidElementStateError],
  ['invalid selector', InvalidSelectorError],
  ['invalid session id', NoSuchSessionError],
  ['javascript error', JavascriptError],
  ['move target out of bounds', MoveTargetOutOfBoundsError],
  ['no such alert', NoSuchAlertError],
  ['no such cookie', NoSuchCookieError],
  ['no such element', NoSuchElementError],
  ['no such frame', NoSuchFrameError],
  ['no such shadow root', NoSuchShadowRootError],
  ['no such window', NoSuchWindowError],
  ['script timeout', ScriptTimeoutError],
  ['session not created', SessionNotCreatedError],
  ['stale element reference', StaleElementReferenceError],
  ['timeout', TimeoutError],
  ['unable to set cookie', UnableToSetCookieError],
  ['unable to capture screen', UnableToCaptureScreenError],
  ['unexpected alert open', UnexpectedAlertOpenError],
  ['unknown command', UnknownCommandError],
  ['unknown method', UnknownMethodError],
  ['unsupported operation', UnsupportedOperationError],
])

const TYPE_TO_ERROR_CODE = new Map()
ERROR_CODE_TO_TYPE.forEach((value, key) => {
  TYPE_TO_ERROR_CODE.set(value, key)
})

export function encodeError(err: any) {
  let type = WebDriverError
  if (
    err instanceof WebDriverError &&
    TYPE_TO_ERROR_CODE.has(err.constructor)
  ) {
    // @ts-ignore
    type = err.constructor
  }

  let message = err instanceof Error ? err.message : err + ''

  let code = /** @type {string} */ (TYPE_TO_ERROR_CODE.get(type))
  return { error: code, message: message }
}

export function isErrorResponse(data: { error: any; }) {
  return isObject(data) && typeof data.error === 'string'
}

export function throwDecodedError(data: { error: any; message?: any; stacktrace?: any; stackTrace?: any; }) {
  if (isErrorResponse(data)) {
    let ctor = ERROR_CODE_TO_TYPE.get(data.error) || WebDriverError
    let err = new ctor(data.message)
    if (typeof data.stacktrace === 'string') {
      err.remoteStacktrace = data.stacktrace
    } else if (typeof data.stackTrace === 'string') {
      err.remoteStacktrace = data.stackTrace
    }
    throw err
  }
  throw new WebDriverError('Unknown error: ' + JSON.stringify(data))
}

export function checkLegacyResponse(responseObj: { status: any; value?: any; }) {
  // Handle the legacy Selenium error response format.
  if (
    isObject(responseObj) &&
    typeof responseObj.status === 'number' &&
    responseObj.status !== 0
  ) {
    const { status, value } = responseObj

    let ctor = LEGACY_ERROR_CODE_TO_TYPE.get(status) || WebDriverError

    if (!value || typeof value !== 'object') {
      throw new ctor(value + '')
    } else {
      let message = value['message'] + ''
      // @ts-ignore
      if (ctor !== UnexpectedAlertOpenError) {
        throw new ctor(message)
      }

      let text = ''
      if (value['alert'] && typeof value['alert']['text'] === 'string') {
        text = value['alert']['text']
      }
      throw new UnexpectedAlertOpenError(message, text)
    }
  }
  return responseObj
}


export {
  NoSuchFrameError,
  NoSuchShadowRootError,
  NoSuchWindowError,
  ScriptTimeoutError,
  SessionNotCreatedError,
  StaleElementReferenceError,
  TimeoutError,
  UnableToSetCookieError,
  UnableToCaptureScreenError,
  UnexpectedAlertOpenError,
}