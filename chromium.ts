import * as http from './http'
import * as io from './io'
import {Capabilities, Capability} from './lib/capabilities'
import * as command from './lib/command'
import * as error from "./lib/error"
import Symbols from './lib/symbols'
import webdriver from './lib/webdriver'
import * as remote from './remote'

const Command = {
  LAUNCH_APP: 'launchApp',
  GET_NETWORK_CONDITIONS: 'getNetworkConditions',
  SET_NETWORK_CONDITIONS: 'setNetworkConditions',
  DELETE_NETWORK_CONDITIONS: 'deleteNetworkConditions',
  SEND_DEVTOOLS_COMMAND: 'sendDevToolsCommand',
  SEND_AND_GET_DEVTOOLS_COMMAND: 'sendAndGetDevToolsCommand',
  SET_PERMISSION: 'setPermission',
  GET_CAST_SINKS: 'getCastSinks',
  SET_CAST_SINK_TO_USE: 'setCastSinkToUse',
  START_CAST_DESKTOP_MIRRORING: 'startDesktopMirroring',
  START_CAST_TAB_MIRRORING: 'setCastTabMirroring',
  GET_CAST_ISSUE_MESSAGE: 'getCastIssueMessage',
  STOP_CASTING: 'stopCasting',
}

function createExecutor(url: Promise<any>, vendorPrefix: any) {
  const agent = new http.Agent({ keepAlive: true })
  const client = url.then((url) => new http.HttpClient(url, agent))
  const executor = new http.Executor(client)
  configureExecutor(executor, vendorPrefix)
  return executor
}

function configureExecutor(executor: { defineCommand: (arg0: string, arg1: string, arg2: string) => void }, vendorPrefix: any) {
  executor.defineCommand(
    Command.LAUNCH_APP,
    'POST',
    '/session/:sessionId/chromium/launch_app'
  )
  executor.defineCommand(
    Command.GET_NETWORK_CONDITIONS,
    'GET',
    '/session/:sessionId/chromium/network_conditions'
  )
  executor.defineCommand(
    Command.SET_NETWORK_CONDITIONS,
    'POST',
    '/session/:sessionId/chromium/network_conditions'
  )
  executor.defineCommand(
    Command.DELETE_NETWORK_CONDITIONS,
    'DELETE',
    '/session/:sessionId/chromium/network_conditions'
  )
  executor.defineCommand(
    Command.SEND_DEVTOOLS_COMMAND,
    'POST',
    '/session/:sessionId/chromium/send_command'
  )
  executor.defineCommand(
    Command.SEND_AND_GET_DEVTOOLS_COMMAND,
    'POST',
    '/session/:sessionId/chromium/send_command_and_get_result'
  )
  executor.defineCommand(
    Command.SET_PERMISSION,
    'POST',
    '/session/:sessionId/permissions'
  )
  executor.defineCommand(
    Command.GET_CAST_SINKS,
    'GET',
    `/session/:sessionId/${vendorPrefix}/cast/get_sinks`
  )
  executor.defineCommand(
    Command.SET_CAST_SINK_TO_USE,
    'POST',
    `/session/:sessionId/${vendorPrefix}/cast/set_sink_to_use`
  )
  executor.defineCommand(
    Command.START_CAST_DESKTOP_MIRRORING,
    'POST',
    `/session/:sessionId/${vendorPrefix}/cast/start_desktop_mirroring`
  )
  executor.defineCommand(
    Command.START_CAST_TAB_MIRRORING,
    'POST',
    `/session/:sessionId/${vendorPrefix}/cast/start_tab_mirroring`
  )
  executor.defineCommand(
    Command.GET_CAST_ISSUE_MESSAGE,
    'GET',
    `/session/:sessionId/${vendorPrefix}/cast/get_issue_message`
  )
  executor.defineCommand(
    Command.STOP_CASTING,
    'POST',
    `/session/:sessionId/${vendorPrefix}/cast/stop_casting`
  )
}

export class ServiceBuilder extends remote.Builder {

  constructor(exe: any) {
    super(exe)
    this.setLoopback(true)
  }

  setAdbPort(port: string) {
    return this.addArguments('--adb-port=' + port)
  }

