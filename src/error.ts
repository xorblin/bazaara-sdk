export class BazaaraError extends Error {
  /** HTTP status code returned by the API */
  public status: number;
  /** Detailed validation errors if the request was invalid */
  public errors?: Record<string, string[]> | any[];
  /** The raw body response from the server */
  public raw?: any;

  constructor(message: string, status: number, errors?: Record<string, string[]> | any[], raw?: any) {
    super(message);
    this.name = 'BazaaraError';
    this.status = status;
    this.errors = errors;
    this.raw = raw;

    // Restore prototype chain for extending built-in Error in ES5/ES6
    Object.setPrototypeOf(this, BazaaraError.prototype);
  }

  /**
   * Helper to determine if an error is a BazaaraError instance
   */
  static isBazaaraError(err: any): err is BazaaraError {
    return err instanceof BazaaraError || (err && err.name === 'BazaaraError');
  }
}
