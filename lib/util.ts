
export function isObject(value: any) {
  return Object.prototype.toString.call(value) === '[object Object]'
}

/**
 * Determines whether a {@code value} should be treated as a promise.
 * Any object whose "then" property is a function will be considered a promise.
 *
 * @param {?} value The value to test.
 * @return {boolean} Whether the value is a promise.
 */
export function isPromise(value: { [x: string]: any }) {
  try {
    // Use array notation so the Closure compiler does not obfuscate away our
    // contract.
    return (
      (typeof value === 'object' || typeof value === 'function') &&
      typeof value['then'] === 'function'
    )
  } catch (ex) {
    return false
  }
}
