
const { isObject } = require('./util')

/**
 * @fileoverview Defines some common methods used for WebElements.
 */

const LEGACY_ELEMENT_ID_KEY = 'ELEMENT'
const ELEMENT_ID_KEY = 'element-6066-11e4-a52e-4f735466cecf'

/**
 * Contains logic about WebElements.
 */
/**
 * @param {?} obj the object to test.
 * @return {boolean} whether the object is a valid encoded WebElement ID.
 */
export function isId(obj: { [x: string]: any }) {
  return (
    isObject(obj) &&
    (typeof obj[ELEMENT_ID_KEY] === 'string' ||
      typeof obj[LEGACY_ELEMENT_ID_KEY] === 'string')
  )
}

/**
 * Extracts the encoded WebElement ID from the object.
 *
 * @param {?} obj The object to extract the ID from.
 * @return {string} the extracted ID.
 * @throws {TypeError} if the object is not a valid encoded ID.
 */
export function extractId(obj: { [x: string]: any }) {
  if (isObject(obj)) {
    if (typeof obj[ELEMENT_ID_KEY] === 'string') {
      return obj[ELEMENT_ID_KEY]
    } else if (typeof obj[LEGACY_ELEMENT_ID_KEY] === 'string') {
      return obj[LEGACY_ELEMENT_ID_KEY]
    }
  }
  throw new TypeError('object is not a WebElement ID')
}