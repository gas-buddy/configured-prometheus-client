import tap from 'tap';
import PrometheusClient from '../src/index';

tap.test('test_connection', async (t) => {
  const prometheus = new PrometheusClient({}, {});
  t.ok(prometheus.Counter, 'Should have a Counter method');
});
