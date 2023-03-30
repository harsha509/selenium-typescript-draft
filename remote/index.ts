import {getAddress, getLoopBackAddress} from "../net";
import {findFreePort} from "../net/portProber";
import * as fs from "node:fs";
import path from "node:path";
import exec from "../io/exec";
import {Zip} from "../io/zip";
import * as input from '../lib/input'
import {stat} from "../io";
import { Command, Name} from "../lib/command";
import {waitForServer, CancellationError} from "../http/util";

interface DriverServiceOptions {
    loopback: boolean;
    hostname: any;
    port: any;
    args: any;
    path: string;
    stdio: string;
    env: any;
    command: null;
    address: null;
}

function resolveCommandLineFlags(args: any) {
    // Resolve the outer array, then the individual flags.
    return Promise.resolve(args).then(
        /** !Array<CommandLineFlag> */ (args) => Promise.all(args)
    )
}

export class ServiceOptions {
    loopback: any;
    hostname: any;
    port: any;
    args: any;
    path: any;
    env: any;
    stdio: any;
}


export class DriverService {

    DEFAULT_START_TIMEOUT_MS = 30 * 1000

    private readonly executable_: string;
    private readonly loopBackOnly_: boolean;
    private readonly hostname_: any;
    private port_: any;
    private args_: any;
    private readonly path_: string;
    private readonly stdio_: string;
    private readonly env_: any;
    private command_: Promise<unknown>;
    private address_: Promise<unknown>;

    constructor(executable: string, options:DriverServiceOptions) {
        this.executable_ = executable

        this.loopBackOnly_ = !!options.loopback

        this.hostname_ = options.hostname

        this.port_ = options.port

        this.args_ = options.args

        this.path_ = options.path || '/'

        this.env_ = options.env || process.env

        this.stdio_ = options.stdio || 'ignore'

        this.command_ = null

        this.address_ = null
    }

    address(): Promise<unknown> {
        if(this.address_) {
            return this.address_
        }
        throw Error(`Server has not been started.`)
    }

    isRunning(): boolean {
        return !!this.address_
    }

    start(opt_timeoutMs?: number):Promise<string|unknown> {
        if(this.address_) {
            return this.address_
        }

        const timeout = opt_timeoutMs ?? this.DEFAULT_START_TIMEOUT_MS

        let resolveCommand: (value: unknown) => void
        this.command_ = new Promise((resolve) => (resolveCommand = resolve))

        this.address_ = new Promise((resolveAddress, rejectAddress) => {
            resolveAddress(
                Promise.resolve(this.port_).then((port) => {
                    if(port <= 0) {
                        throw Error (`Port must be > 0: ${port}`)
                    }

                    return resolveCommandLineFlags(this.args_).then((args: any) => {
                        const command = exec(this.executable_, {
                            args: args,
                            env:this.env_,
                            stdio: this.stdio_
                        })
                        resolveCommand(command)

                        const earlyTermination = command.result().then((result: { code: any; signal: any; }) => {
                            const error = result.code == null
                                ? Error (`Server was killed with ${result.signal}`)
                                : Error(`Server terminated early with status ${result.code}`)
                            rejectAddress(error)

                            this.address_ = null
                            this.command_ = null
                            throw error
                        })

                        let hostname = this.hostname_
                        if(!hostname) {
                            hostname = (!this.loopBackOnly_ && getAddress() || getLoopBackAddress())
                        }

                        let serverUrl = new URL('http://./')
                        serverUrl.hostname = hostname
                        serverUrl.port = port +''
                        serverUrl.pathname = this.path_

                        return new Promise((resolve, reject) => {
                            let cancelToken = earlyTermination.catch((e: { message: string }) => {
                                reject(Error(e.message))
                            })

                            waitForServer(serverUrl.href, timeout, cancelToken).then((_: any) => {
                                resolve(serverUrl.href)
                            }, (err: any) => {
                                if (err instanceof CancellationError) {
                                    resolve(serverUrl.href)
                                } else {
                                    reject(err)
                                }
                            })
                        })
                    })
                })
            )
        })
        return this.address_
    }

