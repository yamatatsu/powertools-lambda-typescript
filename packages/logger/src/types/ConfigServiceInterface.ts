import type { ConfigServiceInterface as ConfigServiceBaseInterface } from '@aws-lambda-powertools/commons/types';

/**
 * Interface ConfigServiceInterface
 *
 * @interface
 * @see https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html#configuration-envvars-runtime
 * @see https://docs.powertools.aws.dev/lambda-typescript/latest/#environment-variables
 */
interface ConfigServiceInterface extends ConfigServiceBaseInterface {
  /**
   * It returns the value of the ENVIRONMENT environment variable.
   *
   * @returns {string}
   */
  getCurrentEnvironment(): string;

  /**
   * It returns the value of the POWERTOOLS_LOGGER_LOG_EVENT environment variable.
   *
   * @returns {boolean}
   */
  getLogEvent(): boolean;

  /**
   * It returns the value of the LOG_LEVEL environment variable.
   *
   * @returns {string}
   */
  getLogLevel(): string;

  /**
   * It returns the value of the POWERTOOLS_LOGGER_SAMPLE_RATE environment variable.
   *
   * @returns {string|undefined}
   */
  getSampleRateValue(): number | undefined;
}

export type { ConfigServiceInterface };