  loggingTo(path: string) {
    return this.addArguments('--log-path=' + path)
  }

  enableChromeLogging() {
    return this.addArguments('--enable-chrome-logs')
  }

  enableVerboseLogging() {
    return this.addArguments('--verbose')
  }


  setNumHttpThreads(n:any) {
    return this.addArguments('--http-threads=' + n)
  }

  setPath(path: string) {
    super.setPath(path)
    return this.addArguments('--url-base=' + path)
  }
}

export class Options extends Capabilities {
  private readonly options_: any;

  constructor(other = undefined) {
    super(other)

    this.options_ = this.get(this.CAPABILITY_KEY) || {}

    this.setBrowserName(this.BROWSER_NAME_VALUE)
    this.set(this.CAPABILITY_KEY, this.options_)
  }

  addArguments(...args: string[]) {
    let newArgs = (this.options_.args || []).concat(...args)
    if (newArgs.length) {
      this.options_.args = newArgs
    }
    return this
  }

  debuggerAddress(address: any) {
    this.options_.debuggerAddress = address
    return this
  }

  headless() {
    return this.addArguments('headless')
  }

  // @ts-ignore
  windowSize({ width, height }) {
    function checkArg(arg: number) {
      if (typeof arg !== 'number' || arg <= 0) {
        throw TypeError('Arguments must be {width, height} with numbers > 0')
      }
    }
    checkArg(width)
    checkArg(height)
    return this.addArguments(`window-size=${width},${height}`)
  }

  excludeSwitches(...args: any[]) {
    let switches = (this.options_.excludeSwitches || []).concat(...args)
    if (switches.length) {
      this.options_.excludeSwitches = switches
    }
    return this
  }

  addExtensions(...args: any[]) {
    let extensions = this.options_.extensions || new Extensions()
    extensions.add(...args)
    if (extensions.length) {
      this.options_.extensions = extensions
    }
    return this
  }

  setBinaryPath(path: any) {
    this.options_.binary = path
    return this
  }

  detachDriver(detach: any) {
    this.options_.detach = detach
    return this
  }

  setUserPreferences(prefs: any) {
    this.options_.prefs = prefs
    return this
  }


  setPerfLoggingPrefs(prefs:any) {
    this.options_.perfLoggingPrefs = prefs
    return this
  }

  setLocalState(state: any) {
    this.options_.localState = state
    return this
  }

  androidActivity(name: any) {
    this.options_.androidActivity = name
    return this
  }

  androidDeviceSerial(serial: any) {
    this.options_.androidDeviceSerial = serial
    return this
  }

  androidPackage(pkg: any) {
    this.options_.androidPackage = pkg
    return this
  }


  androidProcess(processName: any) {
    this.options_.androidProcess = processName
    return this
  }

  androidUseRunningApp(useRunning: any) {
    this.options_.androidUseRunningApp = useRunning
    return this
  }

  setBrowserLogFile(path: any) {
    this.options_.logPath = path
    return this
  }

  setBrowserMinidumpPath(path: any) {
    this.options_.minidumpPath = path
    return this
  }

  setMobileEmulation(config: any) {
    this.options_.mobileEmulation = config
    return this
  }

  windowTypes(...args: any[]) {
    let windowTypes = (this.options_.windowTypes || []).concat(...args)
    if (windowTypes.length) {
      this.options_.windowTypes = windowTypes
    }
    return this
  }
}

class Extensions {
  private extensions: any[];
  constructor() {
    this.extensions = []
  }

  get length() {
    return this.extensions.length
  }

  add(...args: any[]) {
    this.extensions = this.extensions.concat(...args)
  }

  [Symbols.serialize]() {
    return this.extensions.map(function (extension) {
      if (Buffer.isBuffer(extension)) {
        return extension.toString('base64')
      }
      return io
        .read(/** @type {string} */ (extension))
        .then((buffer: { toString: (arg0: string) => any }) => buffer.toString('base64'))
    })
  }
}

