import { ContextMissingStrategy } from 'aws-xray-sdk-core/dist/lib/context_utils';
import { Namespace } from 'cls-hooked';
import { ProviderServiceInterface } from '.';
import {
  captureAWS,
  captureAWSClient,
  captureAWSv3Client,
  captureAsyncFunc,
  captureFunc,
  captureHTTPsGlobal,
  getNamespace,
  getSegment,
  setSegment,
  Segment,
  Subsegment,
  setContextMissingStrategy,
  setDaemonAddress,
  setLogger,
  Logger,
} from 'aws-xray-sdk-core';
import { addUserAgentMiddleware } from '@aws-lambda-powertools/commons';

const resolveHeaders = (
  input: RequestInfo | URL,
  options?: RequestInit
): Headers | undefined => {
  if (input instanceof Request) {
    return input.headers;
  } else if (options?.headers) {
    return new Headers(options.headers);
  }

  return undefined;
};

const resolveUrl = (input: RequestInfo | URL): string => {
  if (input instanceof Request) {
    return input.url;
  } else if (input instanceof URL) {
    return input.href;
  }

  return input;
};

const resolveMethod = (
  input: RequestInfo | URL,
  options?: RequestInit
): string => {
  if (input instanceof Request) {
    return input.method;
  } else if (options?.method) {
    return options.method;
  }

  return 'GET';
};

const getRootSegment = (segment: Segment | Subsegment): Segment => {
  if (segment instanceof Segment) {
    return segment;
  }

  return segment.segment;
};

class ProviderService implements ProviderServiceInterface {
  public captureAWS<T>(awssdk: T): T {
    return captureAWS(awssdk);
  }

  public captureAWSClient<T>(service: T): T {
    return captureAWSClient(service);
  }

  public captureAWSv3Client<T>(service: T): T {
    addUserAgentMiddleware(service, 'tracer');

    // Type must be aliased as any because of this https://github.com/aws/aws-xray-sdk-node/issues/439#issuecomment-859715660
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return captureAWSv3Client(service as any);
  }

  public captureAsyncFunc(
    name: string,
    fcn: (subsegment?: Subsegment) => unknown,
    _parent?: Segment | Subsegment
  ): unknown {
    return captureAsyncFunc(name, fcn);
  }

  public captureFunc(
    name: string,
    fcn: (subsegment?: Subsegment) => unknown,
    _parent?: Segment | Subsegment
  ): unknown {
    return captureFunc(name, fcn);
  }

  public captureHTTPsGlobal(): void {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    captureHTTPsGlobal(require('http'));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    captureHTTPsGlobal(require('https'));
    this.captureNativeFetch();
  }

  public getNamespace(): Namespace {
    return getNamespace();
  }

  public getSegment(): Segment | Subsegment | undefined {
    return getSegment();
  }

  public putAnnotation(key: string, value: string | number | boolean): void {
    const segment = this.getSegment();
    if (segment === undefined) {
      console.warn(
        'No active segment or subsegment found, skipping annotation'
      );

      return;
    }
    if (segment instanceof Segment) {
      console.warn(
        'You cannot annotate the main segment in a Lambda execution environment'
      );

      return;
    }
    segment.addAnnotation(key, value);
  }

  public putMetadata(key: string, value: unknown, namespace?: string): void {
    const segment = this.getSegment();
    if (segment === undefined) {
      console.warn(
        'No active segment or subsegment found, skipping metadata addition'
      );

      return;
    }
    if (segment instanceof Segment) {
      console.warn(
        'You cannot add metadata to the main segment in a Lambda execution environment'
      );

      return;
    }
    segment.addMetadata(key, value, namespace);
  }

  public setContextMissingStrategy(strategy: unknown): void {
    setContextMissingStrategy(strategy as ContextMissingStrategy);
  }

  public setDaemonAddress(address: string): void {
    setDaemonAddress(address);
  }

  public setLogger(logObj: unknown): void {
    setLogger(logObj as Logger);
  }

  public setSegment(segment: Segment | Subsegment): void {
    setSegment(segment);
  }

  private captureNativeFetch(): void {
    const fetch = globalThis.fetch;
    globalThis.fetch = async function (resource, options) {
      const headers = resolveHeaders(resource, options);
      const traceHeader = headers?.get('X-Amzn-Trace-Id');

      if (!traceHeader) {
        const parent = getSegment();

        if (parent) {
          const url = resolveUrl(resource);
          const method = resolveMethod(resource);
          const { hostname } = new URL(url);
          const subsegment = parent.notTraced
            ? parent.addNewSubsegmentWithoutSampling(hostname)
            : parent.addNewSubsegment(hostname);
          const root = getRootSegment(parent);
          subsegment.namespace = 'remote';

          if (!options) {
            options = {};
          }

          if (!options.headers) {
            options.headers = new Headers();
          }

          (options.headers as Headers).set(
            'X-Amzn-Trace-Id',
            `Root=${root.trace_id};Parent=${subsegment.id};Sampled=${
              subsegment.notTraced ? 0 : 1
            }`
          );

          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore-next-line
          subsegment.http = {
            request: {
              url,
              method,
            },
          };

          try {
            const res = await fetch.call(globalThis, resource, options);
            if (res.status === 429) {
              subsegment.addThrottleFlag();
            } else if (res.status >= 400 && res.status < 500) {
              subsegment.addErrorFlag();
            } else if (res.status >= 500) {
              subsegment.addFaultFlag();
            }

            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore-next-line
            subsegment.http = {
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore-next-line
              ...subsegment.http,
              response: {
                status: res.status,
                ...(res.headers.has('content-length') && {
                  content_length: res.headers.get('content-length'),
                }),
              },
            };
            subsegment.close();

            return res;
          } catch (err) {
            subsegment.close(err as Error | string);
            throw err;
          }
        }
      }

      return await fetch.call(globalThis, resource, options);
    };
  }
}

export { ProviderService };
