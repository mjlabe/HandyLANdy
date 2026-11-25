import AsyncStorage from '@react-native-async-storage/async-storage';
import { createProfileRepository, CredentialStorageUnavailableError } from './profiles';

// Browser storage is suitable for metadata, but never for printer access codes.
const unavailable = async (): Promise<never> => { throw new CredentialStorageUnavailableError(); };
export const profileRepository = createProfileRepository(AsyncStorage, {
  getItem: unavailable,
  setItem: unavailable,
  removeItem: unavailable,
});
