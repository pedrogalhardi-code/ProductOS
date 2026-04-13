import { UserDto } from '../../../shared/types';

declare global {
  namespace Express {
    interface Request {
      user?: UserDto;
      userId?: string;
    }
  }
}

export {};
