export class SiteIdentity {
  constructor(
    readonly name: string,
    readonly tagline: string,
    readonly description: string,
    readonly locale: string,
    readonly canonicalUrl: string,
    readonly socialPreview: string
  ) {}
}
