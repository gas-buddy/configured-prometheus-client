import express from 'express';
import PromiseTimer from './PromiseTimer';

function listen(context, cp) {
  if (cp.port < 0) {
    if (context.logger && context.logger.info) {
      context.logger.info('Metrics server disabled; metrics will not be available externally');
    } else {
      // eslint-disable-next-line no-console
      console.log('Metrics server disabled; metrics will not be available externally');
    }
    return;
  }

  cp.server = cp.app.listen(cp.port, () => {
    if (context.logger && context.logger.info) {
      context.logger.info('Metrics server listening', { port: cp.server.address().port });
    } else {
      // eslint-disable-next-line no-console
      console.log('Metrics server listening on', cp.server.address().port);
    }
  });
  cp.server.on('error', (error) => {
    if (context.logger && context.logger.error) {
      context.logger.error('Could not setup metrics server', { error: error.message });
    } else {
      // eslint-disable-next-line no-console
      console.error('Could not setup metrics server', error.message);
    }
  });
}

/**
 * Implement some of the argument detection logic so we can muck with the registers
 */
function pmArgs(registers, hasFourArgs, args) {
  if (typeof args[0] === 'object') {
    return {
      registers,
      ...args[0],
    };
  } else if (hasFourArgs) {
    let obj;
    let labels = [];

    if (Array.isArray(args[2])) {
      obj = args[3] || {};
      labels = args[2];
    } else {
      obj = args[2] || {};
    }
    const finalArgs = {
      registers,
      name: args[0],
      help: args[1],
      labelNames: labels,
    };
    if (obj.buckets) {
      finalArgs.buckets = obj.buckets;
    }
    if (obj.percentiles) {
      finalArgs.percentiles = obj.percentiles;
    }
    return finalArgs;
  }
  return {
    registers,
    name: args[0],
    help: args[1],
    labelNames: args[2] || [],
  };
}

export default class PrometheusClient {
  constructor(context, opts) {
    // eslint-disable-next-line global-require
    this.client = require('prom-client');
    const { Registry } = this.client;
    this.register = new Registry();

    this.port = opts.port === 0 ? 0 : (opts.port || 3000);
    if (opts.defaultMetrics) {
      this.client.collectDefaultMetrics({
        timeout: opts.defaultMetrics.interval,
        register: this.register,
      });
    }

    const registers = [this.register];
    this.Counter = class Counter extends this.client.Counter {
      constructor(...args) {
        super(pmArgs(registers, false, args));
      }
    };
    this.Gauge = class Gauge extends this.client.Gauge {
      constructor(...args) {
        super(pmArgs(registers, false, args));
      }
    };
    this.Histogram = class Histogram extends this.client.Histogram {
      constructor(...args) {
        super(pmArgs(registers, true, args));
      }
    };
    this.Summary = class Summary extends this.client.Summary {
      constructor(...args) {
        super(pmArgs(registers, true, args));
      }
    };

    // Make pre-configured items
    this.counters = this.buildMetricsFromConfiguration(this.client.Counter, opts.counters);
    this.gauges = this.buildMetricsFromConfiguration(this.client.Gauge, opts.gauges);
    this.histograms = this.buildMetricsFromConfiguration(this.client.Histogram, opts.histograms);
    this.hists = this.histograms;
    this.summaries = this.buildMetricsFromConfiguration(this.client.Summary, opts.summaries);
  }

  buildMetricsFromConfiguration(MetricClass, configs) {
    if (!configs) {
      return undefined;
    }

    const metrics = {};
    for (const [name, config] of Object.entries(configs)) {
      const { labels: labelNames = [], config: innerConfig = {}, ...restConfig } = config;
      const finalConfig = {
        labelNames,
        name,
        ...restConfig,
        registers: [this.register],
      };
      // Old api allowed a "config" child with these things
      if (innerConfig.buckets && !finalConfig.buckets) {
        finalConfig.buckets = innerConfig.buckets;
      }
      if (innerConfig.percentiles && !finalConfig.percentiles) {
        finalConfig.percentiles = innerConfig.percentiles;
      }
      metrics[name] = new MetricClass(finalConfig);
    }
    return metrics;
  }

  find(metricName) {
    if (this.summaries && this.summaries[metricName]) {
      return this.summaries[metricName];
    }
    if (this.histograms && this.histograms[metricName]) {
      return this.histograms[metricName];
    }
    if (this.gauges && this.gauges[metricName]) {
      return this.gauges[metricName];
    }
    if (this.counters && this.counters[metricName]) {
      return this.counters[metricName];
    }
    return null;
  }

  /**
   * Log a time value to a prometheus metric based on a promise.
   * The returned object has the following methods:
   *
   *  Add some labels to the timer:
   *    .label({ some: 'label' })
   *
   *  Add some labels that are based on the RESULT of the promise (or error):
   *    .label((error, result) => ({ otherLabel: result.value }))
   *
   *  Return the promise and start the timer/execution:
   *    .execute(someFunctionThatReturnsAPromise());
   */
  promiseTimer(metricNameOrInstance, labels) {
    let metric = metricNameOrInstance;
    if (typeof metricNameOrInstance === 'string') {
      metric = this.find(metricNameOrInstance);
    }
    return new PromiseTimer(metric, labels);
  }

  start(context) {
    this.app = express();
    this.app.get('/metrics', (req, res) =>
      res.end(this.register.metrics()));

    listen(context, this);
    return this;
  }

  stop() {
    if (this.server) {
      this.server.close();
      delete this.server;
    }
    this.register.clear();
  }
}
