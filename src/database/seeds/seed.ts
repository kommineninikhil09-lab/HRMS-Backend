import 'dotenv/config';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { getFinancialYear } from '../../common/util/financial-year.util';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set (expected in .env)');
}

const pool = new Pool({ connectionString });

interface SeedData {
  organizationId: string;
  adminUserId: string;
  hrManagerUserId: string;
  employeeUserId: string;
  adminRoleId: string;
  hrManagerRoleId: string;
  employeeRoleId: string;
}

async function seed() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('🌱 Starting seed process...');

    // 1. Create organization
    console.log('📦 Creating organization...');
    const orgResult = await client.query<{ id: string }>(
      `
      INSERT INTO organizations (name, legal_name, slug, status, timezone)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (slug) DO UPDATE SET updated_at = NOW()
      RETURNING id
      `,
      ['Dev Organization', 'Dev Organization Inc.', 'dev-org', 'active', 'UTC'],
    );

    const organizationId = orgResult.rows[0].id;
    console.log(`✓ Organization created: ${organizationId}`);

    // 2. Create permissions (if not exists)
    console.log('🔐 Seeding permissions...');
    const permissions = [
      ['user.read', 'Read users', 'user'],
      ['user.create', 'Create users', 'user'],
      ['user.update', 'Update users', 'user'],
      ['user.delete', 'Delete users', 'user'],
      ['role.read', 'Read roles', 'role'],
      ['role.create', 'Create roles', 'role'],
      ['role.update', 'Update roles', 'role'],
      ['role.delete', 'Delete roles', 'role'],
      ['permission.read', 'Read permissions', 'permission'],
      ['organization.read', 'Read organizations', 'organization'],
      ['organization.update', 'Update organizations', 'organization'],
      ['organization_structure.read', 'View organization structure', 'organization'],
      ['organization_structure.write', 'Manage organization structure', 'organization'],
      ['employee.read', 'Read employees', 'employee'],
      ['employee.create', 'Create employees', 'employee'],
      ['employee.update', 'Update employees', 'employee'],
      ['employee.delete', 'Delete employees', 'employee'],
      ['salary.read', 'Read salary information', 'salary'],
      ['salary.update', 'Update salary information', 'salary'],
      ['audit.read', 'Read audit logs', 'audit'],
      ['attendance.read', 'View attendance records', 'attendance'],
      ['attendance.write', 'Clock in/out and manage personal attendance', 'attendance'],
      ['attendance.manage', 'Mark attendance for employees', 'attendance'],
      ['leave.read', 'View leave requests and balance', 'leave'],
      ['leave.write', 'Create and manage leave requests', 'leave'],
      ['leave.approve', 'Approve or reject leave requests', 'leave'],
      ['ess.read', 'View employee self-service profile and documents', 'ess'],
      ['ess.update', 'Update own employee profile', 'ess'],
      ['holiday.read', 'View the holiday calendar', 'holiday'],
      ['holiday.write', 'Create and remove holidays', 'holiday'],
    ];

    const permissionIds: Record<string, string> = {};

    for (const [code, description, module] of permissions) {
      const result = await client.query<{ id: string }>(
        `
        INSERT INTO permissions (code, description, module)
        VALUES ($1, $2, $3)
        ON CONFLICT (code) DO UPDATE SET code = $1
        RETURNING id
        `,
        [code, description, module],
      );
      permissionIds[code] = result.rows[0].id;
    }
    console.log(`✓ ${permissions.length} permissions seeded`);

    // 3. Create roles
    console.log('👥 Creating roles...');

    const adminRoleResult = await client.query<{ id: string }>(
      `
      INSERT INTO roles (organization_id, name, description, is_system)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (organization_id, name) DO UPDATE SET updated_at = NOW()
      RETURNING id
      `,
      [organizationId, 'Admin', 'Administrator with full access', true],
    );
    const adminRoleId = adminRoleResult.rows[0].id;

    const hrManagerRoleResult = await client.query<{ id: string }>(
      `
      INSERT INTO roles (organization_id, name, description, is_system)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (organization_id, name) DO UPDATE SET updated_at = NOW()
      RETURNING id
      `,
      [
        organizationId,
        'HR Manager',
        'HR manager with employee and leave management access',
        true,
      ],
    );
    const hrManagerRoleId = hrManagerRoleResult.rows[0].id;

    const employeeRoleResult = await client.query<{ id: string }>(
      `
      INSERT INTO roles (organization_id, name, description, is_system)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (organization_id, name) DO UPDATE SET updated_at = NOW()
      RETURNING id
      `,
      [organizationId, 'Employee', 'Standard employee with basic access', true],
    );
    const employeeRoleId = employeeRoleResult.rows[0].id;

    console.log(`✓ 3 roles created`);

    // 4. Assign permissions to Admin role (all permissions)
    console.log('🔑 Assigning permissions to Admin role...');
    const adminPermissions = Object.values(permissionIds);

    for (const permissionId of adminPermissions) {
      await client.query(
        `
        INSERT INTO role_permissions (organization_id, role_id, permission_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (role_id, permission_id) DO NOTHING
        `,
        [organizationId, adminRoleId, permissionId],
      );
    }
    console.log(`✓ ${adminPermissions.length} permissions assigned to Admin`);

    // 5. Assign permissions to HR Manager role
    console.log('🔑 Assigning permissions to HR Manager role...');
    const hrManagerPermissions = [
      'user.read',
      'employee.read',
      'employee.create',
      'employee.update',
      'organization.read',
      'organization_structure.read',
      'organization_structure.write',
      'audit.read',
      'attendance.read',
      'attendance.manage',
      'leave.read',
      'leave.approve',
      'ess.read',
      'ess.update',
      'holiday.read',
      'holiday.write',
    ];

    for (const code of hrManagerPermissions) {
      if (permissionIds[code]) {
        await client.query(
          `
          INSERT INTO role_permissions (organization_id, role_id, permission_id)
          VALUES ($1, $2, $3)
          ON CONFLICT (role_id, permission_id) DO NOTHING
          `,
          [organizationId, hrManagerRoleId, permissionIds[code]],
        );
      }
    }
    console.log(`✓ ${hrManagerPermissions.length} permissions assigned to HR Manager`);

    // 6. Assign permissions to Employee role
    console.log('🔑 Assigning permissions to Employee role...');
    const employeePermissions = [
      'employee.read',
      'organization.read',
      'attendance.read',
      'attendance.write',
      'leave.read',
      'leave.write',
      'ess.read',
      'ess.update',
      'organization_structure.read',
      'holiday.read',
    ];

    for (const code of employeePermissions) {
      if (permissionIds[code]) {
        await client.query(
          `
          INSERT INTO role_permissions (organization_id, role_id, permission_id)
          VALUES ($1, $2, $3)
          ON CONFLICT (role_id, permission_id) DO NOTHING
          `,
          [organizationId, employeeRoleId, permissionIds[code]],
        );
      }
    }
    console.log(`✓ ${employeePermissions.length} permissions assigned to Employee`);

    // 7. Create users
    console.log('👤 Creating users...');

    const adminPassword = await bcrypt.hash('Admin@123456', 12);
    const adminUserResult = await client.query<{ id: string }>(
      `
      INSERT INTO users (organization_id, email, password_hash, first_name, last_name, auth_provider, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (lower(email)) DO UPDATE SET updated_at = NOW()
      RETURNING id
      `,
      [
        organizationId,
        'admin@dev-org.local',
        adminPassword,
        'Admin',
        'User',
        'local',
        'active',
      ],
    );
    const adminUserId = adminUserResult.rows[0].id;

    const hrManagerPassword = await bcrypt.hash('HRManager@123456', 12);
    const hrManagerUserResult = await client.query<{ id: string }>(
      `
      INSERT INTO users (organization_id, email, password_hash, first_name, last_name, auth_provider, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (lower(email)) DO UPDATE SET updated_at = NOW()
      RETURNING id
      `,
      [
        organizationId,
        'hrmanager@dev-org.local',
        hrManagerPassword,
        'HR',
        'Manager',
        'local',
        'active',
      ],
    );
    const hrManagerUserId = hrManagerUserResult.rows[0].id;

    const employeePassword = await bcrypt.hash('Employee@123456', 12);
    const employeeUserResult = await client.query<{ id: string }>(
      `
      INSERT INTO users (organization_id, email, password_hash, first_name, last_name, auth_provider, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (lower(email)) DO UPDATE SET updated_at = NOW()
      RETURNING id
      `,
      [
        organizationId,
        'employee@dev-org.local',
        employeePassword,
        'John',
        'Employee',
        'local',
        'active',
      ],
    );
    const employeeUserId = employeeUserResult.rows[0].id;

    console.log(`✓ 3 users created`);

    // 8. Assign roles to users
    console.log('🔗 Assigning roles to users...');

    await client.query(
      `
      INSERT INTO user_roles (organization_id, user_id, role_id, assigned_by)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, role_id) DO NOTHING
      `,
      [organizationId, adminUserId, adminRoleId, adminUserId],
    );

    await client.query(
      `
      INSERT INTO user_roles (organization_id, user_id, role_id, assigned_by)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, role_id) DO NOTHING
      `,
      [organizationId, hrManagerUserId, hrManagerRoleId, adminUserId],
    );

    await client.query(
      `
      INSERT INTO user_roles (organization_id, user_id, role_id, assigned_by)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, role_id) DO NOTHING
      `,
      [organizationId, employeeUserId, employeeRoleId, adminUserId],
    );

    console.log(`✓ Roles assigned to users`);

    // 8b. Super Admin role.
    // Migration 1724180000000 creates this system role and grants it every
    // permission that exists at migration time. seed.ts adds further permission
    // codes (user.*, role.*, employee.*, …), so re-grant the full catalogue here
    // to keep "Super Admin = all permissions". The migration deliberately does
    // not assign the role to anyone; for local dev we give it to the admin user.
    console.log('👑 Configuring Super Admin role...');
    const superAdminRoleResult = await client.query<{ id: string }>(
      `
      INSERT INTO roles (organization_id, name, description, is_system)
      VALUES ($1, 'Super Admin', 'Full access to every permission', TRUE)
      ON CONFLICT (organization_id, name) DO UPDATE SET updated_at = NOW()
      RETURNING id
      `,
      [organizationId],
    );
    const superAdminRoleId = superAdminRoleResult.rows[0].id;

    const superAdminGrant = await client.query(
      `
      INSERT INTO role_permissions (organization_id, role_id, permission_id)
      SELECT $1, $2, p.id FROM permissions p
      ON CONFLICT (role_id, permission_id) DO NOTHING
      `,
      [organizationId, superAdminRoleId],
    );

    await client.query(
      `
      INSERT INTO user_roles (organization_id, user_id, role_id, assigned_by)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, role_id) DO NOTHING
      `,
      [organizationId, adminUserId, superAdminRoleId, adminUserId],
    );
    console.log(
      `✓ Super Admin role holds every permission (${superAdminGrant.rowCount} new grants) and is assigned to admin@dev-org.local`,
    );

    // 9. Create employee records for users (Phase 1)
    console.log('👨‍💼 Creating employee records...');
    const currentFinancialYear = getFinancialYear();

    // Create employee records for Admin
    const adminEmpResult = await client.query<{ id: string }>(
      `
      INSERT INTO employees (organization_id, user_id, employee_code, first_name, last_name, work_email, date_of_joining, status)
      VALUES ($1, $2, $3, $4, $5, $6, NOW()::DATE, $7)
      ON CONFLICT (organization_id, employee_code) DO UPDATE SET user_id = EXCLUDED.user_id, updated_at = NOW()
      RETURNING id
      `,
      [organizationId, adminUserId, 'ADM001', 'Admin', 'User', 'admin@dev-org.local', 'active'],
    );
    const adminEmpId = adminEmpResult.rows[0].id;

    // Create employee records for HR Manager
    const hrManagerEmpResult = await client.query<{ id: string }>(
      `
      INSERT INTO employees (organization_id, user_id, employee_code, first_name, last_name, work_email, date_of_joining, status)
      VALUES ($1, $2, $3, $4, $5, $6, NOW()::DATE, $7)
      ON CONFLICT (organization_id, employee_code) DO UPDATE SET user_id = EXCLUDED.user_id, updated_at = NOW()
      RETURNING id
      `,
      [organizationId, hrManagerUserId, 'HRM001', 'HR', 'Manager', 'hrmanager@dev-org.local', 'active'],
    );
    const hrManagerEmpId = hrManagerEmpResult.rows[0].id;

    // Create employee records for Employee
    const employeeEmpResult = await client.query<{ id: string }>(
      `
      INSERT INTO employees (organization_id, user_id, employee_code, first_name, last_name, work_email, date_of_joining, status)
      VALUES ($1, $2, $3, $4, $5, $6, NOW()::DATE, $7)
      ON CONFLICT (organization_id, employee_code) DO UPDATE SET user_id = EXCLUDED.user_id, updated_at = NOW()
      RETURNING id
      `,
      [organizationId, employeeUserId, 'EMP001', 'John', 'Employee', 'employee@dev-org.local', 'active'],
    );
    const employeeEmpId = employeeEmpResult.rows[0].id;
    console.log(`✓ 3 employee records created`);

    // Reporting lines: EMP001 → HRM001 → ADM001, so the leave approval flow is
    // testable (a request's approver is derived from the employee's manager).
    await client.query(
      `UPDATE employees SET manager_id = $1, updated_at = NOW() WHERE id = $2`,
      [hrManagerEmpId, employeeEmpId],
    );
    await client.query(
      `UPDATE employees SET manager_id = $1, updated_at = NOW() WHERE id = $2`,
      [adminEmpId, hrManagerEmpId],
    );
    console.log('✓ Reporting lines set (EMP001 → HRM001 → ADM001)');

    // 10. Create leave types
    console.log('🏖️ Creating leave types...');
    const leaveTypes = [
      ['CL', 'Casual Leave', 12, 0, true, true],
      ['SL', 'Sick Leave', 10, 0, true, true],
      ['AL', 'Annual Leave', 20, 5, true, true],
      ['UL', 'Unpaid Leave', 0, 0, true, false],
    ];

    const seededLeaveTypes: { id: string; annual: number }[] = [];

    for (const [code, name, annual, carryForward, requiresApproval, isPaid] of leaveTypes) {
      const result = await client.query<{ id: string }>(
        `
        INSERT INTO leave_types (organization_id, code, name, annual_allocation, carry_forward_limit, requires_approval, is_paid, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (organization_id, code) DO UPDATE SET updated_at = NOW()
        RETURNING id
        `,
        [organizationId, code, name, annual, carryForward, requiresApproval, isPaid, 'active'],
      );
      seededLeaveTypes.push({ id: result.rows[0].id, annual: Number(annual) });
    }
    console.log(`✓ ${leaveTypes.length} leave types created`);

    // 11. Create leave balance for employees
    console.log('📊 Initializing leave balance...');

    // Refresh dev balances so a re-seed adopts the current financial year
    // ("YYYY-YYYY"); older rows were keyed by calendar year (e.g. "2026").
    await client.query(
      `DELETE FROM leave_balance WHERE organization_id = $1`,
      [organizationId],
    );

    for (const lt of seededLeaveTypes) {
      for (const empId of [adminEmpId, hrManagerEmpId, employeeEmpId]) {
        await client.query(
          `
          INSERT INTO leave_balance (organization_id, employee_id, leave_type_id, financial_year, allocated, opening_balance)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (organization_id, employee_id, leave_type_id, financial_year)
            DO UPDATE SET allocated = EXCLUDED.allocated
          `,
          [organizationId, empId, lt.id, currentFinancialYear, lt.annual, 0],
        );
      }
    }
    console.log(`✓ Leave balance initialized for employees (FY: ${currentFinancialYear})`);

    await client.query('COMMIT');

    console.log('✅ Seed completed successfully!');
    console.log('\n📝 Test credentials:');
    console.log('  Admin:      admin@dev-org.local / Admin@123456');
    console.log('  HR Manager: hrmanager@dev-org.local / HRManager@123456');
    console.log('  Employee:   employee@dev-org.local / Employee@123456');
    console.log('\n🎯 Available Features:');
    console.log('  - Attendance: Clock in/out, track daily attendance, view summary');
    console.log('  - Leave: Apply for leave, view balance, approval workflows');
    console.log('  - Employee Management: Create, update, view employees');
    console.log('  - Organization: Manage departments, locations, business units');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
