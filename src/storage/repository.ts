// Metro chooses .native.ts on devices and .web.ts in browsers. TypeScript uses
// this fallback, whose public interface matches both platform implementations.
export { profileRepository } from './repository.web';
