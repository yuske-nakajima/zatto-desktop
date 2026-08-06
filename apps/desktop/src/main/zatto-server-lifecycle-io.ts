/**
 * Applies a deadline to an asynchronous lifecycle operation.
 *
 * @param promise - Operation to observe
 * @param timeoutMs - Maximum duration in milliseconds
 * @param createTimeoutError - Produces the error reported at the deadline
 * @returns Original operation result
 * @throws Error returned by `createTimeoutError` after the deadline
 */
export function withLifecycleTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  createTimeoutError: () => Error,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(createTimeoutError()), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
