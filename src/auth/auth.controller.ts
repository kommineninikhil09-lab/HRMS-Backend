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
import { AuthService, LoginResponse, RefreshResponse } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { EntraAuthProvider } from './providers/entra-auth.provider';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private entraAuthProvider: EntraAuthProvider,
  ) {}

  @Post('login')
  @Public()
  @HttpCode(200)
  async login(@Body() loginDto: LoginDto, @Request() req): Promise<LoginResponse> {
    const clientIp = (req.ip || req.connection?.remoteAddress || '').split(':').pop();
    return this.authService.login(loginDto.email, loginDto.password, clientIp);
  }

  @Post('refresh')
  @Public()
  @HttpCode(200)
  async refresh(@Body() body: { refreshToken: string }): Promise<RefreshResponse> {
    if (!body.refreshToken) {
      throw new BadRequestException('refreshToken is required');
    }

    // Decode refresh token to get user info and token ID
    try {
      const decoded: any = this.authService['jwtService'].decode(body.refreshToken);

      if (!decoded || !decoded.sub || !decoded.organizationId || !decoded.tokenId) {
        throw new BadRequestException('Invalid refresh token');
      }

      return await this.authService.refresh(
        decoded.sub,
        decoded.organizationId,
        decoded.tokenId,
      );
    } catch (error) {
      throw new BadRequestException('Invalid refresh token');
    }
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async logout(@Request() req): Promise<void> {
    // Extract refresh token ID from body if provided
    // For now, this is a simple logout that doesn't require token revocation
    // In a real app, you'd track which refresh tokens to revoke per user
    return;
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
