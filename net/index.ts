
import os  from 'node:os'
import { platform } from 'node:process'

import type { NetworkInterfaceInfo } from "node:os"

export const getLoInterface = ():NetworkInterfaceInfo[] | null => {
    let name: string;

    if(platform === 'darwin') {
        name = 'lo0'
    } else if (platform === 'linux') {
        name = 'lo'
    }

    if (name) {
        const loInterface = os.networkInterfaces()[name]
        if (loInterface) {
            return loInterface
        }
    }
    return null;
}

/**
 * Queries the system network interfaces for an IP address.
 * @param loopBack
 * @param {string} family The IP family (IPv4 or IPv6). Defaults to IPv4.
 * @return {(string|undefined)} The located IP address or undefined.
 */
export const getIPAddress = (loopBack: boolean, family: string ): string|undefined => {
    let interfaces:NetworkInterfaceInfo[][] | undefined | null | NodeJS.Dict<NetworkInterfaceInfo[]>
    if(loopBack) {
        const lo = getLoInterface()
        interfaces = lo ? [lo] : null
    }

    interfaces = interfaces || os.networkInterfaces()

    for (const key in interfaces) {
        if (interfaces instanceof Array) {
            for (const ipAddress of interfaces[parseInt(key)]) {
                if (
                    (ipAddress.family === family || `IPv${ipAddress.family}` === family) && ipAddress.internal === loopBack
                ) {
                    return ipAddress.address
                }
            }
        }
    }
    return undefined
}

/**
 * Retrieves the external IP address for this host.
 * @param {string=} family The IP family to retrieve. Defaults to "IPv4".
 * @return {(string|undefined)} The IP address or undefined if not available.
 */
export const getAddress = (family:string = 'IPv4'): string | undefined => {
    return getIPAddress(false, family)
}

/**
 * Retrieves a loopback address for this machine.
 * @param {string=} family The IP family to retrieve. Defaults to "IPv4".
 * @return {(string|undefined)} The IP address or undefined if not available.
 */
export const getLoopBackAddress = (family:string = 'IPv4'):string | undefined => {
    let address = getIPAddress(true, family)

    if(address === '127.0.0.1') {
        address = `localhost`
    }

    return address
}

/**
 * Splits a hostport string, e.g. "www.example.com:80", into its component
 * parts.
 *
 * @param {string} hostport The string to split.
 * @return {{host: string, port: ?number}} A host and port. If no port is
 *     present in the argument `hostport`, port is null.
 */

interface Address {
    host: string,
    port: number
}

/**
 * Splits a host port string, e.g. "www.example.com:80", into its component
 * parts.
 *
 * @param {string} hostPort The string to split.
 * @return {{host: string, port: number}} A host and port.
 * If no port is present in the argument `hostport`, port is null.
 */
export const splitHostAndPort = (hostPort: string): Address => {
    const lastIndex = hostPort.lastIndexOf(':')
    if(lastIndex < 0) {
        return {host: hostPort, port: null}
    }

    const firstIndex = hostPort.indexOf(':')
    if( firstIndex != lastIndex && !hostPort.indexOf('[')) {
        return { host:hostPort, port:null }
    }

    let host = hostPort.slice(0, lastIndex)
    if(host.startsWith('[') && host.endsWith(']')) {
        host = host.slice(1,-1)
    }

    const port = parseInt(hostPort.slice(lastIndex + 1), 10)
    return {host, port}
}