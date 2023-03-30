import * as io from './io'
import {Browser} from './lib/capabilities'
import * as chromium from './chromium'


const CHROMEDRIVER_EXE =
  process.platform === 'win32' ? 'chromedriver.exe' : 'chromedriver'

export class ServiceBuilder extends chromium.ServiceBuilder {
  constructor(opt_exe?: any) {
    let exe = opt_exe || locateSynchronously()
    if (!exe) {
      throw Error(
        `The ChromeDriver could not be found on the current PATH. Please ` +
          `download the latest version of the ChromeDriver from ` +
          `http://chromedriver.storage.googleapis.com/index.html and ensure ` +
          `it can be found on your PATH.`
      )
    }
    super(exe)
  }
}

export class Options extends chromium {
  CAPABILITY_KEY: string;
  BROWSER_NAME_VALUE: any;

  setChromeBinaryPath(path:string) {
    return this.setBinaryPath(path)
  }

  androidChrome() {
    return this.androidPackage('com.android.chrome')
  }

  setChromeLogFile(path: string) {
    return this.setBrowserLogFile(path)
  }

  setChromeMinidumpPath(path:string) {
    return this.setBrowserMinidumpPath(path)
  }
}

export class Driver extends chromium.Driver {
  VENDOR_COMMAND_PREFIX: string;

  static createSession(opt_config: Options, opt_serviceExecutor: any) {
    let caps = opt_config || new Options()
    return (
      super.createSession(caps, opt_serviceExecutor)
    )
  }

  static getDefaultService() {
    return new ServiceBuilder().build()
  }
}

export function locateSynchronously() {
  return io.findInPath(CHROMEDRIVER_EXE, true)
}

Options.prototype.CAPABILITY_KEY = 'goog:chromeOptions'
Options.prototype.BROWSER_NAME_VALUE = Browser.CHROME
Driver.prototype.VENDOR_COMMAND_PREFIX = 'goog'
