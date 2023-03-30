
const { isObject, isPromise } = require('./util')

export function delayed(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function checkedNodeCall(fn: any, ...args: any[]) {
  return new Promise(function (fulfill, reject) {
    try {
      fn(...args, function (error: any, value: unknown) {
        error ? reject(error) : fulfill(value)
      })
    } catch (ex) {
      reject(ex)
    }
  })
}

export async function thenFinally(promise: any, callback: () => any) {
  try {
    await Promise.resolve(promise)
    return callback()
  } catch (e) {
    await callback()
    throw e
  }
}

export async function map(array: any, fn: { call: (arg0: any, arg1: any, arg2: number, arg3: any[]) => any }, self: any) {
  const v = await Promise.resolve(array)
  if (!Array.isArray(v)) {
    throw TypeError('not an array')
  }

  const arr = /** @type {!Array} */ (v)
  const values = []

  for (const [index, item] of arr.entries()) {
    values.push(await Promise.resolve(fn.call(self, item, index, arr)))
  }

  return values
}

export async function filter(array: any, fn: { call: (arg0: any, arg1: any, arg2: number, arg3: any[]) => any }, self: any) {
  const v = await Promise.resolve(array)
  if (!Array.isArray(v)) {
    throw TypeError('not an array')
  }

  const arr = /** @type {!Array} */ (v)
  const values = []

  for (const [index, item] of arr.entries()) {
    const isConditionTrue = await Promise.resolve(
      fn.call(self, item, index, arr)
    )
    if (isConditionTrue) {
      values.push(item)
    }
  }

  return values
}

export async function fullyResolved(value: any) {
  value = await Promise.resolve(value)
  if (Array.isArray(value)) {
    return fullyResolveKeys(/** @type {!Array} */ (value))
  }

  if (isObject(value)) {
    return fullyResolveKeys(/** @type {!Object} */ (value))
  }

  if (typeof value === 'function') {
    return fullyResolveKeys(/** @type {!Object} */ (value))
  }

  return value
}


export async function fullyResolveKeys(obj: string | any[]) {
  const isArray = Array.isArray(obj)
  const numKeys = isArray ? obj.length : Object.keys(obj).length

  if (!numKeys) {
    return obj
  }

  async function forEachProperty(obj: any, fn: (arg0: any, arg1: string) => any) {
    for (let key in obj) {
      await fn(obj[key], key)
    }
  }

  async function forEachElement(arr: string | any[], fn: (arg0: any, arg1: number) => any) {
    for (let i = 0; i < arr.length; i++) {
      await fn(arr[i], i)
    }
  }

  const forEachKey = isArray ? forEachElement : forEachProperty
  await forEachKey(obj, async function (partialValue, key) {
    if (
      !Array.isArray(partialValue) &&
      (!partialValue || typeof partialValue !== 'object')
    ) {
      return
    }
    // @ts-ignore
    obj[key] = await fullyResolved(partialValue)
  })
  return obj
}
