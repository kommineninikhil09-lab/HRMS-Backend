import { Test, TestingModule } from '@nestjs/testing';
import { Pool } from 'pg';
import { RolesRepository } from './roles.repository';
import { POOL_PROVIDER } from '../database/pool.provider';

describe('RolesRepository', () => {
  let repository: RolesRepository;
  let mockPool: jest.Mocked<Pool>;

  beforeEach(async () => {
    mockPool = {
      query: jest.fn(),
      connect: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesRepository,
        {
          provide: POOL_PROVIDER,
          useValue: mockPool,
        },
      ],
    }).compile();

    repository = module.get<RolesRepository>(RolesRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  it('should create a role', async () => {
    const mockRole = {
      id: '123',
      organizationId: 'org-1',
      name: 'Admin',
      description: 'Administrator role',
      isSystem: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: null,
      updatedBy: null,
    };

    mockPool.query.mockResolvedValueOnce({
      rows: [mockRole],
    } as any);

    const result = await repository.create({
      organizationId: 'org-1',
      name: 'Admin',
      description: 'Administrator role',
      isSystem: true,
    });

    expect(result).toEqual(mockRole);
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO roles'),
      expect.arrayContaining(['org-1', 'Admin']),
    );
  });

  it('should find a role by id', async () => {
    const mockRole = {
      id: '123',
      organizationId: 'org-1',
      name: 'Admin',
    };

    mockPool.query.mockResolvedValueOnce({
      rows: [mockRole],
    } as any);

    const result = await repository.findById('org-1', '123');

    expect(result).toEqual(mockRole);
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT * FROM roles'),
      ['org-1', '123'],
    );
  });
});
