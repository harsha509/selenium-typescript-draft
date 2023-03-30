

import jszip from 'jszip';
import path from "node:path";

const io = require('./index')
const { InvalidArgumentError } = require('../lib/error')

export class Zip {
    readonly z_: jszip;
    private pendingAdds_: Set<any>;
    constructor() {

        this.z_ = new jszip()

        this.pendingAdds_ = new Set()
    }

    addFile(filePath: string, zipPath = path.basename(filePath)) {
        let add = io
            .read(filePath)
            .then((buffer: null) =>
                this.z_.file(
                    /** @type {string} */ (zipPath.replace(/\\/g, '/')),
                    buffer
                )
            )
        this.pendingAdds_.add(add)
        return add.then(
            () => this.pendingAdds_.delete(add),
            (e: any) => {
                this.pendingAdds_.delete(add)
                throw e
            }
        )
    }


    addDir(dirPath: string, zipPath = '') {
        return io.walkDir(dirPath).then((entries: any[]) => {
            let archive = this.z_
            if (zipPath) {
                archive = archive.folder(zipPath)
            }

            let files: any[] = []
            entries.forEach((spec) => {
                if (spec.dir) {
                    archive.folder(spec.path)
                } else {
                    files.push(
                        this.addFile(
                            path.join(dirPath, spec.path),
                            path.join(zipPath, spec.path)
                        )
                    )
                }
            })

            return Promise.all(files)
        })
    }

    has(path: string) {
        return this.z_.file(path) !== null
    }

    getFile(path: string) {
        let file = this.z_.file(path)
        if (!file) {
            return Promise.reject(
                new InvalidArgumentError(`No such file in zip archive: ${path}`)
            )
        }

        if (file.dir) {
            return Promise.reject(
                new InvalidArgumentError(`The requested file is a directory: ${path}`)
            )
        }

        return Promise.resolve(file.async('nodebuffer'))
    }

    toBuffer(compression = 'STORE') {
        if (compression !== 'STORE' && compression !== 'DEFLATE') {
            return Promise.reject(
                new InvalidArgumentError(
                    `compression must be one of {STORE, DEFLATE}, got ${compression}`
                )
            )
        }
        return Promise.resolve(
            this.z_.generateAsync({ compression, type: 'nodebuffer' })
        )
    }
}

export function load(path: any) {
    return io.read(path).then((data:any) => {
        let zip = new Zip()
        return zip.z_.loadAsync(data).then(() => zip)
    })
}

export function unzip(src: any, dst: string) {
    return load(src).then((zip :any) => {
        const promisedDirs = new Map()
        const promises: any[] = []

        zip.z_.forEach((relPath: string, file: { dir: any; }) => {
            let p
            if (file.dir) {
                p = createDir(relPath)
            } else {
                let dirname = path.dirname(relPath)
                if (dirname === '.') {
                    p = writeFile(relPath, file)
                } else {
                    p = createDir(dirname).then(() => writeFile(relPath, file))
                }
            }
            promises.push(p)
        })

        return Promise.all(promises).then(() => dst)

        function createDir(dir: string) {
            let p = promisedDirs.get(dir)
            if (!p) {
                p = io.mkdirp(path.join(dst, dir))
                promisedDirs.set(dir, p)
            }
            return p
        }

        function writeFile(relPath: string, file: { dir?: any; async?: any; }) {
            return file
                .async('nodebuffer')
                .then((buffer: any) => io.write(path.join(dst, relPath), buffer))
        }
    })
}

