# Microsoft Entra ID (Azure AD) Integration

## Overview

This document describes the planned Microsoft Entra ID integration for the HRMS platform. Currently, the Entra ID provider is a **stub that returns 501 Not Implemented**. This provides the architectural seam for future integration without blocking the development of other features.

## Architecture

The authentication system uses a provider-agnostic interface (`AuthProvider`) that allows multiple authentication strategies to coexist:

- **LocalAuthProvider** — email/password authentication (implemented ✓)
- **EntraAuthProvider** — Microsoft Entra ID / Azure AD (stub, this document)

Both providers implement the same interface and return an `AuthenticatedIdentity` object. The `AuthService` handles all post-authentication logic (token issuance, user lookup, account linking), so adding Entra ID is isolated to the provider implementation.

## Current Status

### Stub Implementation

The `EntraAuthProvider` currently throws `NotImplementedException` for both methods:

```typescript
export class EntraAuthProvider implements AuthProvider {
  getAuthorizationUrl(state: string): string {
    throw new NotImplementedException(
      'Entra ID authentication is not yet implemented. This is a stub for future integration.',
    );
  }

  async handleCallback(code: string, state: string): Promise<AuthenticatedIdentity> {
    throw new NotImplementedException(
      'Entra ID authentication is not yet implemented. This is a stub for future integration.',
    );
  }
}
```

### API Endpoints

Two endpoints exist to handle the Entra ID OAuth2 flow:

- `GET /api/v1/auth/entra/login?organizationId=<org-id>` — initiates login (currently returns 501)
- `GET /api/v1/auth/entra/callback?code=<code>&state=<state>` — handles Entra ID callback (currently returns 501)

Both endpoints are marked with `@Public()`, so they don't require a valid JWT.

## Implementation Roadmap

### Phase 1: Entra ID Configuration

**Requirements:**
- Azure subscription with Entra ID tenant
- App registration in Entra ID with:
  - Application ID (client ID)
  - Client secret (or certificate)
  - Reply URLs configured (e.g., `https://hrms.com/api/v1/auth/entra/callback`)
  - API permissions: `User.Read` (minimum)

**Environment variables needed:**
```bash
ENTRA_CLIENT_ID=<your-client-id>
ENTRA_CLIENT_SECRET=<your-client-secret>
ENTRA_TENANT_ID=<your-tenant-id>
ENTRA_REDIRECT_URI=https://hrms.com/api/v1/auth/entra/callback
```

These are already defined in `.env.example` as placeholders.

### Phase 2: Authorization Code Flow

**Step 1: User initiates login**
```
GET /api/v1/auth/entra/login?organizationId=<org-id>
```

Implementation should:
1. Generate a random `state` parameter (for CSRF protection)
2. Store state in Redis (with 10-minute expiry) or session
3. Build Entra ID authorization URL with:
   - `client_id`
   - `redirect_uri`
   - `scope=openid profile email`
   - `state=<random-state>`
4. Redirect user to Entra ID login

**Step 2: User authenticates with Entra ID**
- User logs in with their corporate credentials
- Entra ID prompts for consent (first time only)
- Entra ID redirects back to callback URL with authorization code

**Step 3: Backend exchanges code for tokens**
```
GET /api/v1/auth/entra/callback?code=<auth-code>&state=<state>
```

Implementation should:
1. Validate `state` parameter (CSRF check)
2. Call `entraAuthProvider.handleCallback(code, state)`
3. Exchange authorization code for tokens by calling:
   ```
   POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
   ```
   with:
   - `client_id`
   - `client_secret`
   - `code`
   - `redirect_uri`
4. Parse response to get `access_token` and optionally `id_token`
5. Get user identity by calling Microsoft Graph:
   ```
   GET https://graph.microsoft.com/v1.0/me
   Authorization: Bearer {access_token}
   ```
6. Extract user info: email, display name, etc.
7. Call `AuthService.findOrCreateUser()` (new method) to:
   - Look up user by email in HRMS
   - If not found, create new user with:
     - email
     - first_name (from display name)
     - last_name (from display name)
     - auth_provider: 'entra'
     - external_id: Entra user's object ID (for future linking)
8. Issue HRMS access + refresh tokens
9. Redirect to app with tokens (via BFF cookies)

## Data Model Changes Needed

### `users` table (already has these columns)

- `auth_provider` — already supports 'entra'
- `external_id` — already supports Entra user object ID
- `last_login_at` — track user logins

No schema changes required.

### New: `entra_user_tokens` table (optional)

If you want to refresh Entra tokens without user interaction:

```sql
CREATE TABLE entra_user_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

This allows:
- Calling Microsoft Graph APIs on behalf of the user
- Syncing Entra ID properties periodically
- Refreshing tokens when they expire

**Decision:** This is optional and can be added later if needed.

## Dependencies to Add

Install these packages:

```bash
npm install msal-node  # Microsoft Authentication Library for Node.js
# or
npm install axios      # for manual HTTP calls (simpler, fewer deps)
```

If using `msal-node`:
```typescript
import { ConfidentialClientApplication } from 'msal-node';
```

If using `axios`:
```typescript
import axios from 'axios';
```

## Security Considerations

### 1. CSRF Protection (State Parameter)

Every authorization request generates a random `state` parameter. The callback must validate it matches.

```typescript
// In login endpoint
const state = crypto.randomBytes(32).toString('hex');
await redis.setex(`entra-state:${state}`, 600, Date.now()); // 10-min expiry

