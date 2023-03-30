
const Executor = require('./index').Executor
const HttpClient = require('./index').HttpClient
const HttpRequest = require('./index').Request
const Command = require('../lib/command').Command
const CommandName = require('../lib/command').Name
const error = require('../lib/error')


export function getStatus(url: any) {
  const client = new HttpClient(url)
  const executor = new Executor(client)
  const command = new Command(CommandName.GET_SERVER_STATUS)
  return executor.execute(command)
}

export class CancellationError {}

export function waitForServer(url: string, timeout: number, opt_cancelToken: Promise<any>) {
  return new Promise((onResolve, onReject) => {
    let start = Date.now()

    let done = false
    let resolve = (status: any) => {
      done = true
      onResolve(status)
    }
    let reject = (err: CancellationError) => {
      done = true
      onReject(err)
    }

    if (opt_cancelToken) {
      opt_cancelToken.then((_) => reject(new CancellationError()))
    }

    checkServerStatus()
    function checkServerStatus() {
      return getStatus(url).then((status: any) => resolve(status), onError)
    }

    function onError(e: any) {
      // Some servers don't support the status command. If they are able to
      // response with an error, then can consider the server ready.
      if (e instanceof error.UnsupportedOperationError) {
        resolve({})
        return
      }

      if (Date.now() - start > timeout) {
        reject(Error('Timed out waiting for the WebDriver server at ' + url))
      } else {
        setTimeout(function () {
          if (!done) {
            checkServerStatus()
          }
        }, 50)
      }
    }
  })
}

export function waitForUrl(url: string, timeout: number, opt_cancelToken: Promise<any>) {
  return new Promise<void>((onResolve, onReject) => {
    let client = new HttpClient(url)
    let request = new HttpRequest('GET', '')
    let start = Date.now()

    let done = false
    let resolve = () => {
      done = true
      onResolve()
    }
    let reject = (err: CancellationError) => {
      done = true
      onReject(err)
    }

    if (opt_cancelToken) {
      opt_cancelToken.then((_) => reject(new CancellationError()))
    }

    testUrl()

    function testUrl() {
      client.send(request).then(onResponse, onError)
    }

    function onError() {
      if (Date.now() - start > timeout) {
        reject(Error('Timed out waiting for the URL to return 2xx: ' + url))
      } else {
        setTimeout(function () {
          if (!done) {
            testUrl()
          }
        }, 50)
      }
    }

    function onResponse(response: { status: number }) {
      if (done) {
        return
      }
      if (response.status > 199 && response.status < 300) {
        resolve()
        return
      }
      onError()
    }
  })
}
