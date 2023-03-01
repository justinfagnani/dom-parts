const mutatingMethods: Array<keyof Array<unknown>> = [
  'copyWithin',
  'fill',
  'pop',
  'push',
  'reverse',
  'shift',
  'sort',
  'splice',
  'unshift',
];

export type ObserverCallback = (array: ObservableArray<unknown>) => void;

const observerMap = new WeakMap<ObservableArray<unknown>, Set<ObserverCallback>>();

export const addObserver = (
  array: ObservableArray<unknown>,
  callback: ObserverCallback
) => {
  let observers = observerMap.get(array);
  if (observers === undefined) {
    observerMap.set(array, observers = new Set());
  }
  observers.add(callback);
};

export const removeObserver = (
  array: ObservableArray<unknown>,
  callback: ObserverCallback
) => {
  observerMap.get(array)?.delete(callback)
};

const notifyObservers = (array: ObservableArray<unknown>) => {
  observerMap.get(array)?.forEach((callback) => callback(array));
};

/**
 * Stand-in for WebIDLs ObservableArray as used in adoptedStyleSheets
 *
 * See: https://github.com/whatwg/webidl/issues/796
 */
export class ObservableArray<T> extends Array<T> {

  constructor(...args: any[]) {
    super(...args);

    // We must extend Array to make the constructor and TypeScript happy,
    // but we need to return a Proxy to trap property access. So we return a
    // Proxy of the newly constructed Array instance.
    return new Proxy(this, {
      get(target: Array<T>, property: PropertyKey, receiver: Array<T>) {
        const v = Reflect.get(target, property, receiver);
        if (typeof v === 'function') {
          if (mutatingMethods.includes(property as keyof Array<unknown>)) {
            return function (this: ObservableArray<T>, ...args: unknown[]) {
              // `this` is the Proxy here
              notifyObservers(this);
              return v.apply(this, args);
            };
          }
        }
        return v;
      },
      set(
        this: ObservableArray<T>,
        target: Array<T>,
        property: PropertyKey,
        value: unknown,
        receiver: Array<T>
      ) {
        // `this` is the Proxy here
        notifyObservers(this);
        return Reflect.set(target, property, value, receiver);
      },
    }) as ObservableArray<T>;
  }
}
