export const delay = (cb: Function, timeout: number): Promise<unknown> =>
  new Promise(
    (resolve): NodeJS.Timeout => setTimeout(() => resolve(cb()), timeout)
  );
