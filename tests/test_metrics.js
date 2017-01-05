import tap from 'tap';
import PrometheusClient from '../src/index';

let p;

tap.test('test_metrics', async (t) => {
  p = new PrometheusClient({}, {
    histograms: {
      TestHisto: {
        help: 'Test Histogram',
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
  });
  t.ok(p.Counter, 'Should have a Counter method');

  t.ok(p.histograms, 'Should have preconfigured histograms');
  t.ok(p.histograms.TestHisto, 'Should have specific histogram');
  t.strictEquals(p.histograms.TestHisto.bucketValues['5'], 0, 'Bucket argument should win');

  t.ok(p.counters, 'Should have preconfigured counters');
  t.ok(p.counters.TestCount, 'Should have specific counter');

  t.ok(p.gauges, 'Should have preconfigured gauges');
  t.ok(p.gauges.TestGauge, 'Should have specific gauge');

  t.ok(p.summaries, 'Should have preconfigured summaries');
  t.ok(p.summaries.TestSum, 'Should have specific summary');

  const result = await p.start({});
  t.strictEquals(result, p, 'Should return itself on start');
  t.ok(p.server, 'Metrics server should be running');

  p.stop();
  t.ok(!p.server, 'Metrics server should not be running');
});
