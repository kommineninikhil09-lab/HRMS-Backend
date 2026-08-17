import { Test, TestingModule } from '@nestjs/testing';
import { Pool } from 'pg';
import { UsersRepository } from './users.repository';
import { POOL_PROVIDER } from '../database/pool.provider';

describe('UsersRepository', () => {
  let repository: UsersRepository;
  let mockPool: jest.Mocked<Pool>;

  beforeEach(async () => {
    mockPool = {
      query: jest.fn(),
      connect: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersRepository,
        {
          provide: POOL_PROVIDER,
          useValue: mockPool,
        },
      ],
    }).compile();

    repository = module.get<UsersRepository>(UsersRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  it('should create a user', async () => {
    const mockUser = {
      id: '123',
      organizationId: 'org-1',
      email: 'test@example.com',
      passwordHash: 'hashed',
      authProvider: 'local',
      externalId: null,
      firstName: 'John',
      lastName: 'Doe',
      status: 'active',
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: null,
      updatedBy: null,
    };

    mockPool.query.mockResolvedValueOnce({
      rows: [mockUser],
    } as any);

    const result = await repository.create({
      organizationId: 'org-1',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      passwordHash: 'hashed',
    });

    expect(result).toEqual(mockUser);
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO users'),
      expect.arrayContaining(['org-1', 'test@example.com']),
    );
  });

  it('should find a user by id', async () => {
    const mockUser = {
      id: '123',
      organizationId: 'org-1',
      email: 'test@example.com',
    };

    mockPool.query.mockResolvedValueOnce({
      rows: [mockUser],
    } as any);

    const result = await repository.findById('org-1', '123');

    expect(result).toEqual(mockUser);
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT * FROM users'),
      ['org-1', '123'],
    );
  });
});
