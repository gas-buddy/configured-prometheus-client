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
      context.logger.error('Could not setup metrics server', error);
    } else {
      // eslint-disable-next-line no-console
      console.error('Could not setup metrics server', error);
    }
  });
}

export default class PrometheusClient {
  constructor(context, opts) {
    // eslint-disable-next-line global-require
    this.client = require('prom-client');

    this.port = opts.port === 0 ? 0 : (opts.port || 3000);
    if (opts.defaultMetrics === false) {
      clearInterval(this.client.defaultMetrics());
      this.client.register.clear();
    } else if (opts.defaultMetrics) {
      this.client.defaultMetrics(
        opts.defaultMetrics.blacklist,
        opts.defaultMetrics.interval || 10000,
      );
    }

    ['Counter', 'Gauge', 'Histogram', 'Summary']
      .forEach(p => (this[p] = this.client[p]));

    // Make pre-configured items
    if (opts.counters) {
      this.counters = {};
      for (const [name, config] of Object.entries(opts.counters)) {
        this.counters[name] = new this.client.Counter(name, config.help, config.labels);
      }
    }
    if (opts.gauges) {
      this.gauges = {};
      for (const [name, config] of Object.entries(opts.gauges)) {
        this.gauges[name] = new this.client.Gauge(name, config.help, config.labels);
      }
    }
    if (opts.histograms) {
      this.hists = this.histograms = {};
      for (const [name, config] of Object.entries(opts.histograms)) {
        this.hists[name] = new this.client.Histogram(name, config.help, config.labels || [],
          Object.assign({}, config.config, { buckets: config.buckets }));
      }
    }
    if (opts.summaries) {
      this.summaries = {};
      for (const [name, config] of Object.entries(opts.summaries)) {
        this.summaries[name] = new this.client.Summary(name, config.help, config.labels || [],
          Object.assign({}, config.config, { percentiles: config.percentiles }));
      }
    }
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
      res.end(this.client.register.metrics()));

    listen(context, this);
    return this;
  }

  stop() {
    if (this.server) {
      this.server.close();
      delete this.server;
    }
  }
}
