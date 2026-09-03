import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  HttpCode,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService, LoginResponse, RefreshResponse } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from '../common/decorators/public.decorator';
import { LoginThrottleGuard } from './guards/login-throttle.guard';
import { EntraAuthProvider } from './providers/entra-auth.provider';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private entraAuthProvider: EntraAuthProvider,
  ) {}

  @Post('login')
  @Public()
  @UseGuards(LoginThrottleGuard)
  @HttpCode(200)
  async login(@Body() loginDto: LoginDto, @Request() req): Promise<LoginResponse> {
    const clientIp = (req.ip || req.connection?.remoteAddress || '').split(':').pop();
    return this.authService.login(loginDto.email, loginDto.password, clientIp);
  }

  /**
   * Rotate tokens. The refresh JWT is taken from the `refreshToken` body field
   * and its signature + expiry are verified by the `jwt-refresh` strategy.
   */
  @Post('refresh')
  @Public()
  @UseGuards(AuthGuard('jwt-refresh'))
  @HttpCode(200)
  async refresh(@Request() req): Promise<RefreshResponse> {
    return this.authService.refresh(
      req.user.sub,
      req.user.organizationId,
      req.user.tokenId,
    );
  }

  /**
   * Revoke the caller's refresh token. Public + idempotent: it identifies the
   * token to revoke from the `refreshToken` body field, so it still works once
   * the access token has expired.
   */
  @Post('logout')
  @Public()
  @HttpCode(204)
  async logout(@Body() body: { refreshToken?: string }): Promise<void> {
    if (body?.refreshToken) {
      await this.authService.logoutByRefreshToken(body.refreshToken);
    }
  }

  /**
   * Entra ID / Microsoft OAuth2 Flow - STUB (Not Implemented)
   *
   * Future implementation will:
   * 1. Generate authorization URL
   * 2. Redirect user to Microsoft Entra ID login
   * 3. Handle callback from Entra ID with authorization code
   * 4. Exchange code for access token
   * 5. Get user identity from Microsoft Graph
   * 6. Link/create user in HRMS
   * 7. Issue HRMS JWT tokens
   */

  @Get('entra/login')
  @Public()
  async entraLogin(@Query('organizationId') organizationId?: string) {
    // This endpoint will eventually:
    // 1. Accept organizationId as query parameter
    // 2. Generate state for CSRF protection
    // 3. Call entraAuthProvider.getAuthorizationUrl()
    // 4. Redirect to Microsoft Entra ID authorization endpoint
    return this.entraAuthProvider.getAuthorizationUrl('state');
  }

  @Get('entra/callback')
  @Public()
  async entraCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error?: string,
    @Query('error_description') errorDescription?: string,
  ) {
    // Handle errors from Entra ID
    if (error) {
      throw new BadRequestException(
        `Entra ID authentication failed: ${error} - ${errorDescription || 'No description provided'}`,
      );
    }

    if (!code) {
      throw new BadRequestException('Authorization code is required');
    }

    // This endpoint will eventually:
    // 1. Validate state parameter (CSRF check)
    // 2. Call entraAuthProvider.handleCallback(code, state)
    // 3. Exchange code for access token
    // 4. Get user identity from Microsoft Graph
    // 5. Find or create user in HRMS
    // 6. Issue JWT tokens
    return this.entraAuthProvider.handleCallback(code, state);
  }
}
