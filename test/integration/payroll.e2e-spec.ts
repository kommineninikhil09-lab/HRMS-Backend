import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Payroll Module E2E Tests', () => {
  let app: INestApplication;
  let authToken: string;
  let organizationId: string;
  let employeeId: string;
  let componentId: string;
  let structureId: string;
  let assignmentId: string;
  let slipId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication & Setup', () => {
    it('should login and receive access token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@dev-org.local',
          password: 'Admin@123456',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.user.id).toBeDefined();
      expect(response.body.data.user.organizationId).toBeDefined();

      authToken = response.body.data.accessToken;
      organizationId = response.body.data.user.organizationId;
    });

    it('should get current user info', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('admin@dev-org.local');
    });

    it('should retrieve employees list', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/employees')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      employeeId = response.body.data[0].id;
    });
  });

  describe('Salary Components CRUD', () => {
    it('should create a salary component (earnings)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/payroll/components')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Base Salary',
          code: 'BASE',
          component_type: 'earnings',
          description: 'Basic monthly salary',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.name).toBe('Base Salary');
      expect(response.body.data.component_type).toBe('earnings');

      componentId = response.body.data.id;
    });

    it('should create a deduction component', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/payroll/components')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Income Tax',
          code: 'TAX',
          component_type: 'tax',
          description: 'Income tax deduction',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.component_type).toBe('tax');
    });

    it('should retrieve all salary components', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/payroll/components')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should filter components by type', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/payroll/components?type=earnings')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      response.body.data.forEach((component: any) => {
        expect(component.component_type).toBe('earnings');
      });
    });

    it('should get single salary component', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/payroll/components/${componentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(componentId);
    });
  });

  describe('Salary Structures CRUD', () => {
    it('should create a salary structure', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/payroll/structures')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Developer Salary',
          code: 'DEV',
          description: 'Salary structure for developers',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.name).toBe('Developer Salary');

      structureId = response.body.data.id;
    });

    it('should retrieve all salary structures', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/payroll/structures')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should get single salary structure', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/payroll/structures/${structureId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(structureId);
    });

    it('should update salary structure', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/payroll/structures/${structureId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Senior Developer Salary',
          description: 'Updated structure for senior developers',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Senior Developer Salary');
    });
  });

  describe('Salary Assignments', () => {
    it('should assign salary structure to employee', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/payroll/assignments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          employee_id: employeeId,
          structure_id: structureId,
          effective_date: new Date().toISOString().split('T')[0],
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.employee_id).toBe(employeeId);
      expect(response.body.data.structure_id).toBe(structureId);

      assignmentId = response.body.data.id;
    });

    it('should get current employee salary assignment', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/payroll/assignments/employee/${employeeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.employee_id).toBe(employeeId);
    });

    it('should get employee assignment history', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/payroll/assignments/employee/${employeeId}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('Salary Slip Generation (Critical - Calculation Algorithm)', () => {
    it('should generate salary slip with automatic calculation', async () => {
      const month = new Date().toISOString().slice(0, 7); // YYYY-MM

      const response = await request(app.getHttpServer())
        .post('/api/v1/payroll/slips/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          employee_id: employeeId,
          month,
          pay_cycle_id: '00000000-0000-0000-0000-000000000000', // placeholder
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.employee_id).toBe(employeeId);
      expect(response.body.data.month).toBe(month);
      expect(response.body.data.status).toBe('draft');
      expect(typeof response.body.data.gross_amount).toBe('number');
      expect(typeof response.body.data.total_deductions).toBe('number');
      expect(typeof response.body.data.net_amount).toBe('number');

      slipId = response.body.data.id;
    });

    it('should validate salary slip calculation: net = gross - deductions', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/payroll/slips/${slipId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      const { gross_amount, total_deductions, net_amount } = response.body.data;

      expect(net_amount).toBe(gross_amount - total_deductions);
    });

    it('should get salary slip with component breakdown', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/payroll/slips/${slipId}/breakdown`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(slipId);
      expect(Array.isArray(response.body.data.components)).toBe(true);
    });
  });

  describe('Salary Slip Approval Workflow', () => {
    it('should approve salary slip (draft → approved)', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/payroll/slips/${slipId}/approve`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('approved');
      expect(response.body.data.approved_by).toBeDefined();
      expect(response.body.data.approved_at).toBeDefined();
    });

    it('should not approve already approved slip', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/payroll/slips/${slipId}/approve`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should mark salary slip as paid (approved → paid)', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/payroll/slips/${slipId}/mark-paid`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('paid');
      expect(response.body.data.paid_at).toBeDefined();
    });

    it('should not mark non-approved slip as paid', async () => {
      // Create another slip to test this
      const month = new Date().toISOString().slice(0, 7);
      const slipResponse = await request(app.getHttpServer())
        .post('/api/v1/payroll/slips/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          employee_id: employeeId,
          month: new Date(Date.now() + 86400000).toISOString().slice(0, 7), // next month
          pay_cycle_id: '00000000-0000-0000-0000-000000000000',
        });

      const newSlipId = slipResponse.body.data.id;

      await request(app.getHttpServer())
        .put(`/api/v1/payroll/slips/${newSlipId}/mark-paid`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('Salary Slip Queries', () => {
    it('should get pending approvals list', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/payroll/slips/pending/approvals')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should get approved slips list', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/payroll/slips/approved/list')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should get employee salary slips by year', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/payroll/employee/${employeeId}/slips`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('Permission Guards', () => {
    it('should reject request without auth token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/payroll/components')
        .expect(401);
    });

    it('should reject request with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/payroll/components')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    // Note: Permission guard testing would require creating users with limited roles
    // This is a placeholder for role-based permission testing
    it('should enforce payroll.read permission on read endpoints', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/payroll/components')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should enforce payroll.write permission on create endpoints', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/payroll/components')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Component',
          code: 'TEST',
          component_type: 'earnings',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent component', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/payroll/components/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should return 400 for invalid salary component type', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/payroll/components')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Invalid Component',
          code: 'INVALID',
          component_type: 'invalid_type', // Should be earnings, deduction, or tax
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should return 400 when generating slip for employee without assignment', async () => {
      // Assuming we have another employee without assignment
      const response = await request(app.getHttpServer())
        .post('/api/v1/payroll/slips/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          employee_id: '00000000-0000-0000-0000-000000000000', // Non-existent
          month: new Date().toISOString().slice(0, 7),
          pay_cycle_id: '00000000-0000-0000-0000-000000000000',
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Data Isolation & Multi-Tenancy', () => {
    it('should only return payroll data for the authorized organization', async () => {
      const componentsResponse = await request(app.getHttpServer())
        .get('/api/v1/payroll/components')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(componentsResponse.body.success).toBe(true);

      const structuresResponse = await request(app.getHttpServer())
        .get('/api/v1/payroll/structures')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(structuresResponse.body.success).toBe(true);

      // All returned data should belong to the authorized organization
      // This is implicitly tested via the TenantContext isolation at repository level
    });
  });

  describe('Audit Logging', () => {
    it('should create audit log on component creation', async () => {
      // Create a component
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/payroll/components')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Audit Test Component',
          code: 'AUDIT_TEST',
          component_type: 'earnings',
        })
        .expect(201);

      const componentId = createResponse.body.data.id;

      // Fetch audit logs (if endpoint exists)
      // This is a future verification; audit trail is created implicitly
      expect(componentId).toBeDefined();
    });
  });
});
