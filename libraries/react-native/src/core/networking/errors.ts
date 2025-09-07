export type HttpRequestError = {
  _tag: 'HttpRequestError';
  message: string;
  cause: unknown;
};

export type RateLimitError = {
  _tag: 'RateLimitError';
  message: string;
};

export type AuthenticationError = {
  _tag: 'AuthenticationError';
  message: string;
};

export type ResponseError = {
  _tag: 'ResponseError';
  message: string;
  statusCode: number;
  response: Response;
};

export type BundleIdNotFoundError = {
  _tag: 'BundleIdNotFoundError';
  message: string;
};
