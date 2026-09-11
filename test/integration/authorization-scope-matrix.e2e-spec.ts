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

    // admin2's role (Admin) holds none of payroll.*/performance.*/audit.read
    // by default — confirmed against the real seed data (src/database/seeds/seed.ts's
    // adminPermissions list) and the migrations that create those permission
    // codes (neither grants them to anyone but Super Admin). The dev database
    // has untracked drift where Admin additionally holds payroll.read/
    // payroll.approve — a further instance of the same undocumented-grant
    // pattern found elsewhere this session (permission_scope,
    // employee.sensitive.read). Granting these here, test-fixture-only, so
    // the team-scope assertions below test the scope lock specifically,
    // not an incidental permission-denied from a role that was never given
    // the permission at all.
    await pool.query(`
      INSERT INTO role_permissions (organization_id, role_id, permission_id)
      SELECT r.organization_id, r.id, p.id
      FROM roles r, permissions p
      WHERE r.name = 'Admin'
        AND p.code IN (
          'payroll.read', 'payroll.write', 'payroll.process', 'payroll.approve',
          'performance.read', 'performance.write', 'performance.cycles', 'performance.templates',
          'performance.goals.read', 'performance.goals.write',
          'audit.read',
          'announcement.update', 'post.delete', 'organization_structure.write'
        )
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    `);
    // admin2's token was minted before this grant — the JWT itself doesn't
    // carry permissions (those are resolved fresh per request), so no
    // re-login is needed for the new grants to take effect.
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

    it('self scope: reaches your own balance, 403s on anyone else (P1-22)', async () => {
      await request(http)
        .get(`/api/v1/leave/balance/employee/${inScopeEmployeeId}`)
        .set('Authorization', `Bearer ${selfToken}`)
        .expect(200);
      await request(http)
        .get(`/api/v1/leave/balance/employee/${outOfScopeEmployeeId}`)
        .set('Authorization', `Bearer ${selfToken}`)
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

    it('self scope: 403s on anyone else (P1-22)', async () => {
      await request(http)
        .get(`/api/v1/leave/employee/${outOfScopeEmployeeId}/requests`)
        .set('Authorization', `Bearer ${selfToken}`)
        .expect(403);
    });

    it('org scope: succeeds for any target (P1-22)', async () => {
      await request(http)
        .get(`/api/v1/leave/employee/${outOfScopeEmployeeId}/requests`)
        .set('Authorization', `Bearer ${orgToken}`)
        .expect(200);
    });
  });

  // ---------------------------------------------------------------------
  // Formerly skipped pending Phase 1 — all landed now, so these run for
  // real. admin2 (Admin role) was granted payroll.*/performance.*/
  // audit.read as a test-fixture-only step above, so these assertions
  // test the scope lock specifically, not an incidental permission-denied.
  // ---------------------------------------------------------------------

  describe('Employees — getById/update/delete scope-gating (P1-01)', () => {
    it('team scope: reaches the in-scope target, 403s on the out-of-scope one', async () => {
      await request(http)
        .get(`/api/v1/employees/${inScopeEmployeeId}`)
        .set('Authorization', `Bearer ${teamToken}`)
        .expect(200);
      await request(http)
        .get(`/api/v1/employees/${outOfScopeEmployeeId}`)
        .set('Authorization', `Bearer ${teamToken}`)
        .expect(403);
    });

    it('self scope: reaches your own record, 403s on anyone else (P1-22)', async () => {
      await request(http)
        .get(`/api/v1/employees/${inScopeEmployeeId}`)
        .set('Authorization', `Bearer ${selfToken}`)
        .expect(200);
      await request(http)
        .get(`/api/v1/employees/${outOfScopeEmployeeId}`)
        .set('Authorization', `Bearer ${selfToken}`)
        .expect(403);
    });

    it('org scope: reaches any target (P1-22)', async () => {
      await request(http)
        .get(`/api/v1/employees/${outOfScopeEmployeeId}`)
        .set('Authorization', `Bearer ${orgToken}`)
        .expect(200);
    });
  });

  describe('Employees — getAll scope-filtering (P1-02)', () => {
    it('self scope: GET /employees returns only the caller', async () => {
      const res = await request(http)
        .get('/api/v1/employees')
        .set('Authorization', `Bearer ${selfToken}`)
        .expect(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(inScopeEmployeeId);
    });
  });

  describe('Employees — sensitive-fields endpoint (P1-03)', () => {
    it('Employee role gets 403 even for their own id (no employee.sensitive.read grant)', async () => {
      await request(http)
        .get(`/api/v1/employees/${inScopeEmployeeId}/sensitive`)
        .set('Authorization', `Bearer ${selfToken}`)
        .expect(403);
    });

    it('org scope with employee.sensitive.read succeeds', async () => {
      await request(http)
        .get(`/api/v1/employees/${inScopeEmployeeId}/sensitive`)
        .set('Authorization', `Bearer ${orgToken}`)
        .expect(200);
    });
  });

  describe('Payroll — employee-keyed and slip routes (P1-11, P1-12)', () => {
    it('team scope: reaches the in-scope employee, 403s on the out-of-scope one', async () => {
      await request(http)
        .get(`/api/v1/payroll/employee/${inScopeEmployeeId}/slips`)
        .set('Authorization', `Bearer ${teamToken}`)
        .expect(200);
      await request(http)
        .get(`/api/v1/payroll/employee/${outOfScopeEmployeeId}/slips`)
        .set('Authorization', `Bearer ${teamToken}`)
        .expect(403);
    });
  });

  describe('Payroll — approve/mark-paid locked to org scope (P1-13)', () => {
    let slipId: string;

    beforeAll(async () => {
      const structureRes = await request(http)
        .post('/api/v1/payroll/structures')
        .set('Authorization', `Bearer ${orgToken}`)
        .send({ name: `Scope Matrix Structure ${Date.now()}`, code: `SMS${Date.now()}` });
      if (structureRes.status !== 201) {
        throw new Error(`salary structure create failed: ${structureRes.status} ${JSON.stringify(structureRes.body)}`);
      }
      const structureId = structureRes.body.data.id as string;

      const assignRes = await request(http)
        .post('/api/v1/payroll/assignments')
        .set('Authorization', `Bearer ${orgToken}`)
        .send({
          employee_id: inScopeEmployeeId,
          structure_id: structureId,
          // Must be on or before "now" (findActiveByEmployee filters
          // effective_date <= now, unlike the future dates used elsewhere
          // in this file for collision-avoidance) AND more recent than any
          // other assignment for this employee, since
          // ORDER BY effective_date DESC LIMIT 1 picks the latest one —
          // an unrelated pre-existing assignment with a recent
          // effective_date was winning over an earlier attempt at a fixed
          // past date here. new Date() covers both.
          effective_date: new Date().toISOString().slice(0, 10),
        });
      if (assignRes.status !== 201) {
        throw new Error(`salary assignment create failed: ${assignRes.status} ${JSON.stringify(assignRes.body)}`);
      }

      const componentRes = await request(http)
        .post('/api/v1/payroll/components')
        .set('Authorization', `Bearer ${orgToken}`)
        .send({ name: 'Base Pay', code: `BASE${Date.now()}`, component_type: 'earnings' });
      if (componentRes.status !== 201) {
        throw new Error(`salary component create failed: ${componentRes.status} ${JSON.stringify(componentRes.body)}`);
      }
      const componentId = componentRes.body.data.id as string;

      // No HTTP endpoint attaches a component to a structure —
      // structure-component.repository.ts has addComponentToStructure, but
      // nothing in payroll.controller.ts/payroll.service.ts ever calls it.
      // Direct insert for fixture purposes, same as the department
      // workaround above; a real gap, not something to build out here.
      const orgRow2 = await pool.query(`SELECT id FROM organizations LIMIT 1`);
      const organizationId2 = orgRow2.rows[0].id as string;
      await pool.query(
        `INSERT INTO structure_components (organization_id, structure_id, component_id, amount, is_active)
         VALUES ($1, $2, $3, $4, true)`,
        [organizationId2, structureId, componentId, 50000],
      );

      // salary_slips.pay_cycle_id is a real FK with no HTTP endpoint to
      // create one through (no pay-cycles route on PayrollController
      // either) — direct insert, same pattern as above.
      const payCycleInsert = await pool.query(
        `INSERT INTO pay_cycles (organization_id, name, code, frequency, start_date)
         VALUES ($1, $2, $3, 'monthly', $4) RETURNING id`,
        [organizationId2, `Scope Matrix Pay Cycle ${Date.now()}`, `SMPC${Date.now()}`, '2030-01-01'],
      );
      const payCycleId = payCycleInsert.rows[0].id as string;

      const slipRes = await request(http)
        .post('/api/v1/payroll/slips/generate')
        .set('Authorization', `Bearer ${orgToken}`)
        .send({
          employee_id: inScopeEmployeeId,
          month: '2030-01',
          pay_cycle_id: payCycleId,
        });
      if (slipRes.status !== 201) {
        throw new Error(`slip generate failed: ${slipRes.status} ${JSON.stringify(slipRes.body)}`);
      }
      slipId = slipRes.body.data.id as string;
    });

    it('team scope with payroll.approve still 403s — org-only regardless of target', async () => {
      await request(http)
        .put(`/api/v1/payroll/slips/${slipId}/approve`)
        .set('Authorization', `Bearer ${teamToken}`)
        .expect(403);
    });

    it('org scope: approves successfully', async () => {
      await request(http)
        .put(`/api/v1/payroll/slips/${slipId}/approve`)
        .set('Authorization', `Bearer ${orgToken}`)
        .expect(200);
    });
  });

  describe('Payroll — assignStructureToEmployee scope-gating (P1-22, today\'s fix)', () => {
    let structureId: string;

    beforeAll(async () => {
      const structureRes = await request(http)
        .post('/api/v1/payroll/structures')
        .set('Authorization', `Bearer ${orgToken}`)
        .send({ name: `P1-22 Assign Structure ${Date.now()}`, code: `P22AS${Date.now()}` });
      if (structureRes.status !== 201) {
        throw new Error(`salary structure create failed: ${structureRes.status} ${JSON.stringify(structureRes.body)}`);
      }
      structureId = structureRes.body.data.id as string;
    });

    it('team scope: assigning to the in-scope employee succeeds, the out-of-scope one 403s', async () => {
      await request(http)
        .post('/api/v1/payroll/assignments')
        .set('Authorization', `Bearer ${teamToken}`)
        .send({ employee_id: inScopeEmployeeId, structure_id: structureId, effective_date: '2030-01-01' })
        .expect(201);

      await request(http)
        .post('/api/v1/payroll/assignments')
        .set('Authorization', `Bearer ${teamToken}`)
        .send({ employee_id: outOfScopeEmployeeId, structure_id: structureId, effective_date: '2030-01-01' })
        .expect(403);
    });

    it('org scope: succeeds for any target', async () => {
      await request(http)
        .post('/api/v1/payroll/assignments')
        .set('Authorization', `Bearer ${orgToken}`)
        .send({ employee_id: outOfScopeEmployeeId, structure_id: structureId, effective_date: '2030-01-02' })
        .expect(201);
    });
  });

  describe('Payroll — pending/approved slip listing scope-filtering (P1-22, today\'s fix)', () => {
    let inScopeSlipId: string;
    let outOfScopeSlipId: string;

    beforeAll(async () => {
      const structureRes = await request(http)
        .post('/api/v1/payroll/structures')
        .set('Authorization', `Bearer ${orgToken}`)
        .send({ name: `P1-22 Listing Structure ${Date.now()}`, code: `P22LS${Date.now()}` });
      if (structureRes.status !== 201) {
        throw new Error(`salary structure create failed: ${structureRes.status} ${JSON.stringify(structureRes.body)}`);
      }
      const structureId = structureRes.body.data.id as string;

      const componentRes = await request(http)
        .post('/api/v1/payroll/components')
        .set('Authorization', `Bearer ${orgToken}`)
        .send({ name: 'P1-22 Base Pay', code: `P22BASE${Date.now()}`, component_type: 'earnings' });
      if (componentRes.status !== 201) {
        throw new Error(`salary component create failed: ${componentRes.status} ${JSON.stringify(componentRes.body)}`);
      }
      const componentId = componentRes.body.data.id as string;

      // No HTTP endpoint attaches a component to a structure or creates a pay
      // cycle — same gap and same direct-insert workaround as the P1-13
      // fixture above.
      const orgRow3 = await pool.query(`SELECT id FROM organizations LIMIT 1`);
      const organizationId3 = orgRow3.rows[0].id as string;
      await pool.query(
        `INSERT INTO structure_components (organization_id, structure_id, component_id, amount, is_active)
         VALUES ($1, $2, $3, $4, true)`,
        [organizationId3, structureId, componentId, 60000],
      );
      const payCycleInsert = await pool.query(
        `INSERT INTO pay_cycles (organization_id, name, code, frequency, start_date)
         VALUES ($1, $2, $3, 'monthly', $4) RETURNING id`,
        [organizationId3, `P1-22 Pay Cycle ${Date.now()}`, `P22PC${Date.now()}`, '2030-03-01'],
      );
      const payCycleId = payCycleInsert.rows[0].id as string;

      for (const employeeId of [inScopeEmployeeId, outOfScopeEmployeeId]) {
        const assignRes = await request(http)
          .post('/api/v1/payroll/assignments')
          .set('Authorization', `Bearer ${orgToken}`)
          .send({ employee_id: employeeId, structure_id: structureId, effective_date: new Date().toISOString().slice(0, 10) });
        if (assignRes.status !== 201) {
          throw new Error(`salary assignment create failed: ${assignRes.status} ${JSON.stringify(assignRes.body)}`);
        }
      }

      const inScopeSlipRes = await request(http)
        .post('/api/v1/payroll/slips/generate')
        .set('Authorization', `Bearer ${orgToken}`)
        .send({ employee_id: inScopeEmployeeId, month: '2030-03', pay_cycle_id: payCycleId });
      if (inScopeSlipRes.status !== 201) {
        throw new Error(`slip generate failed: ${inScopeSlipRes.status} ${JSON.stringify(inScopeSlipRes.body)}`);
      }
      inScopeSlipId = inScopeSlipRes.body.data.id as string;

      const outOfScopeSlipRes = await request(http)
        .post('/api/v1/payroll/slips/generate')
        .set('Authorization', `Bearer ${orgToken}`)
        .send({ employee_id: outOfScopeEmployeeId, month: '2030-03', pay_cycle_id: payCycleId });
      if (outOfScopeSlipRes.status !== 201) {
        throw new Error(`slip generate failed: ${outOfScopeSlipRes.status} ${JSON.stringify(outOfScopeSlipRes.body)}`);
      }
      outOfScopeSlipId = outOfScopeSlipRes.body.data.id as string;
    });

    it('getPendingApprovals: team scope sees only the in-scope employee\'s draft slip', async () => {
      const res = await request(http)
        .get('/api/v1/payroll/slips/pending/approvals')
        .set('Authorization', `Bearer ${teamToken}`)
        .expect(200);
      const ids = (res.body.data ?? []).map((s: any) => s.id);
      expect(ids).toContain(inScopeSlipId);
      expect(ids).not.toContain(outOfScopeSlipId);
    });

    it('getPendingApprovals: org scope sees both', async () => {
      const res = await request(http)
        .get('/api/v1/payroll/slips/pending/approvals')
        .set('Authorization', `Bearer ${orgToken}`)
        .expect(200);
      const ids = (res.body.data ?? []).map((s: any) => s.id);
      expect(ids).toContain(inScopeSlipId);
      expect(ids).toContain(outOfScopeSlipId);
    });

    it('getApprovedSlips: team scope is filtered the same way once both are approved', async () => {
      await request(http)
        .put(`/api/v1/payroll/slips/${inScopeSlipId}/approve`)
        .set('Authorization', `Bearer ${orgToken}`)
        .expect(200);
      await request(http)
        .put(`/api/v1/payroll/slips/${outOfScopeSlipId}/approve`)
        .set('Authorization', `Bearer ${orgToken}`)
        .expect(200);

      const teamRes = await request(http)
        .get('/api/v1/payroll/slips/approved/list')
        .set('Authorization', `Bearer ${teamToken}`)
        .expect(200);
      const teamIds = (teamRes.body.data ?? []).map((s: any) => s.id);
      expect(teamIds).toContain(inScopeSlipId);
      expect(teamIds).not.toContain(outOfScopeSlipId);

      const orgRes = await request(http)
        .get('/api/v1/payroll/slips/approved/list')
        .set('Authorization', `Bearer ${orgToken}`)
        .expect(200);
      const orgIds = (orgRes.body.data ?? []).map((s: any) => s.id);
      expect(orgIds).toContain(inScopeSlipId);
      expect(orgIds).toContain(outOfScopeSlipId);
    });
  });

  describe('Performance — resource-keyed appraisal + goals (P1-14, P1-15, P1-16)', () => {
    let appraisalId: string;

    beforeAll(async () => {
      const cycleRes = await request(http)
        .post('/api/v1/performance/cycles')
        .set('Authorization', `Bearer ${orgToken}`)
        .send({
          name: `Scope Matrix Cycle ${Date.now()}`,
          cycle_type: 'annual',
          start_date: '2030-01-01',
          end_date: '2030-12-31',
        });
      if (cycleRes.status !== 201) {
        throw new Error(`cycle create failed: ${cycleRes.status} ${JSON.stringify(cycleRes.body)}`);
      }
      const cycleId = cycleRes.body.data.id as string;

      const templateRes = await request(http)
        .post('/api/v1/performance/templates')
        .set('Authorization', `Bearer ${orgToken}`)
        .send({
          name: `Scope Matrix Template ${Date.now()}`,
          description: 'Scope matrix fixture',
          template_type: 'annual',
          rating_scale: '1-5',
        });
      if (templateRes.status !== 201) {
        throw new Error(`template create failed: ${templateRes.status} ${JSON.stringify(templateRes.body)}`);
      }
      const templateId = templateRes.body.data.id as string;

      const appraisalRes = await request(http)
        .post('/api/v1/performance/appraisals')
        .set('Authorization', `Bearer ${orgToken}`)
        .send({
          cycle_id: cycleId,
          employee_id: inScopeEmployeeId,
          template_id: templateId,
          appraisal_type: 'annual',
        });
      if (appraisalRes.status !== 201) {
        throw new Error(`appraisal create failed: ${appraisalRes.status} ${JSON.stringify(appraisalRes.body)}`);
      }
      appraisalId = appraisalRes.body.data.id as string;
    });

    it('team scope: reaches the in-scope appraisal', async () => {
      await request(http)
        .get(`/api/v1/performance/appraisals/${appraisalId}`)
        .set('Authorization', `Bearer ${teamToken}`)
        .expect(200);
    });

    it('team scope: creating a goal for an out-of-scope employee 403s', async () => {
      await request(http)
        .post('/api/v1/performance/goals')
        .set('Authorization', `Bearer ${teamToken}`)
        .send({ employee_id: outOfScopeEmployeeId, goal_title: 'Should be blocked' })
        .expect(403);
    });
  });

  describe('Performance — createAppraisal scope-gating (P1-22, today\'s fix)', () => {
    let cycleId: string;
    let templateId: string;

    beforeAll(async () => {
      const cycleRes = await request(http)
        .post('/api/v1/performance/cycles')
        .set('Authorization', `Bearer ${orgToken}`)
        .send({
          name: `P1-22 Create-Appraisal Cycle ${Date.now()}`,
          cycle_type: 'annual',
          start_date: '2030-01-01',
          end_date: '2030-12-31',
        });
      if (cycleRes.status !== 201) {
        throw new Error(`cycle create failed: ${cycleRes.status} ${JSON.stringify(cycleRes.body)}`);
      }
      cycleId = cycleRes.body.data.id as string;

      const templateRes = await request(http)
        .post('/api/v1/performance/templates')
        .set('Authorization', `Bearer ${orgToken}`)
        .send({
          name: `P1-22 Create-Appraisal Template ${Date.now()}`,
          description: 'P1-22 fixture',
          template_type: 'annual',
          rating_scale: '1-5',
        });
      if (templateRes.status !== 201) {
        throw new Error(`template create failed: ${templateRes.status} ${JSON.stringify(templateRes.body)}`);
      }
      templateId = templateRes.body.data.id as string;
    });

    // appraisal_type varies per case to dodge the
    // uq_performance_appraisals(organization_id, cycle_id, employee_id,
    // appraisal_type) constraint across the multiple successful creates
    // below for the same employee/cycle pair.

    it('self scope: 403s even for your own id — Employee role holds no performance.write grant', async () => {
      // Unlike createGoal, this isn't a self-service action: performance.write
      // ("create and edit appraisals and templates") is an administrative
      // permission the Employee role never holds by default, so self-scope
      // callers never reach the scope check at all here — same shape as the
      // Employees sensitive-fields case above.
      await request(http)
        .post('/api/v1/performance/appraisals')
        .set('Authorization', `Bearer ${selfToken}`)
        .send({ cycle_id: cycleId, template_id: templateId, employee_id: inScopeEmployeeId, appraisal_type: 'self-case' })
        .expect(403);
    });

    it('team scope: succeeds for the in-scope target, 403s for the out-of-scope one', async () => {
      await request(http)
        .post('/api/v1/performance/appraisals')
        .set('Authorization', `Bearer ${teamToken}`)
        .send({ cycle_id: cycleId, template_id: templateId, employee_id: inScopeEmployeeId, appraisal_type: 'team-case' })
        .expect(201);

      await request(http)
        .post('/api/v1/performance/appraisals')
        .set('Authorization', `Bearer ${teamToken}`)
        .send({ cycle_id: cycleId, template_id: templateId, employee_id: outOfScopeEmployeeId, appraisal_type: 'team-case' })
        .expect(403);
    });

    it('org scope: succeeds for any target', async () => {
      await request(http)
        .post('/api/v1/performance/appraisals')
        .set('Authorization', `Bearer ${orgToken}`)
        .send({ cycle_id: cycleId, template_id: templateId, employee_id: outOfScopeEmployeeId, appraisal_type: 'org-case' })
        .expect(201);
    });
  });

  describe('Performance — updateGoal scope-gating (P1-22, today\'s fix)', () => {
    let inScopeGoalId: string;
    let outOfScopeGoalId: string;

    beforeAll(async () => {
      const inScopeGoalRes = await request(http)
        .post('/api/v1/performance/goals')
        .set('Authorization', `Bearer ${orgToken}`)
        .send({ employee_id: inScopeEmployeeId, goal_title: 'P1-22 in-scope goal', goal_category: 'individual' });
      if (inScopeGoalRes.status !== 201) {
        throw new Error(`goal create failed: ${inScopeGoalRes.status} ${JSON.stringify(inScopeGoalRes.body)}`);
      }
      inScopeGoalId = inScopeGoalRes.body.data.id as string;

      const outOfScopeGoalRes = await request(http)
        .post('/api/v1/performance/goals')
        .set('Authorization', `Bearer ${orgToken}`)
        .send({ employee_id: outOfScopeEmployeeId, goal_title: 'P1-22 out-of-scope goal', goal_category: 'individual' });
      if (outOfScopeGoalRes.status !== 201) {
        throw new Error(`goal create failed: ${outOfScopeGoalRes.status} ${JSON.stringify(outOfScopeGoalRes.body)}`);
      }
      outOfScopeGoalId = outOfScopeGoalRes.body.data.id as string;
    });

    it('team scope: updating the in-scope employee\'s goal succeeds, the out-of-scope one 403s', async () => {
      await request(http)
        .put(`/api/v1/performance/goals/${inScopeGoalId}`)
        .set('Authorization', `Bearer ${teamToken}`)
        .send({ goal_title: 'Updated by team scope' })
        .expect(200);

      await request(http)
        .put(`/api/v1/performance/goals/${outOfScopeGoalId}`)
        .set('Authorization', `Bearer ${teamToken}`)
        .send({ goal_title: 'Should be blocked' })
        .expect(403);
    });

    it('org scope: succeeds regardless of whose goal it is', async () => {
      await request(http)
        .put(`/api/v1/performance/goals/${outOfScopeGoalId}`)
        .set('Authorization', `Bearer ${orgToken}`)
        .send({ goal_title: 'Updated by org scope' })
        .expect(200);
    });
  });

  describe('Performance — submitAppraisal scope-gating (P1-22, today\'s fix)', () => {
    let cycleId: string;
    let templateId: string;

    async function createDraftAppraisal(employeeId: string, appraisalType: string): Promise<string> {
      const res = await request(http)
        .post('/api/v1/performance/appraisals')
        .set('Authorization', `Bearer ${orgToken}`)
        .send({ cycle_id: cycleId, template_id: templateId, employee_id: employeeId, appraisal_type: appraisalType });
      if (res.status !== 201) {
        throw new Error(`appraisal create failed: ${res.status} ${JSON.stringify(res.body)}`);
      }
      return res.body.data.id as string;
    }

    beforeAll(async () => {
      const cycleRes = await request(http)
        .post('/api/v1/performance/cycles')
        .set('Authorization', `Bearer ${orgToken}`)
        .send({
          name: `P1-22 Submit-Appraisal Cycle ${Date.now()}`,
          cycle_type: 'annual',
          start_date: '2030-01-01',
          end_date: '2030-12-31',
        });
      if (cycleRes.status !== 201) {
        throw new Error(`cycle create failed: ${cycleRes.status} ${JSON.stringify(cycleRes.body)}`);
      }
      cycleId = cycleRes.body.data.id as string;

      const templateRes = await request(http)
        .post('/api/v1/performance/templates')
        .set('Authorization', `Bearer ${orgToken}`)
        .send({
          name: `P1-22 Submit-Appraisal Template ${Date.now()}`,
          description: 'P1-22 fixture',
          template_type: 'annual',
          rating_scale: '1-5',
        });
      if (templateRes.status !== 201) {
        throw new Error(`template create failed: ${templateRes.status} ${JSON.stringify(templateRes.body)}`);
      }
      templateId = templateRes.body.data.id as string;
    });

    it('team scope: submitting the in-scope employee\'s appraisal succeeds, the out-of-scope one 403s', async () => {
      const inScopeAppraisalId = await createDraftAppraisal(inScopeEmployeeId, 'submit-team-in');
      const outOfScopeAppraisalId = await createDraftAppraisal(outOfScopeEmployeeId, 'submit-team-out');

      await request(http)
        .put(`/api/v1/performance/appraisals/${inScopeAppraisalId}/submit`)
        .set('Authorization', `Bearer ${teamToken}`)
        .expect(200);

      await request(http)
        .put(`/api/v1/performance/appraisals/${outOfScopeAppraisalId}/submit`)
        .set('Authorization', `Bearer ${teamToken}`)
        .expect(403);
    });

    it('org scope: succeeds regardless of whose appraisal it is', async () => {
      const appraisalId = await createDraftAppraisal(outOfScopeEmployeeId, 'submit-org');

      await request(http)
        .put(`/api/v1/performance/appraisals/${appraisalId}/submit`)
        .set('Authorization', `Bearer ${orgToken}`)
        .expect(200);
    });
  });

  describe('Community — publishAnnouncement locked to org scope', () => {
    async function createDraftAnnouncement(): Promise<string> {
      const res = await request(http)
        .post('/api/v1/community/announcements')
        .set('Authorization', `Bearer ${orgToken}`)
        .send({ title: `P1-22 announcement ${Date.now()}`, content: 'P1-22 fixture content' });
      if (res.status !== 201) {
        throw new Error(`announcement create failed: ${res.status} ${JSON.stringify(res.body)}`);
      }
      return res.body.data.id as string;
    }

    it('team scope with announcement.update still 403s — org-only regardless of target', async () => {
      const announcementId = await createDraftAnnouncement();
      await request(http)
        .post(`/api/v1/community/announcements/${announcementId}/publish`)
        .set('Authorization', `Bearer ${teamToken}`)
        .expect(403);
    });

    it('org scope: publishes successfully', async () => {
      const announcementId = await createDraftAnnouncement();
      await request(http)
        .post(`/api/v1/community/announcements/${announcementId}/publish`)
        .set('Authorization', `Bearer ${orgToken}`)
        // No @HttpCode override on this route, so Nest defaults a POST to 201.
        .expect(201);
    });
  });

  describe('Community — deletePost: ownership OR org-scope moderator, not management scope', () => {
    async function createPostAsOrgUser(): Promise<string> {
      const res = await request(http)
        .post('/api/v1/community/posts')
        .set('Authorization', `Bearer ${orgToken}`)
        .send({ content: `P1-22 post ${Date.now()}` });
      if (res.status !== 201) {
        throw new Error(`post create failed: ${res.status} ${JSON.stringify(res.body)}`);
      }
      return res.body.data.id as string;
    }

    it('team scope, not the author: 403s even with post.delete granted', async () => {
      const postId = await createPostAsOrgUser();
      await request(http)
        .delete(`/api/v1/community/posts/${postId}`)
        .set('Authorization', `Bearer ${teamToken}`)
        .expect(403);
    });

    it('org scope, not the author: succeeds as a moderator', async () => {
      const postId = await createPostAsOrgUser();
      await request(http)
        .delete(`/api/v1/community/posts/${postId}`)
        .set('Authorization', `Bearer ${orgToken}`)
        .expect(200);
    });
  });

  describe('Organization structure — permission-gated only, no employee-management scope applies (P1-20)', () => {
    // Departments/teams/business-units/designations/grades aren't
    // employee-keyed resources - there's no "target employee" for the usual
    // self/team/org matrix to apply to, and nothing in this module calls
    // assertActingOnEmployee or scopedEmployeeIds (confirmed against
    // current main, and matching the empty diff found auditing an older,
    // unmerged branch that set out to add exactly that and found nothing to
    // change). This documents that as intended behavior, not a gap: access
    // is controlled by organization_structure.read/write alone, uniformly
    // across every scope kind.
    it('read: self, team, and org scope all succeed alike, gated by permission only', async () => {
      for (const token of [selfToken, teamToken, orgToken]) {
        await request(http)
          .get('/api/v1/departments')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
      }
    });

    it('write: team scope with organization_structure.write succeeds same as org scope', async () => {
      // business-units, not departments: departments.repository.ts (and
      // teams.repository.ts) insert a parent_business_unit_id column that
      // doesn't exist on their tables - a real, pre-existing bug, unrelated
      // to scope, flagged separately in this file's beforeAll rather than
      // fixed here. business_units genuinely owns that column, so its
      // create route is clean.
      await request(http)
        .post('/api/v1/business-units')
        .set('Authorization', `Bearer ${teamToken}`)
        .send({ name: `P1-22 Team-Created BU ${Date.now()}`, code: `P22TCBU${Date.now()}` })
        .expect(201);
    });
  });

  describe('Audit — logs locked to org scope (P1-21)', () => {
    it('team scope gets 403 even with audit.read granted', async () => {
      await request(http)
        .get('/api/v1/audit/logs')
        .set('Authorization', `Bearer ${teamToken}`)
        .expect(403);
    });

    it('org scope succeeds', async () => {
      await request(http)
        .get('/api/v1/audit/logs')
        .set('Authorization', `Bearer ${orgToken}`)
        .expect(200);
    });
  });
});
