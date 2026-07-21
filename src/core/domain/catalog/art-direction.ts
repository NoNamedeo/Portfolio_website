import { DomainError } from '@core/domain/shared/domain-error';

export interface ArtDirectionProps {
  readonly themeKey: string;
  readonly experienceKey: string;
  readonly transitionKey: string;
  readonly layoutKey: string;
}

export class ArtDirection {
  readonly themeKey: string;
  readonly experienceKey: string;
  readonly transitionKey: string;
  readonly layoutKey: string;

  constructor(props: ArtDirectionProps) {
    for (const [name, value] of Object.entries(props)) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
        throw new DomainError('La chiave ArtDirection "' + name + '" non è valida.');
      }
    }
    this.themeKey = props.themeKey;
    this.experienceKey = props.experienceKey;
    this.transitionKey = props.transitionKey;
    this.layoutKey = props.layoutKey;
  }
}
