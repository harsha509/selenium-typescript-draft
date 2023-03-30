import {Capabilities} from './capabilities';


export class Session {
  private readonly id_: any;
  private readonly caps_: Capabilities;

  constructor(id: any, capabilities: any) {
    /** @private {string} */
    this.id_ = id

    /** @private {!Capabilities} */
    this.caps_ =
      capabilities instanceof Capabilities
        ? /** @type {!Capabilities} */ (capabilities)
        : new Capabilities(capabilities)
  }

  /**
   * @return {string} This session's ID.
   */
  getId() {
    return this.id_
  }

  /**
   * @return {!Capabilities} This session's capabilities.
   */
  getCapabilities() {
    return this.caps_
  }

  /**
   * Retrieves the value of a specific capability.
   * @param {string} key The capability to retrieve.
   * @return {*} The capability value.
   */
  getCapability(key: string) {
    return this.caps_.get(key)
  }

  /**
   * Returns the JSON representation of this object, which is just the string
   * session ID.
   * @return {string} The JSON representation of this Session.
   */
  toJSON() {
    return this.getId()
  }
}
