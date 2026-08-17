import { Injectable, NotImplementedException } from '@nestjs/common';
import { AuthProvider, AuthenticatedIdentity } from './auth-provider.interface';

@Injectable()
export class EntraAuthProvider implements AuthProvider {
  getAuthorizationUrl(state: string): string {
    throw new NotImplementedException(
      'Entra ID authentication is not yet implemented. This is a stub for future integration.',
    );
  }

  async handleCallback(
    code: string,
    state: string,
  ): Promise<AuthenticatedIdentity> {
    throw new NotImplementedException(
      'Entra ID authentication is not yet implemented. This is a stub for future integration.',
    );
  }
}
