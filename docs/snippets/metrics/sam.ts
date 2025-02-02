import { Metrics, MetricUnits } from '@aws-lambda-powertools/metrics';

// Metrics parameters fetched from the environment variables (see template.yaml tab)
const metrics = new Metrics();
metrics.addMetric('successfulBooking', MetricUnits.Count, 1);

// You can also pass the parameters in the constructor
// const metrics = new Metrics({
//   namespace: 'serverlessAirline',
//   serviceName: 'orders'
// });
