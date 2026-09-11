import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { Pool } from 'pg';
import { AppModule } from '../../src/app.module';

/**
 * The one authorization test file that exercises every real scope kind
 * (`org` / `team` / `self`, resolved from `manager_scopes` + `scope.all` —
 * see `src/database/tenant-context.ts` and `src/common/scope/scope.util.ts`)
 * against a real running app and a real test database.
 *
 * This does NOT test `role_permissions.scope`, `ScopeService`, or
 * `ScopeGuard` — none of those exist in this codebase. It tests
 * `TenantContext.scope` and the real guard chain (`JwtAuthGuard` ->
 * `PermissionsGuard`), and the inline `assertActingOnEmployee` /
 * `scopedEmployeeIds` calls already present in Attendance and Leave.
 *
 * Fixture summary (built fresh in beforeAll against seeded users from
 * src/database/seeds/seed.ts):
 *   - org scope  : admin@dev-org.local (Super Admin, holds scope.all)
 *   - team scope : admin2@dev-org.local (plain Admin role, normally
 *                  self-scoped per seed.ts) after being assigned a
 *                  manager_scopes row covering a fresh department that
 *                  EMP001 (employee@dev-org.local) is moved into.
 *   - self scope : employee@dev-org.local (Employee role never gets
 *                  manager_scopes in seed data, so always resolves self).
 *   - out-of-team target: HRM001 (hrmanager@dev-org.local's employee
 *                  record), left outside the fresh department.
 *
 * Routes covered are only the ones that actually enforce scope today.
 * Everything else in the original (pre-reconciliation) plan's permission
 * list is `.skip`-ped with a comment naming the Phase 1 task that will
 * make it real — see Tasks.md P0-06 for the full list.
 */