export class Driver extends webdriver.WebDriver {
  static createSession(caps: { get: (arg0: any) => any }, opt_serviceExecutor: any) {
    let executor
    let onQuit
    if (opt_serviceExecutor instanceof http.Executor) {
      executor = opt_serviceExecutor
      configureExecutor(executor, this.VENDOR_COMMAND_PREFIX)
    } else {
      let service = opt_serviceExecutor || this.getDefaultService()
      onQuit = () => service.kill()
      executor = createExecutor(service.start(), this.VENDOR_COMMAND_PREFIX)
    }

    // W3C spec requires noProxy value to be an array of strings, but Chromium
    // expects a single host as a string.
    let proxy = caps.get(Capability.PROXY)
    if (proxy && Array.isArray(proxy.noProxy)) {
      proxy.noProxy = proxy.noProxy[0]
      if (!proxy.noProxy) {
        proxy.noProxy = undefined
      }
    }

    return /** @type {!Driver} */ (super.createSession(executor, caps, onQuit))
  }

  setFileDetector() {}

  launchApp(id: any) {
    return this.execute(
      new command.Command(Command.LAUNCH_APP).setParameter('id', id)
    )
  }

  getNetworkConditions() {
    return this.execute(new command.Command(Command.GET_NETWORK_CONDITIONS))
  }

  deleteNetworkConditions() {
    return this.execute(new command.Command(Command.DELETE_NETWORK_CONDITIONS))
  }

  setNetworkConditions(spec: any) {
    if (!spec || typeof spec !== 'object') {
      throw TypeError(
        'setNetworkConditions called with non-network-conditions parameter'
      )
    }
    return this.execute(
      new command.Command(Command.SET_NETWORK_CONDITIONS).setParameter(
        'network_conditions',
        spec
      )
    )
  }

  sendDevToolsCommand(cmd: string, params = {}) {
    return this.execute(
      new command.Command(Command.SEND_DEVTOOLS_COMMAND)
        .setParameter('cmd', cmd)
        .setParameter('params', params)
    )
  }

  sendAndGetDevToolsCommand(cmd: any, params = {}) {
    return this.execute(
      new command.Command(Command.SEND_AND_GET_DEVTOOLS_COMMAND)
        .setParameter('cmd', cmd)
        .setParameter('params', params)
    )
  }

  setPermission(name: any, state: any) {
    return this.execute(
      new command.Command(Command.SET_PERMISSION)
        .setParameter('descriptor', { name })
        .setParameter('state', state)
    )
  }

  async setDownloadPath(path: string) {
    if (!path || typeof path !== 'string') {
      throw new error.InvalidArgumentError('invalid download path')
    }
    const stat = await io.stat(path)
    if (!stat.isDirectory()) {
      throw new error.InvalidArgumentError('not a directory: ' + path)
    }
    return this.sendDevToolsCommand('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: path,
    })
  }

  getCastSinks() {
    return this.schedule(
      new command.Command(Command.GET_CAST_SINKS),
      'Driver.getCastSinks()'
    )
  }

  setCastSinkToUse(deviceName: string) {
    return this.schedule(
      new command.Command(Command.SET_CAST_SINK_TO_USE).setParameter(
        'sinkName',
        deviceName
      ),
      'Driver.setCastSinkToUse(' + deviceName + ')'
    )
  }

  startDesktopMirroring(deviceName: string) {
    return this.schedule(
      new command.Command(Command.START_CAST_DESKTOP_MIRRORING).setParameter(
        'sinkName',
        deviceName
      ),
      'Driver.startDesktopMirroring(' + deviceName + ')'
    )
  }

  startCastTabMirroring(deviceName: string) {
    return this.schedule(
      new command.Command(Command.START_CAST_TAB_MIRRORING).setParameter(
        'sinkName',
        deviceName
      ),
      'Driver.startCastTabMirroring(' + deviceName + ')'
    )
  }

  getCastIssueMessage() {
    return this.schedule(
      new command.Command(Command.GET_CAST_ISSUE_MESSAGE),
      'Driver.getCastIssueMessage()'
    )
  }

  stopCasting(deviceName) {
    return this.schedule(
      new command.Command(Command.STOP_CASTING).setParameter(
        'sinkName',
        deviceName
      ),
      'Driver.stopCasting(' + deviceName + ')'
    )
  }
}

