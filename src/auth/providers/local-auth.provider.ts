import { Injectable } from '@nestjs/common';
import { UsersService } from '../../users/users.service';
import { AuthProvider, AuthenticatedIdentity } from './auth-provider.interface';

@Injectable()
export class LocalAuthProvider implements AuthProvider {
  constructor(private usersService: UsersService) {}

  async validateCredentials(
    email: string,
    password: string,
  ): Promise<AuthenticatedIdentity | null> {
    const user = await this.usersService.validatePassword(email, password);

    if (!user) {
      return null;
    }

    return {
      email: user.email,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
    };
  }
}
