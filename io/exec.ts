
import * as childProcess from 'node:child_process'

/**
 * Describes a command's termination conditions.
 */
class Result {
    private readonly code: number;
    private readonly signal: string;

    /**
     * @param {?number} code The exit code, or {@code null} if the command did not
     *     exit normally.
     * @param {?string} signal The signal used to kill the command, or
     *     {@code null}.
     */
    constructor(code: number | null, signal: string | null) {
        /** @type {?number} */
        this.code = code

        /** @type {?string} */
        this.signal = signal
    }

    /** @override */
    toString() {
        return `Result(code=${this.code}, signal=${this.signal})`
    }
}

const COMMAND_RESULT =
    /** !WeakMap<!Command, !Promise<!Result>> */ new WeakMap()
const KILL_HOOK = /** !WeakMap<!Command, function(string)> */ new WeakMap()

/**
 * Represents a command running in a sub-process.
 */
class Command {
    /**
     * @param {!Promise<!Result>} result The command result.
     * @param {function(string)} onKill The function to call when {@link #kill()}
     *     is called.
     */
    constructor(result: Promise<Result>, onKill: (arg0: string) => any) {
        COMMAND_RESULT.set(this, result)
        KILL_HOOK.set(this, onKill)
    }

    /**
     * @return {!Promise<!Result>} A promise for the result of this
     *     command.
     */
    result() {
        return /** @type {!Promise<!Result>} */ (COMMAND_RESULT.get(this))
    }

    /**
     * Sends a signal to the underlying process.
     * @param {string=} opt_signal The signal to send; defaults to `SIGTERM`.
     */
    kill(opt_signal: any) {
        KILL_HOOK.get(this)(opt_signal || 'SIGTERM')
    }
}

interface Options {
    args: Array<string>| undefined
    env: Object,
    stdio: string| Array<string|number|undefined|null>
}

/**
 * Spawns a child process. The returned {@link Command} may be used to wait
 * for the process result or to send signals to the process.
 *
 * @param {string} command The executable to spawn.
 * @param opt_options
 * @return {!Command} The launched command.
 */
export default function exec(command: string, opt_options: any) {
    const options = opt_options

    let proc = childProcess.spawn(command, options.args || [], {
        env: options.env || process.env,
        stdio: options.stdio || 'ignore',
    })

    // This process should not wait on the spawned child, however, we do
    // want to ensure the child is killed when this process exits.
    proc.unref()
    process.once('exit', onProcessExit)

    const result = new Promise<Result>((resolve) => {
        proc.once('exit', (code: number, signal: string) => {
            proc = null
            process.removeListener('exit', onProcessExit)
            resolve(new Result(code, signal))
        })
    })
    return new Command(result, killCommand)

    function onProcessExit() {
        killCommand('SIGTERM')
    }

    function killCommand(signal:any) {
        process.removeListener('exit', onProcessExit)
        if (proc) {
            proc.kill(signal)
            proc = null
        }
    }
}

