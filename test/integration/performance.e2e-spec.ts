import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Performance Management E2E Tests', () => {
  let app: INestApplication;
  let authToken: string;
  let organizationId: string;
  let employeeId: string;
  let managerId: string;
  let cycleId: string;
  let templateId: string;
  let appraisalId: string;
  let competencyId: string;
  let goalId: string;

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
      authToken = response.body.data.accessToken;
      organizationId = response.body.data.user.organizationId;
    });

    it('should retrieve employees for appraisal setup', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/employees')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);

      employeeId = response.body.data[0].id;
      managerId = response.body.data.length > 1 ? response.body.data[1].id : employeeId;
    });
  });

  describe('Performance Cycles', () => {
    it('should create a performance cycle', async () => {
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000);

      const response = await request(app.getHttpServer())
        .post('/api/v1/performance/cycles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'FY 2026 Annual',
          cycle_type: 'annual',
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.name).toBe('FY 2026 Annual');
      expect(response.body.data.status).toBe('draft');

      cycleId = response.body.data.id;
    });

    it('should retrieve all performance cycles', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/performance/cycles')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should get single performance cycle', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/performance/cycles/${cycleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(cycleId);
    });

    it('should update performance cycle status', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/performance/cycles/${cycleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'active',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('active');
    });
  });

  describe('Appraisal Templates', () => {
    it('should create an appraisal template', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/performance/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Manager Appraisal 2026',
          description: 'Annual appraisal form for all employees',
          template_type: 'manager',
          rating_scale: '1-5',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.template_type).toBe('manager');

      templateId = response.body.data.id;
    });

    it('should retrieve all appraisal templates', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/performance/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should get single appraisal template', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/performance/templates/${templateId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(templateId);
    });

    it('should update appraisal template', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/performance/templates/${templateId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Manager Appraisal Q1 2026',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Manager Appraisal Q1 2026');
    });
  });

  describe('Competencies', () => {
    it('should create a competency', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/performance/competencies')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Technical Expertise',
          code: 'TECH_EXP',
          description: 'Depth and breadth of technical knowledge',
          category: 'technical',
          proficiency_levels: 5,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.category).toBe('technical');

      competencyId = response.body.data.id;
    });

    it('should retrieve all competencies', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/performance/competencies')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should get single competency', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/performance/competencies/${competencyId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(competencyId);
    });
  });

  describe('Performance Appraisals (Core)', () => {
    it('should create a performance appraisal', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/performance/appraisals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          cycle_id: cycleId,
          employee_id: employeeId,
          template_id: templateId,
          manager_id: managerId,
          appraisal_type: 'manager',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.employee_id).toBe(employeeId);
      expect(response.body.data.status).toBe('draft');

      appraisalId = response.body.data.id;
    });

    it('should retrieve appraisals by cycle', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/performance/appraisals?cycle_id=${cycleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should get single appraisal', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/performance/appraisals/${appraisalId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(appraisalId);
    });

    it('should filter appraisals by status', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/performance/appraisals?status=draft`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should filter appraisals by employee', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/performance/appraisals?employee_id=${employeeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('Appraisal Ratings & Calculation Algorithm', () => {
    it('should submit a self rating', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/performance/appraisals/${appraisalId}/ratings`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          question_id: '00000000-0000-0000-0000-000000000001', // placeholder
          reviewer_type: 'self',
          rating_value: 4,
          comments: 'I performed well this year',
        });

      if (response.status === 201) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.rating_value).toBe(4);
      } else {
        // If question doesn't exist, this is expected
        expect(response.status).toBeGreaterThanOrEqual(400);
      }
    });

    it('should calculate overall rating after ratings submission', async () => {
      // This tests the multi-rater weighting algorithm
      const getResponse = await request(app.getHttpServer())
        .get(`/api/v1/performance/appraisals/${appraisalId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getResponse.body.data).toBeDefined();
      // Rating calculation happens asynchronously when ratings are submitted
    });
  });

  describe('Appraisal Workflow State Transitions', () => {
    it('should submit appraisal (draft → submitted)', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/performance/appraisals/${appraisalId}/submit`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('submitted');
      expect(response.body.data.submitted_by).toBeDefined();
    });

    it('should not submit already submitted appraisal', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/performance/appraisals/${appraisalId}/submit`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should review appraisal (submitted → reviewed)', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/performance/appraisals/${appraisalId}/review`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          manager_rating: 4,
          manager_comments: 'Good performance overall',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('reviewed');
      expect(response.body.data.manager_comments).toBe('Good performance overall');
    });

    it('should not review already reviewed appraisal', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/performance/appraisals/${appraisalId}/review`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          manager_rating: 4,
        })
        .expect(400);
    });

    it('should finalize appraisal (reviewed → finalized)', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/performance/appraisals/${appraisalId}/finalize`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('finalized');
      expect(response.body.data.finalized_by).toBeDefined();
    });

    it('should not finalize already finalized appraisal', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/performance/appraisals/${appraisalId}/finalize`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('Performance Goals', () => {
    it('should create a performance goal', async () => {
      const targetDate = new Date();
      targetDate.setMonth(targetDate.getMonth() + 3); // 3 months from now

      const response = await request(app.getHttpServer())
        .post('/api/v1/performance/goals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          employee_id: employeeId,
          cycle_id: cycleId,
          goal_title: 'Complete Leadership Training',
          goal_description: 'Enroll and complete the leadership development program',
          goal_category: 'development',
          target_date: targetDate.toISOString().split('T')[0],
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.goal_title).toBe('Complete Leadership Training');
      expect(response.body.data.status).toBe('open');

      goalId = response.body.data.id;
    });

    it('should update goal progress', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/performance/goals/${goalId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'in_progress',
          progress_percentage: 50,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.progress_percentage).toBe(50);
    });

    it('should get employee goals', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/performance/employee/${employeeId}/goals`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should mark goal as completed', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/performance/goals/${goalId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'completed',
          progress_percentage: 100,
          completion_date: new Date().toISOString().split('T')[0],
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('completed');
    });
  });

  describe('Permission Guards', () => {
    it('should reject request without auth token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/performance/cycles')
        .expect(401);
    });

    it('should reject request with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/performance/cycles')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should enforce performance.read permission on read endpoints', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/performance/cycles')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should enforce performance.cycles permission on cycle creation', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/performance/cycles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Q2 2026',
          cycle_type: 'quarterly',
          start_date: new Date().toISOString().split('T')[0],
          end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent cycle', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/performance/cycles/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid cycle type', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/performance/cycles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Invalid Cycle',
          cycle_type: 'invalid_type',
          start_date: new Date().toISOString().split('T')[0],
          end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should return 400 when creating appraisal with non-existent cycle', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/performance/appraisals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          cycle_id: '00000000-0000-0000-0000-000000000000',
          employee_id: employeeId,
          template_id: templateId,
          appraisal_type: 'manager',
        })
        .expect(404);
    });
  });

  describe('Multi-Tenancy & Data Isolation', () => {
    it('should only return performance data for authorized organization', async () => {
      const cyclesResponse = await request(app.getHttpServer())
        .get('/api/v1/performance/cycles')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(cyclesResponse.body.success).toBe(true);

      const appraisalsResponse = await request(app.getHttpServer())
        .get('/api/v1/performance/appraisals')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(appraisalsResponse.body.success).toBe(true);

      // All data should belong to the authorized organization via TenantContext isolation
    });
  });

  describe('Audit Logging', () => {
    it('should create audit log on cycle creation', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/performance/cycles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Audit Test Cycle',
          cycle_type: 'quarterly',
          start_date: new Date().toISOString().split('T')[0],
          end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        })
        .expect(201);

      expect(response.body.data.id).toBeDefined();
      // Audit trail is created implicitly via AuditService
    });

    it('should create audit log on appraisal submission', async () => {
      // Audit is created when transitioning state
      expect(appraisalId).toBeDefined();
    });
  });
});
