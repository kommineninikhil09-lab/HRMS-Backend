import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RefreshTokensRepository } from './refresh-tokens.repository';
import { LocalAuthProvider } from './providers/local-auth.provider';
import { TransactionService } from '../database/transaction.service';

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    organizationId: string;
  };
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
    private usersService: UsersService,
    private refreshTokensRepository: RefreshTokensRepository,
    private localAuthProvider: LocalAuthProvider,
    private transactionService: TransactionService,
  ) {}

  async login(
    email: string,
    password: string,
    clientIp?: string,
  ): Promise<LoginResponse> {
    // Validate credentials
    const identity = await this.localAuthProvider.validateCredentials(
      email,
      password,
    );

    if (!identity) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Find user to get organization and ID
    const user = await this.usersService.getUserByEmail(email);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Issue access token (short-lived)
    const accessToken = this.jwtService.sign(
      {
        sub: user.id,
        organizationId: user.organizationId,
        email: user.email,
      },
      {
        secret: this.configService.get('auth.jwtSecret'),
        expiresIn: this.configService.get('auth.jwtExpiresIn'),
      },
    );

    // Issue refresh token (long-lived, opaque, stored hashed)
    const refreshTokenExpiresIn = this.parseExpiresIn(
      this.configService.get('auth.refreshTokenExpiresIn') || '7d',
    );

    const { id: refreshTokenId, token: refreshToken } =
      await this.refreshTokensRepository.create(
        user.organizationId,
        user.id,
        refreshTokenExpiresIn,
        clientIp,
      );

    // Create JWT for refresh token (includes token ID for rotation tracking)
    const refreshTokenJwt = this.jwtService.sign(
      {
        sub: user.id,
        organizationId: user.organizationId,
        tokenId: refreshTokenId,
      },
      {
        secret: this.configService.get('auth.jwtSecret'),
        expiresIn: this.configService.get('auth.refreshTokenExpiresIn'),
      },
    );

    // Update last login
    await this.usersService.updateLastLogin(user.organizationId, user.id);

    return {
      accessToken,
      refreshToken: refreshTokenJwt, // Return the JWT, not the opaque token
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        organizationId: user.organizationId,
      },
    };
  }

  async refresh(
    userId: string,
    organizationId: string,
    refreshTokenId: string,
  ): Promise<RefreshResponse> {
    // Verify refresh token exists and is not revoked
    const refreshToken = await this.refreshTokensRepository.findById(
      refreshTokenId,
    );

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    if (refreshToken.revokedAt) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    if (new Date() > refreshToken.expiresAt) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    // Issue new access token
    const accessToken = this.jwtService.sign(
      {
        sub: userId,
        organizationId,
        email: '', // Could be populated from DB if needed
      },
      {
        secret: this.configService.get('auth.jwtSecret'),
        expiresIn: this.configService.get('auth.jwtExpiresIn'),
      },
    );

    // Issue new refresh token and rotate
    const refreshTokenExpiresIn = this.parseExpiresIn(
      this.configService.get('auth.refreshTokenExpiresIn') || '7d',
    );

    const { id: newRefreshTokenId, token: newRefreshToken } =
      await this.refreshTokensRepository.create(
        organizationId,
        userId,
        refreshTokenExpiresIn,
      );

    // Mark old token as replaced by new one
    await this.refreshTokensRepository.markReplaced(
      refreshTokenId,
      newRefreshTokenId,
    );

    // Create JWT for new refresh token
    const newRefreshTokenJwt = this.jwtService.sign(
      {
        sub: userId,
        organizationId,
        tokenId: newRefreshTokenId,
      },
      {
        secret: this.configService.get('auth.jwtSecret'),
        expiresIn: this.configService.get('auth.refreshTokenExpiresIn'),
      },
    );

    return {
      accessToken,
      refreshToken: newRefreshTokenJwt,
    };
  }

  async logout(refreshTokenId: string): Promise<void> {
    // Revoke the refresh token
    await this.refreshTokensRepository.revoke(refreshTokenId);
  }

  /**
   * Parse expiry duration string (e.g., "7d", "24h", "1800s") to seconds
   */
  private parseExpiresIn(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([dhms])$/);
    if (!match) {
      throw new BadRequestException(`Invalid expiry format: ${expiresIn}`);
    }

    const [, value, unit] = match;
    const amount = parseInt(value, 10);

    switch (unit) {
      case 'd':
        return amount * 24 * 60 * 60; // days to seconds
      case 'h':
        return amount * 60 * 60; // hours to seconds
      case 'm':
        return amount * 60; // minutes to seconds
      case 's':
        return amount; // already seconds
      default:
        throw new BadRequestException(`Invalid expiry unit: ${unit}`);
    }
  }
}
