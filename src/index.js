import express from 'express';

export default class PrometheusClient {
  constructor(context, opts) {
    // eslint-disable-next-line global-require
    this.client = require('prom-client');

    this.port = opts.port || 3000;
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

  start() {
    this.app = express();
    this.app.get('/metrics', (req, res) =>
      res.end(this.client.register.metrics()));
    this.server = this.app.listen(this.port);
    return this;
  }

  stop() {
    this.server.close();
    delete this.server;
  }
}