    kill() {
        if (!this.address_ || !this.command_) {
            return Promise.resolve()
        }

        let command  = this.command_
        this.address_ = null
        this.command_ = null
        // @ts-ignore
        return command.then((c) => c.kill('SIGTERM'))
    }
}

export class Builder {
    private readonly exe_: string;
    private readonly options_: DriverServiceOptions;

    constructor(exe: string) {
        if (!fs.existsSync(exe)) {
            throw Error(`The specified executable path does not exist: ${exe}`)
        }

        this.exe_ = exe

        this.options_ = {
            loopback: false,
            hostname:'',
            args: [],
            port: 0,
            path:'',
            env: null,
            stdio: 'ignore',
            command:null,
            address:null
        }
    }

    addArguments(...args_: any[]): this {
        this.options_.args = this.options_.args.concat(args_)
        return this
    }

    setHostname(hostname: string): this {
        this.options_.hostname = hostname
        return this
    }

    setLoopback(loopback:boolean): this {
        this.options_.loopback = loopback
        return this
    }

    setPath(basePath: any) {
        this.options_.path = basePath
        return this
    }

    setPort(port: number) {
        if (port < 0) {
            throw Error(`port must be >= 0: ${port}`)
        }
        this.options_.port = port
        return this
    }

    setEnvironment(env:any) {
        if (env instanceof Map) {
            let tmp:{[index: string]:any}= {}
            env.forEach((value, key) => (tmp[key] = value))
            env = tmp
        }
        this.options_.env = env
        return this
    }

    setStdio(config: string) {
        this.options_.stdio = config
        return this
    }

    build() {
        let port = this.options_.port || findFreePort()
        let args = Promise.resolve(port).then((port) => {
            return this.options_.args.concat('--port=' + port)
        })

        let options = (Object.assign({}, this.options_, { args, port }))
        return new DriverService(this.exe_, options)
    }
}

interface SeleniumServerOptions {
    loopback: boolean | undefined,
    port: number,
    args: Array<string>,
    jvmArgs: any,
    env: Object,
    stdio:string
}

export class SeleniumServer extends DriverService {
    /**
     * @param {string} jar Path to the Selenium server jar.
     * @param {SeleniumServerOptions} opt_options Configuration options for the
     *     server.
     * @throws {Error} If the path to the Selenium jar is not specified or if an
     *     invalid port is specified.
     */
    constructor(jar: string, opt_options: SeleniumServerOptions ) {
        if (!jar) {
            throw Error('Path to the Selenium jar not specified')
        }

        const options: SeleniumServerOptions = opt_options

        if (options.port < 0) {
            throw Error('Port must be >= 0: ' + options.port)
        }

        let port = options.port || findFreePort()
        let args = Promise.all([
            port,
            options.jvmArgs || [],
            options.args || [],
        ]).then((resolved) => {
            let port = resolved[0]
            let jvmArgs = resolved[1]
            let args = resolved[2]
            return jvmArgs.concat('-jar', jar, '-port', port).concat(args)
        })

        let java = 'java'
        if (process.env['JAVA_HOME']) {
            java = path.join(process.env['JAVA_HOME'], 'bin/java')
        }

        super(java, {
            loopback: options.loopback,
            port: port,
            args: args,
            path: '/wd/hub',
            env: options.env,
            stdio: options.stdio,
            command: null,
            address:null,
            hostname:null
        })
    }
}

export class FileDetector extends input.FileDetector {
    handleFile(driver: { execute: (arg0: any) => any; }, file: any) {
        return stat(file).then(
            function (stats: { isDirectory: () => any; }) {
                if (stats.isDirectory()) {
                    return file // Not a valid file, return original input.
                }

                let zip = new Zip()
                return zip
                    .addFile(file)
                    .then(() => zip.toBuffer())
                    .then((buf: { toString: (arg0: string) => any; }) => buf.toString('base64'))
                    .then((encodedZip: any) => {
                        let command = new Command(Name.UPLOAD_FILE).setParameter(
                            'file',
                            encodedZip
                        )
                        return driver.execute(command)
                    })
            },
            function (err: { code: string; }) {
                if (err.code === 'ENOENT') {
                    return file // Not a file; return original input.
                }
                throw err
            }
        )
    }
}

