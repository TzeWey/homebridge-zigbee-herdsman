import assert from 'assert';

import { Logger } from 'homebridge';
import { types } from 'util';

export class DeferredPromise<T> implements Promise<T> {
  [Symbol.toStringTag]: 'Promise';

  private _promise: Promise<T>;
  private _resolve!: (value?: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
  private _reject!: (reason?: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any

  public get promise() {
    return this._promise;
  }

  constructor() {
    this._promise = new Promise<T>((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }

  public then<TResult1, TResult2>(
    onfulfilled?: (value: T) => TResult1 | PromiseLike<TResult1>,
    onrejected?: (reason: any) => TResult2 | PromiseLike<TResult2>, // eslint-disable-line @typescript-eslint/no-explicit-any
  ): Promise<TResult1 | TResult2> {
    return this._promise.then(onfulfilled, onrejected);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async catch<TResult>(onrejected?: (reason: any) => TResult | PromiseLike<TResult>): Promise<T | TResult> {
    return this._promise.catch(onrejected);
  }

  public finally(onfinally?: (() => void) | undefined | null): Promise<T> {
    return this._promise.finally(onfinally);
  }

  public resolve(value?: T | PromiseLike<T>): void {
    this._resolve(value);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public reject(reason?: any): void {
    this._reject(reason);
  }
}

export interface MessageQueueState<RESPONSE> {
  timeoutPromise: Promise<RESPONSE>;
  responsePromise: DeferredPromise<RESPONSE>;
}

export class MessageQueue<KEY, RESPONSE> {
  private readonly queue: Map<KEY, MessageQueueState<RESPONSE>>;

  constructor(private readonly log: Logger, private readonly defaultTimeout: number) {
    assert(defaultTimeout && defaultTimeout > 0);
    this.queue = new Map<KEY, MessageQueueState<RESPONSE>>();
  }

  public get size() {
    return this.queue.size;
  }

  enqueue(key: KEY, timeout?: number): KEY {
    const responsePromise = new DeferredPromise<RESPONSE>();
    const messageTimeout = timeout ? timeout : this.defaultTimeout;
    const timeoutPromise = new Promise<RESPONSE>((_, reject) =>
      setTimeout(() => {
        reject(new Error(`message response timeout for '${key}'`));
      }, messageTimeout),
    );
    this.queue.set(key, { timeoutPromise, responsePromise });
    return key;
  }

  processMessage(key: KEY, response: RESPONSE) {
    const state = this.queue.get(key);
    if (!state) {
      this.log.debug(`messageQueue: message '${key}' not found`);
      return false;
    }
    state.responsePromise.resolve(response);
    return true;
  }

  async wait(keys: KEY[]): Promise<RESPONSE[]> {
    assert(keys && keys.length > 0);
    const states = keys.map((key) => {
      const state = this.queue.get(key);
      if (state) {
        this.queue.delete(key);
      } else {
        throw new Error(`state with key '${key}' could not be found`);
      }
      return state;
    });

    try {
      const waitPromises = states.map((state) => {
        return Promise.race([state.timeoutPromise, state.responsePromise]);
      });
      return await Promise.all(waitPromises);
    } catch (e) {
      if (types.isNativeError(e)) {
        this.log.debug('messageQueue:', e.message);
      }
      return [];
    }
  }
}
