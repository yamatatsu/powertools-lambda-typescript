import { parse } from './envelope.js';
import { z, ZodSchema } from 'zod';
import { KinesisFirehoseSchema } from '../schemas/kinesis-firehose.js';

/**
 * Kinesis Firehose Envelope to extract array of Records
 *
 *  The record's data parameter is a base64 encoded string which is parsed into a bytes array,
 *  though it can also be a JSON encoded string.
 *  Regardless of its type it'll be parsed into a BaseModel object.
 *
 *  Note: Records will be parsed the same way so if model is str,
 *  all items in the list will be parsed as str and not as JSON (and vice versa)
 *
 *  https://docs.aws.amazon.com/lambda/latest/dg/services-kinesisfirehose.html
 */
export const kinesisFirehoseEnvelope = <T extends ZodSchema>(
  data: unknown,
  schema: T
): z.infer<T> => {
  const parsedEnvelope = KinesisFirehoseSchema.parse(data);

  return parsedEnvelope.records.map((record) => {
    return parse(record.data, schema);
  });
};