// In callback endpoint
const storedState = await redis.get(`entra-state:${state}`);
if (!storedState) throw new BadRequestException('Invalid state (CSRF)');
await redis.del(`entra-state:${state}`); // Single-use
```

### 2. Secret Management

Never hardcode or log the client secret. Use environment variables and a secrets manager:

```typescript
// ✓ Good
const clientSecret = configService.get('ENTRA_CLIENT_SECRET');

// ✗ Bad
const clientSecret = 'hardcoded-secret-123';
```

### 3. Token Validation

Always validate JWT tokens returned by Entra ID:

```typescript
import { jwtDecode } from 'jwt-decode';

const decoded = jwtDecode(idToken);
if (decoded.aud !== clientId) throw new BadRequestException('Invalid audience');
if (decoded.exp < Date.now() / 1000) throw new BadRequestException('Token expired');
```

### 4. HTTPS Only

Ensure callback URLs are HTTPS. OAuth2 requires secure transport for sensitive data.

### 5. Permission Scopes

Request minimal scopes needed:
- `openid` — OpenID Connect (required)
- `profile` — Display name, picture
- `email` — Email address

Do NOT request overly broad scopes like `Mail.Read`, `Calendar.Read` unless needed.

## Testing

### Unit Tests

Already exists in `auth.controller.spec.ts`:

```bash
npm test src/auth/auth.controller.spec.ts
```

Tests verify that Entra endpoints return 501 Not Implemented.

### Integration Tests (Future)

Once implemented, test the full flow:

```typescript
describe('EntraAuthProvider', () => {
  it('should exchange authorization code for tokens', async () => {
    // Mock Microsoft token endpoint
    // Call entraAuthProvider.handleCallback('code', 'state')
    // Verify it returns AuthenticatedIdentity with email, firstName, lastName
  });

  it('should handle token refresh', async () => {
    // If implementing token refresh
  });

  it('should handle Entra ID errors', async () => {
    // Invalid code, state mismatch, etc.
  });
});
```

### Manual Testing (Future)

1. Navigate to `http://localhost:3000/auth/entra/login`
2. Redirected to Microsoft login
3. Authenticate with Entra credentials
4. Redirected back to callback
5. Receive HRMS JWT tokens
6. Use tokens to access protected endpoints

## Implementation Checklist

- [ ] Add `msal-node` or `axios` dependency
- [ ] Implement `EntraAuthProvider.getAuthorizationUrl()`
  - [ ] Generate state parameter
  - [ ] Store state in Redis/session
  - [ ] Build authorization URL
  - [ ] Return redirect URL
- [ ] Implement `EntraAuthProvider.handleCallback()`
  - [ ] Validate state parameter
  - [ ] Exchange code for tokens
  - [ ] Get user info from Microsoft Graph
  - [ ] Call `AuthService.findOrCreateUser()`
  - [ ] Return `AuthenticatedIdentity`
- [ ] Add `findOrCreateUser()` method to `AuthService`
- [ ] Update auth controller to use BFF redirect (vs direct token return)
- [ ] Add Entra ID environment variables to `.env`
- [ ] Create integration tests
- [ ] Manual testing with real Entra tenant
- [ ] Document Entra ID setup in user manual
- [ ] Add support for token refresh (optional)
- [ ] Add audit logging for Entra logins

## References

- [Microsoft Entra ID Documentation](https://learn.microsoft.com/en-us/azure/active-directory/)
- [OAuth 2.0 Authorization Code Flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow)
- [Microsoft Graph API](https://learn.microsoft.com/en-us/graph/overview)
- [MSAL Node Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-js/tree/dev/lib/msal-node)

## FAQ

**Q: Can Entra ID and local auth coexist?**
A: Yes! Both providers implement the same interface. Users can choose which auth method to use. Email should be unique across auth methods.

**Q: What if a user authenticates via Entra with email X, then tries local auth with X?**
A: The system should link them to the same user account (if email matches). Alternatively, require explicit account linking.

**Q: How do we handle Entra ID user properties changing (name, email)?**
A: Sync on login (simplest) or periodically (background job). Requires storing Entra tokens.

**Q: Can we enforce Entra ID for certain organizations?**
A: Yes. Add `auth_provider` column to `organizations` table to set a default. Or prompt user to choose on login page.

**Q: What about MFA?**
A: Entra ID handles MFA. If user has MFA enabled, Entra will prompt them. HRMS doesn't need to do anything.

**Q: How long should access tokens be valid?**
A: HRMS JWT tokens are 15 minutes (configurable). Entra ID tokens are separate (usually 1 hour). They're unrelated.
