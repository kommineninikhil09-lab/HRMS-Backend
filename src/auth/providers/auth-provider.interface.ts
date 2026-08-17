export interface AuthenticatedIdentity {
  email: string;
  firstName: string;
  lastName: string;
  externalId?: string;
}

export interface AuthProvider {
  /**
   * Validate local credentials (email/password)
   * Used by local auth provider for login
   */
  validateCredentials?(
    email: string,
    password: string,
  ): Promise<AuthenticatedIdentity | null>;

  /**
   * Get authorization URL for OAuth/OIDC flow
   * Used by Entra ID provider
   */
  getAuthorizationUrl?(state: string): string;

  /**
   * Handle OAuth/OIDC callback
   * Used by Entra ID provider to exchange code for identity
   */
  handleCallback?(code: string, state: string): Promise<AuthenticatedIdentity>;
}
