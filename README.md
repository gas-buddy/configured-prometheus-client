configured-prometheus-client
==========================

> :warning: **This module is deprecated and no longer maintained**: GasBuddy uses OpenTelemetry now.


A small wrapper around the Prometheus client to allow configuration from JSON configuration or [hydration](https://github.com/gas-buddy/hydration).

You can create metrics "upfront":

```
import PrometheusClient from '@gasbuddy/configured-prometheus-client';

const client = new PrometheusClient({}, {
    histograms: {
      TestHisto: {
        help: 'Test Histogram',
        labels: ['foo', 'baz'],
        buckets: [0.1, 0.2, 1],
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

// Increment the counter by 5
client.counters.TestCount.inc(5);
```

Also, since most things you want to time are some sort of asynchronous
operation, the client provides a "Promise timer" method:

```
async function aPromise(value) {
  await Promise.delay(1);
  return value;
}

const rz = await client.promiseTimer('TestHisto')
  .label({ foo: 'bar' })
  .labelSuccess(result => ({ baz: result }))
  .execute(aPromise('beep'));
// rz is now the result of the promise
```

The `foo:bar` label will be applied on the call to startTimer, and the
`baz:beep` label will be applied when the timer ends assuming the promise
resolves rather than rejects (use labelError for that case). Each of the
label functions accepts either a function (so you can examine the result of
the promise) or a literal object that just gets added to the labels.

(Note that literal labels applied with .label() will always be applied
when the timer STARTS, all others will be applied in order after it resolves or rejects).
