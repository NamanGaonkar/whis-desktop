import { WhisAPI } from '../shared/types';

declare global {
  interface Window {
    whis: WhisAPI;
  }
}

export {};
