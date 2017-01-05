export default class PromiseTimer {
  constructor(metric, labels) {
    this.metric = metric;
    this.labels = labels;
  }

  label(objectOrFunction) {
    if (typeof objectOrFunction === 'function') {
      this.postTimerLabels = this.postTimerLabels || [];
      this.postTimerLabels.push(objectOrFunction);
    } else {
      this.labels = Object.assign(this.labels || {}, objectOrFunction);
    }
    return this;
  }

  labelError(objectOrFunction) {
    return this.label((e) => {
      if (e) {
        return (typeof objectOrFunction === 'function') ? objectOrFunction(e) : objectOrFunction;
      }
      return null;
    });
  }

  labelSuccess(objectOrFunction) {
    return this.label((e, r) => {
      if (!e) {
        return (typeof objectOrFunction === 'function') ? objectOrFunction(r) : objectOrFunction;
      }
      return null;
    });
  }

  async execute(promise) {
    const p = Promise.resolve(promise);
    const end = this.metric.startTimer(this.labels);

    let result;
    let error;
    try {
      result = await p;
      return result;
    } catch (rejection) {
      error = rejection;
      throw error;
    } finally {
      let endLabels;
      try {
        if (this.postTimerLabels) {
          for (const l of this.postTimerLabels) {
            const newLabels = l(error, result);
            if (newLabels) {
              endLabels = Object.assign(endLabels || {}, newLabels);
            }
          }
        }
      } catch (ignoredError) {
        // Nothing to do - the label assignment failed
      }
      // End the timer with any new label information
      end(endLabels);
    }
  }
}
