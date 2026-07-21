import { DomainError } from '@core/domain/shared/domain-error';

export class DateRange {
  readonly start: string;
  readonly end?: string;

  constructor(props: { start: string; end?: string }) {
    const validMonth = /^\d{4}-(?:0[1-9]|1[0-2])$/;
    if (!validMonth.test(props.start) || (props.end && !validMonth.test(props.end))) {
      throw new DomainError('L’intervallo di date deve usare il formato YYYY-MM.');
    }
    if (props.end && props.end < props.start) {
      throw new DomainError('La data finale non può precedere quella iniziale.');
    }
    this.start = props.start;
    this.end = props.end;
  }

  isCurrent(): boolean {
    return this.end === undefined;
  }
}

export interface WorkExperience {
  readonly role: string;
  readonly organization: string;
  readonly period: DateRange;
  readonly description: string;
}

export interface Education {
  readonly qualification: string;
  readonly institution: string;
  readonly period: DateRange;
  readonly description: string;
}

export interface ProfileSkill {
  readonly name: string;
  readonly level: string;
}

export class Resume {
  constructor(
    readonly workExperience: readonly WorkExperience[],
    readonly education: readonly Education[],
    readonly skills: readonly ProfileSkill[]
  ) {}
}

export interface SocialLink {
  readonly label: string;
  readonly href: string;
}

export class Profile {
  constructor(
    readonly fullName: string,
    readonly headline: string,
    readonly biography: string,
    readonly resume: Resume,
    readonly hobbies: readonly string[],
    readonly socialLinks: readonly SocialLink[],
    readonly contactInformation: { readonly email: string; readonly location: string }
  ) {}
}
