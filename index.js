export class MyPromise {
  static PENDING = "pending";
  static RESOLVED = "resolved";
  static REJECTED = "rejected";

  static resolve = (val) => {
    return new MyPromise((resolve) => {
      resolve(val);
    });
  };

  static reject = (val) => {
    return new MyPromise((resolve, reject) => {
      reject(val);
    });
  };

  static all = (promises) => {
    return new MyPromise((resolve, reject) => {
      let result = [];
      let count = 0;
      for (let i = 0; i < promises.length; i++) {
        promises[i].then(
          (data) => {
            result[i] = data;
            if (++count == promises.length) {
              resolve(result);
            }
          },
          (error) => {
            reject(error);
          }
        );
      }
    });
  };

  static race = (promises) => {
    return new Promise((resolve, reject) => {
      for (let i = 0; i < promises.length; i++) {
        promises[i].then(resolve, reject);
      }
    });
  };

  static allSettled = (promises) => {
    return new MyPromise((resolve) => {
      let result = [];
      let count = 0;
      for (let i = 0; i < promises.length; i++) {
        promises[i].finally((res) => {
          result[i] = res;
          if (++count == promises.length) {
            resolve(result);
          }
        });
      }
    });
  };

  constructor(executor) {
    this.status = MyPromise.PENDING;

    // 用于保存 then 的成功回调数组
    this.resolvedQueues = [];
    // 用于保存 then 的失败回调数组
    this.rejectedQueues = [];

    // 用于保存 resolve 的值
    this.value = null;
    // 用于保存 reject 的值
    this.reason = null;

    // executor 的 resolve 参数
    // 用于改变状态 并执行 then 中的成功回调
    let resolve = (value) => {
      // 当状态是 pending 是，将 promise 的状态改为成功态
      // 同时遍历执行 成功回调数组中的函数，将 value 传入
      if (this.status == MyPromise.PENDING) {
        this.value = value;
        this.status = MyPromise.RESOLVED;
        this.resolvedQueues.forEach((cb) => cb(this.value));
      }
    };
    // executor 的 reject 参数
    // 用于改变状态 并执行 then 中的失败回调
    let reject = (reason) => {
      // 当状态是 pending 是，将 promise 的状态改为失败态
      // 同时遍历执行 失败回调数组中的函数，将 reason 传入
      if (this.status == MyPromise.PENDING) {
        this.reason = reason;
        this.status = MyPromise.REJECTED;
        this.rejectedQueues.forEach((cb) => cb(this.reason));
      }
    };
    // 执行 executor 函数
    // 将我们上面定义的两个函数作为参数 传入
    // 有可能在 执行 executor 函数的时候会出错，所以需要 try catch 一下
    try {
      executor(resolve, reject);
    } catch (err) {
      reject(err);
    }
  }
  // 定义 then 函数
  then(onFulfilled, onRejected) {
    // 首先判断两个参数是否为函数类型，因为这两个参数是可选参数
    // 当参数不是函数类型时，需要创建一个函数赋值给对应的参数
    // 这也就实现了 透传
    onFulfilled =
      typeof onFulfilled === "function" ? onFulfilled : (value) => value;
    onRejected =
      typeof onRejected === "function"
        ? onRejected
        : (reason) => {
            throw reason;
          };

    const resolvePromise = (promise2, x, resolve, reject) => {
      if (x === promise2) {
        return reject(new TypeError("Chaining cycle detected for promise"));
      }
      let called;
      if (x != null && (typeof x === "object" || typeof x === "function")) {
        try {
          let then = x.then;
          if (typeof then === "function") {
            then.call(
              x,
              (y) => {
                if (called) return;
                called = true;
                resolvePromise(promise2, y, resolve, reject);
              },
              (err) => {
                if (called) return;
                called = true;
                reject(err);
              }
            );
          } else {
            resolve(x);
          }
        } catch (e) {
          if (called) return;
          called = true;
          reject(e);
        }
      } else {
        resolve(x);
      }
    };

    // then 方法返回一个新的 promise
    const promise2 = new MyPromise((resolve, reject) => {
      // 成功状态，直接 resolve
      if (this.status === MyPromise.RESOLVED) {
        // 将 onFulfilled 函数的返回值，resolve 出去
        // 注册一个 message 事件
        var that = this;
        window.addEventListener("message", (event) => {
          const { type } = event.data;

          if (type === "__promise") {
            try {
              let x = onFulfilled(that.value);
              resolvePromise(promise2, x, resolve, reject);
            } catch (err) {
              reject(err);
            }
          }
        });
        // 立马执行
        window.postMessage(
          {
            type: "__promise",
          },
          "http://10.125.23.214:8003"
        );
      }
      // 失败状态，直接 reject
      if (this.status === MyPromise.REJECTED) {
        // 将 onRejected 函数的返回值，reject 出去
        setTimeout(() => {
          try {
            let x = onRejected(this.reason);
            resolvePromise(promise2, x, resolve, reject);
          } catch (err) {
            reject(err);
          }
        });
      }
      // 等待状态，将 onFulfilled，onRejected 塞入数组中，等待回调执行
      if (this.status === MyPromise.PENDING) {
        this.resolvedQueues.push(() => {
          setTimeout(() => {
            try {
              let x = onFulfilled(this.value);
              resolvePromise(promise2, x, resolve, reject);
            } catch (err) {
              reject(err);
            }
          });
        });
        this.rejectedQueues.push(() => {
          setTimeout(() => {
            try {
              let x = onRejected(this.reason);
              resolvePromise(promise2, x, resolve, reject);
            } catch (err) {
              reject(err);
            }
          });
        });
      }
    });
    return promise2;
  }
  catch(onRejected) {
    return this.then(null, onRejected);
  }
  finally(fn) {
    return this.then(fn, fn);
  }
}

MyPromise.deferred = function () {
  let defer = {};
  defer.promise = new MyPromise((resolve, reject) => {
    defer.resolve = resolve;
    defer.reject = reject;
  });
  return defer;
};
