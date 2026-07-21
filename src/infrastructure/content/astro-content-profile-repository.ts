import { getEntry } from 'astro:content';
import type { ProfileRepository } from '@application/ports/repositories';
import { ApplicationError } from '@application/errors/application-error';
import { DateRange, Profile, Resume } from '@core/domain/profile/profile';

export class AstroContentProfileRepository implements ProfileRepository {
  async getProfile(): Promise<Profile> {
    const entry = await getEntry('profile', 'main');
    if (!entry) {
      throw new ApplicationError(
        'CONTENT_NOT_FOUND',
        'Profilo "main" non configurato nella Content Collection.'
      );
    }
    const data = entry.data;
    return new Profile(
      data.fullName,
      data.headline,
      data.biography,
      new Resume(
        data.resume.workExperience.map((item) => ({
          role: item.role,
          organization: item.organization,
          period: new DateRange(item.period),
          description: item.description
        })),
        data.resume.education.map((item) => ({
          qualification: item.qualification,
          institution: item.institution,
          period: new DateRange(item.period),
          description: item.description
        })),
        data.resume.skills
      ),
      data.hobbies,
      data.socialLinks,
      data.contactInformation
    );
  }
}
