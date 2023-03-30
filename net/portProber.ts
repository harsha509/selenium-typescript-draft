import net from 'node:net'
import type { AddressInfo } from 'node:net'

/**
 * Checks if a port is free
 * @param {number} port The port to test
 * @param {string} optHost The bound host to test the {@code port} against.
 *
 * @return {Promise<boolean>} A promise that will resolve with whether the port is free.
 */
export const isFree =  (port: number, optHost: string):Promise<boolean> => new Promise<boolean>((resolve, reject) => {
    const server = net.createServer().on('error', (err: NodeJS.ErrnoException) => {
        if (err.message === 'EADDRINUSE' || err.code === 'EACCES') {
            resolve(false)
        } else {
            reject(true)
        }
    })

    server.listen(port, optHost, () => {
        server.close(() => resolve(true))
    })
})

/**
 *
 * @param {string} optHost The bound host to test the {@code port} against.
 * @return {Promise<number | string>} A promise that will resolve to a free port.
 * If a port cannot be found, the promise will be rejected.
 */
export const findFreePort = (optHost?: string):Promise<number| string> => new Promise((resolve, reject) => {
    const server: net.Server = net.createServer()

    server.on('listening', () => {
        resolve((server.address() as AddressInfo).port)
        server.close()
    })

    server.on('error', (err:NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
            resolve('Unable to find a free port')
        } else {
            reject(err)
        }
    })
    server.listen(0, optHost)
})