describe('Authorization scope matrix (E2E)', () => {
  let app: INestApplication;
  let http: any;
  let pool: Pool;

  let orgToken: string;
  let teamToken: string;
  let selfToken: string;
  let inScopeEmployeeId: string; // EMP001 — moved into the fresh department
  let outOfScopeEmployeeId: string; // HRM001 — left outside it

  async function login(email: string, password: string): Promise<string> {
    const res = await request(http).post('/api/v1/auth/login').send({ email, password });
    if (res.status !== 200) {
      throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return res.body.data.accessToken as string;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('/api/v1');
    await app.init();
    http = app.getHttpServer();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });

    const superAdminToken = await login('admin@dev-org.local', 'Admin@123456');
    orgToken = superAdminToken;
    selfToken = await login('employee@dev-org.local', 'Employee@123456');

    const employeesRes = await request(http)
      .get('/api/v1/employees')
      .set('Authorization', `Bearer ${superAdminToken}`);
    const employees: any[] = employeesRes.body.data ?? [];
    const emp = employees.find((e) => e.work_email === 'employee@dev-org.local');
    const hrManagerEmp = employees.find((e) => e.work_email === 'hrmanager@dev-org.local');
    if (!emp || !hrManagerEmp) {
      throw new Error(
        `expected seeded employees not found in GET /employees response: ${JSON.stringify(employees)}`,
      );
    }
    inScopeEmployeeId = emp.id;
    outOfScopeEmployeeId = hrManagerEmp.id;

    // POST /departments is broken as of this writing (departments.repository.ts
    // inserts a `parent_business_unit_id` column that doesn't exist on
    // `departments` — that column belongs to `business_units`; `departments`
    // has `parent_department_id` instead — same copy-paste bug is present in
    // teams.repository.ts). Unrelated to scope enforcement, so worked around
    // here with a direct insert rather than fixed as part of this task —
    // flagged separately.
    const orgRow = await pool.query(`SELECT id FROM organizations LIMIT 1`);
    const organizationId = orgRow.rows[0].id as string;
    const buRow = await pool.query(
      `SELECT id FROM business_units WHERE organization_id = $1 LIMIT 1`,
      [organizationId],
    );
    if (buRow.rows.length === 0) {
      throw new Error('expected at least one business_unit to exist for this organization');
    }
    const businessUnitId = buRow.rows[0].id as string;

    const deptInsert = await pool.query(
      `INSERT INTO departments (organization_id, business_unit_id, name, code, status)
       VALUES ($1, $2, $3, $4, 'active') RETURNING id`,
      [organizationId, businessUnitId, `Scope Matrix Dept ${Date.now()}`, `SMD${Date.now()}`],
    );
    const departmentId = deptInsert.rows[0].id as string;

    const assignDeptRes = await request(http)
      .put(`/api/v1/employees/${inScopeEmployeeId}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ department_id: departmentId });
    if (assignDeptRes.status !== 200) {
      throw new Error(
        `assigning EMP001 to the fresh department failed: ${assignDeptRes.status} ${JSON.stringify(assignDeptRes.body)}`,
      );
    }

    const usersRes = await request(http)
      .get('/api/v1/users/admin/users?limit=50')
      .set('Authorization', `Bearer ${superAdminToken}`);
    const admin2 = (usersRes.body.data?.users ?? []).find((u: any) => u.email === 'admin2@dev-org.local');
    if (!admin2) {
      throw new Error(`admin2@dev-org.local not found in GET /admin/users: ${JSON.stringify(usersRes.body)}`);
    }

    const scopeRes = await request(http)
      .put(`/api/v1/users/admin/users/${admin2.id}/scopes`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ scopes: [{ scopeType: 'department', scopeId: departmentId }] });
    if (scopeRes.status !== 200) {
      throw new Error(
        `assigning admin2 department scope failed: ${scopeRes.status} ${JSON.stringify(scopeRes.body)}`,
      );
    }

    teamToken = await login('admin2@dev-org.local', 'Admin@123456');
  });

  afterAll(async () => {
    await pool.end();
    await app.close();
  });

  describe('Attendance — admin/:employeeId (adminEmployeeHistory), gated by attendance.manage', () => {
    it('org scope: reaches an in-scope and an out-of-scope target', async () => {
      await request(http)
        .get(`/api/v1/attendance/admin/${inScopeEmployeeId}`)
        .set('Authorization', `Bearer ${orgToken}`)
        .expect(200);
      await request(http)
        .get(`/api/v1/attendance/admin/${outOfScopeEmployeeId}`)
        .set('Authorization', `Bearer ${orgToken}`)
        .expect(200);
    });

    it('team scope: reaches the in-scope target, 403s on the out-of-scope one', async () => {
      await request(http)
        .get(`/api/v1/attendance/admin/${inScopeEmployeeId}`)
        .set('Authorization', `Bearer ${teamToken}`)
        .expect(200);
      await request(http)
        .get(`/api/v1/attendance/admin/${outOfScopeEmployeeId}`)
        .set('Authorization', `Bearer ${teamToken}`)
        .expect(403);
    });

    it('self scope: 403s on any admin route regardless of target (Employee role holds no attendance.manage grant)', async () => {
      await request(http)
        .get(`/api/v1/attendance/admin/${inScopeEmployeeId}`)
        .set('Authorization', `Bearer ${selfToken}`)
        .expect(403);
    });
  });

  describe('Attendance — admin/:employeeId/summary (adminEmployeeSummary)', () => {
    it('team scope: in-scope target succeeds, out-of-scope target 403s', async () => {
      await request(http)
        .get(`/api/v1/attendance/admin/${inScopeEmployeeId}/summary`)
        .set('Authorization', `Bearer ${teamToken}`)
        .expect(200);
      await request(http)
        .get(`/api/v1/attendance/admin/${outOfScopeEmployeeId}/summary`)
        .set('Authorization', `Bearer ${teamToken}`)
        .expect(403);
    });

    it('org scope: succeeds for any target', async () => {
      await request(http)
        .get(`/api/v1/attendance/admin/${outOfScopeEmployeeId}/summary`)
        .set('Authorization', `Bearer ${orgToken}`)
        .expect(200);
    });
  });

  describe('Attendance — POST admin/mark (markAttendance), employee_id read from the body', () => {
    it('team scope: marking the in-scope employee succeeds, the out-of-scope one 403s', async () => {
      await request(http)
        .post('/api/v1/attendance/admin/mark')
        .set('Authorization', `Bearer ${teamToken}`)
        .send({ employee_id: inScopeEmployeeId, attendance_date: '2030-01-15', status: 'present' })
        .expect(201);

      await request(http)
        .post('/api/v1/attendance/admin/mark')
        .set('Authorization', `Bearer ${teamToken}`)
        .send({ employee_id: outOfScopeEmployeeId, attendance_date: '2030-01-15', status: 'present' })
        .expect(403);
    });
  });

  describe('Leave — GET balance/employee/:employeeId, gated by leave.read', () => {
    it('team scope: in-scope succeeds, out-of-scope 403s', async () => {
      await request(http)
        .get(`/api/v1/leave/balance/employee/${inScopeEmployeeId}`)
        .set('Authorization', `Bearer ${teamToken}`)
        .expect(200);
      await request(http)
        .get(`/api/v1/leave/balance/employee/${outOfScopeEmployeeId}`)
        .set('Authorization', `Bearer ${teamToken}`)
        .expect(403);
    });

    it('org scope: succeeds for any target', async () => {
      await request(http)
        .get(`/api/v1/leave/balance/employee/${outOfScopeEmployeeId}`)
        .set('Authorization', `Bearer ${orgToken}`)
        .expect(200);
    });
  });

  describe('Leave — GET employee/:employeeId/requests, gated by leave.read', () => {
    it('team scope: in-scope succeeds, out-of-scope 403s', async () => {
      await request(http)
        .get(`/api/v1/leave/employee/${inScopeEmployeeId}/requests`)
        .set('Authorization', `Bearer ${teamToken}`)
        .expect(200);
      await request(http)
        .get(`/api/v1/leave/employee/${outOfScopeEmployeeId}/requests`)
        .set('Authorization', `Bearer ${teamToken}`)
        .expect(403);
    });

    it('self scope: acting on yourself always succeeds, even with no management scope', async () => {
      await request(http)
        .get(`/api/v1/leave/employee/${inScopeEmployeeId}/requests`)
        .set('Authorization', `Bearer ${selfToken}`)
        .expect(200);
    });
  });

  // ---------------------------------------------------------------------
  // Not yet enforced — Phase 1 hasn't landed on these modules. Written
  // against the routes as they exist today so the assertions are ready
  // the moment each task ships; skipped until then rather than omitted.
  // ---------------------------------------------------------------------

  describe.skip('Employees — getById/update/delete scope-gating (blocked on P1-01)', () => {
    it('team scope: 403s on an out-of-scope employee id', async () => {
      await request(http)
        .get(`/api/v1/employees/${outOfScopeEmployeeId}`)
        .set('Authorization', `Bearer ${teamToken}`)
        .expect(403);
    });
  });

  describe.skip('Employees — getAll scope-filtering (blocked on P1-02)', () => {
    it('self scope: GET /employees returns only the caller', async () => {
      const res = await request(http)
        .get('/api/v1/employees')
        .set('Authorization', `Bearer ${selfToken}`)
        .expect(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe.skip('Employees — sensitive-fields endpoint (blocked on P1-03)', () => {
    it('Employee role gets 403 even for their own id', async () => {
      await request(http)
        .get(`/api/v1/employees/${inScopeEmployeeId}/sensitive`)
        .set('Authorization', `Bearer ${selfToken}`)
        .expect(403);
    });
  });

  describe.skip('Payroll — employee-keyed and slip routes (blocked on P1-11, P1-12)', () => {
    it('team scope: 403s on an out-of-scope employee id', async () => {
      await request(http)
        .get(`/api/v1/payroll/employee/${outOfScopeEmployeeId}/slips`)
        .set('Authorization', `Bearer ${teamToken}`)
        .expect(403);
    });
  });

  describe.skip('Payroll — approve/mark-paid locked to org scope (blocked on P1-13)', () => {
    it('team scope with payroll.approve still 403s — org-only regardless of target', async () => {
      // Placeholder: needs a real slip id and a payroll.approve grant on the
      // team-scoped fixture to be meaningful; wire up once P1-13 lands.
    });
  });

  describe.skip('Performance — resource-keyed appraisal + goals (blocked on P1-14, P1-15, P1-16)', () => {
    it('team scope: 403s on an out-of-scope appraisal', async () => {
      // Placeholder pending P1-14.
    });
  });

  describe.skip('Audit — logs locked to org scope (blocked on P1-21)', () => {
    it('team scope gets 403 regardless of audit.read grant', async () => {
      await request(http)
        .get('/api/v1/audit/logs')
        .set('Authorization', `Bearer ${teamToken}`)
        .expect(403);
    });
  });
});
