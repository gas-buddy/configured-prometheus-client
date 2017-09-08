import tap from 'tap';
import request from 'supertest';
import PrometheusClient from '../src/index';

let p;

tap.test('disabled server', async (t) => {
  const c = new PrometheusClient({}, { port: -1 });
  await c.start({});
  t.ok(c.server === undefined, 'Should not have a server');
  await c.stop();
});

tap.test('real server', async (t) => {
  const metricConfig = {
    histograms: {
      TestHisto: {
        help: 'Test Histogram',
        labels: ['foo', 'baz'],
        config: {
          buckets: [1, 2, 3, 4],
        },
        buckets: [5],
      },
    },
    counters: {
      TestCount: {
        help: 'Test Counter',
      },
    },
    gauges: {
      TestGauge: {
        help: 'Test Gauge',
      },
    },
    summaries: {
      TestSum: {
        help: 'Test Summary',
      },
    },
  };
  p = new PrometheusClient({}, metricConfig);
  t.ok(p.Counter, 'Should have a Counter method');

  t.ok(p.histograms, 'Should have preconfigured histograms');
  t.ok(p.histograms.TestHisto, 'Should have specific histogram');
  t.strictEquals(p.histograms.TestHisto.bucketValues['5'], 0, 'Bucket argument should win');

  t.ok(p.counters, 'Should have preconfigured counters');
  t.ok(p.counters.TestCount, 'Should have specific counter');
  p.counters.TestCount.inc(74);

  t.ok(p.gauges, 'Should have preconfigured gauges');
  t.ok(p.gauges.TestGauge, 'Should have specific gauge');

  t.ok(p.summaries, 'Should have preconfigured summaries');
  t.ok(p.summaries.TestSum, 'Should have specific summary');

  t.strictEquals(p.find('TestGauge'), p.gauges.TestGauge, 'should find a gauge');
  t.strictEquals(p.find('TestHisto'), p.histograms.TestHisto, 'should find a histogram');
  t.strictEquals(p.find('TestCount'), p.counters.TestCount, 'should find a counter');
  t.strictEquals(p.find('TestSum'), p.summaries.TestSum, 'should find a summary');

  const startResult = await p.start({});
  t.strictEquals(startResult, p, 'Should return itself on start');
  t.ok(p.server, 'Metrics server should be running');

  let timer = p.promiseTimer('TestHisto');
  t.strictEquals(timer.metric, p.hists.TestHisto, 'Should find the metric');
  t.strictEquals(timer.constructor.name, 'PromiseTimer', 'Should return a PromiseTimer');

  const rz = await timer
    .label({ foo: 'bar' })
    .labelSuccess(result => ({ baz: result }))
    .execute(new Promise(accept => setTimeout(() => accept('beep'), 50)));
  t.strictEquals(rz, 'beep', 'Promise should resolve to original promise value');

  timer = p.promiseTimer('TestHisto');
  try {
    await timer
      .label({ foo: 'bust' })
      .labelError(error => ({ baz: error.message }))
      .execute(new Promise((accept, reject) =>
        setTimeout(() => reject(new Error('bork')), 50)));
    t.fail('Promise should throw');
  } catch (error) {
    t.strictEquals(error.message, 'bork', 'Promise should throw error');
  }

  timer = p.promiseTimer();
  const rznoMetric = await timer
    .label({ foo: 'bar' })
    .labelSuccess(result => ({ baz: result }))
    .execute(new Promise(accept => setTimeout(() => accept('beep'), 50)));
  t.strictEquals(rznoMetric, 'beep', 'Promise should resolve to original promise value');

  const { text, status } = await request(p.app)
    .get('/metrics');
  t.strictEquals(status, 200, '/metrics should return 200 status');

  t.ok(new PrometheusClient({}, metricConfig), 'Should allow a second instance before stop');
  p.stop();
  t.ok(!p.server, 'Metrics server should not be running');

  t.match(text, /TestCount 74/, 'Should have valid counter');
  t.match(text, /TestHisto_bucket{le="5",foo="bust",baz="bork"} 1/, 'Should have an error metric');
  t.match(text, /TestHisto_bucket{le="5",foo="bar",baz="beep"} 1/, 'Should have a success metric');

  t.ok(new PrometheusClient({}, metricConfig), 'Should allow a second instance after stop');
  // And, an inherent test - shouldn't keep node running without a stop
});
