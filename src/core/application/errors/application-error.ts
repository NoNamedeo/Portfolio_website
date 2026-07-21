export type ApplicationErrorCode =
  | 'CATALOG_ITEM_NOT_FOUND'
  | 'CATALOG_DATA_INVALID'
  | 'CONTENT_NOT_FOUND'
  | 'CHECKOUT_NOT_READY'
  | 'STORAGE_UNAVAILABLE';

export class ApplicationError extends Error {
  override readonly name = 'ApplicationError';

  constructor(
    readonly code: ApplicationErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
  }
}
