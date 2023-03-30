import fs from 'node:fs'
import path from 'node:path'
import tmp from 'tmp'

export function checkedCall(fn:any):Promise<unknown> {
    return new Promise((resolve, reject) => {
        try {
            fn((err: any, value: unknown) => {
                if (err) {
                    reject(err)
                } else {
                    resolve(value)
                }
            })
        } catch (e) {
            reject(e)
        }
    })
}

export function rmDir(dirPath: fs.PathLike) {
    return new Promise<void>(function (fulfill, reject) {
        fs.rm(dirPath, { recursive: true, maxRetries: 2 }, function (err) {
            if (err && err.code === 'ENOENT') {
                fulfill()
            } else if (err) {
                reject(err)
            }
            fulfill()
        })
    })
}

export function copy(src: fs.PathLike, dst: any) {
    return new Promise(function (fulfill, reject) {
        const rs = fs.createReadStream(src)
        rs.on('error', reject)

        const ws = fs.createWriteStream(dst)
        ws.on('error', reject)
        ws.on('close', () => fulfill(dst))

        rs.pipe(ws)
    })
}

export function copyDir(src: fs.PathLike, dst: fs.PathLike, opt_exclude:any) {
    let predicate = opt_exclude
    if (opt_exclude && typeof opt_exclude !== 'function') {
        predicate = function (p: any) {
            return !opt_exclude.test(p)
        }
    }

    if (!fs.existsSync(dst)) {
        fs.mkdirSync(dst)
    }

    let files = fs.readdirSync(src)
    files = files.map(function (file) {
        return path.join(<string>src, file)
    })

    if (predicate) {
        files = files.filter(/** @type {function(string): boolean} */ (predicate))
    }

    const results: any[] = []
    files.forEach(function (file) {
        const stats = fs.statSync(file)
        let target
        if (typeof dst === "string") {
            target = path.join(dst, path.basename(file))
        }

        if (stats.isDirectory()) {
            if (!fs.existsSync(target)) {
                fs.mkdirSync(target, stats.mode)
            }
            results.push(copyDir(file, target, predicate))
        } else {
            results.push(copy(file, target))
        }
    })

    return Promise.all(results).then(() => dst)
}

export function exists(aPath: fs.PathLike) {
    return new Promise(function (fulfill, reject) {
        let type = typeof aPath
        if (type !== 'string') {
            reject(TypeError(`expected string path, but got ${type}`))
        } else {
            fulfill(fs.existsSync(aPath))
        }
    })
}

export function stat(aPath: fs.PathLike) {
    return checkedCall((callback: (err: NodeJS.ErrnoException, stats: fs.Stats) => void) => fs.stat(aPath, callback))
}

function unlink(aPath: fs.PathLike) {
    return new Promise<void>(function (fulfill, reject) {
        const exists = fs.existsSync(aPath)
        if (exists) {
            fs.unlink(aPath, function (err) {
                // @ts-ignore
                reject(err) || fulfill()
            })

        } else {
            fulfill()
        }
    })
}

export function tmpDir() {
    return checkedCall((callback: tmp.DirCallback) => tmp.dir({ unsafeCleanup: true }, callback))
}


export function tmpFile(opt_options: tmp.FileOptionsDiscardFd) {
    return checkedCall((callback: tmp.FileCallbackNoFd) => {
        tmp.file(opt_options, callback)
    })
}

export function findInPath(file: string, opt_checkCwd: any) {
    const dirs = []
    if (opt_checkCwd) {
        dirs.push(process.cwd())
    }
    dirs.push.apply(dirs, process.env['PATH'].split(path.delimiter))

    let foundInDir = dirs.find((dir) => {
        let tmp = path.join(dir, file)
        try {
            let stats = fs.statSync(tmp)
            return stats.isFile() && !stats.isDirectory()
        } catch (ex) {
            return false
        }
    })

    return foundInDir ? path.join(foundInDir, file) : null
}


export function read(aPath: fs.PathOrFileDescriptor) {
    return checkedCall((callback: (err: NodeJS.ErrnoException, data: Buffer) => void) => fs.readFile(aPath, callback))
}


export function write(aPath: fs.PathOrFileDescriptor, data: string | NodeJS.ArrayBufferView) {
    return checkedCall((callback: fs.NoParamCallback) => fs.writeFile(aPath, data, callback))
}


export function mkdir(aPath: fs.PathLike) {
    return checkedCall((callback:any) => {
        fs.mkdir(aPath, undefined, (err) => {
            if (err && err.code !== 'EEXIST') {
                callback(err)
            } else {
                callback(null, aPath)
            }
        })
    })
}

export function mkdirp(dir: fs.PathLike) {
    return checkedCall((callback:any) => {
        fs.mkdir(dir, undefined, (err) => {
            if (!err) {
                callback(null, dir)
                return
            }

            switch (err.code) {
                case 'EEXIST':
                    callback(null, dir)
                    return
                case 'ENOENT':
                    return mkdirp(path.dirname(<string>dir))
                        .then(() => mkdirp(dir))
                        .then(
                            () => callback(null, dir),
                            (err) => callback(err)
                        )
                default:
                    callback(err)
                    return
            }
        })
    })
}

export function walkDir(rootPath: any) {
    const seen: any[] | PromiseLike<any[]> = []
    return (function walk(dir) {

        return checkedCall((callback: any) => fs.readdir(dir, callback)).then((files) =>
            Promise.all(
                // @ts-ignore
                files.map(async (file:any) => {
                    file = path.join(dir, file)
                    const stats = await checkedCall((cb: any) => fs.stat(file, cb))

                    seen.push({
                        path: path.relative(rootPath, file),
                        // @ts-ignore
                        dir: stats.isDirectory(),
                    })
                    // @ts-ignore
                    return await (stats.isDirectory() && walk(file))
                })
            )
        )
    })(rootPath).then(() => seen)
}