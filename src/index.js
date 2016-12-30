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
  }
}
