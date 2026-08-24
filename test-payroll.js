const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3000/api/v1';

let testResults = {
  passed: 0,
  failed: 0,
  errors: []
};

async function test(name, fn) {
  try {
    await fn();
    testResults.passed++;
    console.log(`✅ ${name}`);
  } catch (err) {
    testResults.failed++;
    testResults.errors.push({ test: name, error: err.message });
    console.log(`❌ ${name}: ${err.message}`);
  }
}

async function getToken() {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@dev-org.local',
      password: 'Admin@123456',
    }),
  });
  const data = await res.json();
  if (!data.data?.access_token) throw new Error('Failed to login');
  return data.data.access_token;
}

async function runTests() {
  console.log('🧪 Starting Payroll Module Tests...\n');

  let token;
  let organizationId;
  let employeeId;
  let structureId;
  let componentId;
  let assignmentId;
  let slipId;

  await test('Get Auth Token', async () => {
    token = await getToken();
    if (!token) throw new Error('No token received');
  });

  // Get current user to find organization and employee
  await test('Get Current User Info', async () => {
    const res = await fetch(`${API_BASE}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!data.data?.organization_id) throw new Error('No organization found');
    organizationId = data.data.organization_id;
  });

  // Get first employee
  await test('Get Employees List', async () => {
    const res = await fetch(`${API_BASE}/employees`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!data.data?.length) throw new Error('No employees found');
    employeeId = data.data[0].id;
  });

  // Test 1: Create Salary Component
  await test('Create Salary Component (Base Salary)', async () => {
    const res = await fetch(`${API_BASE}/payroll/components`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Base Salary',
        code: 'BASE',
        component_type: 'earnings',
        description: 'Basic monthly salary',
      }),
    });
    const data = await res.json();
    if (!data.data?.id) throw new Error('Failed to create component');
    componentId = data.data.id;
  });

  // Test 2: Create Salary Structure
  await test('Create Salary Structure', async () => {
    const res = await fetch(`${API_BASE}/payroll/structures`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Developer',
        code: 'DEV',
        description: 'Developer salary structure',
      }),
    });
    const data = await res.json();
    if (!data.data?.id) throw new Error('Failed to create structure');
    structureId = data.data.id;
  });

  // Test 3: Get Salary Structures
  await test('Get Salary Structures', async () => {
    const res = await fetch(`${API_BASE}/payroll/structures`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!Array.isArray(data.data)) throw new Error('Invalid response');
  });

  // Test 4: Get Salary Components
  await test('Get Salary Components', async () => {
    const res = await fetch(`${API_BASE}/payroll/components`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!Array.isArray(data.data)) throw new Error('Invalid response');
  });

  // Test 5: Assign Structure to Employee
  await test('Assign Salary Structure to Employee', async () => {
    const res = await fetch(`${API_BASE}/payroll/assignments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        employee_id: employeeId,
        structure_id: structureId,
        effective_date: new Date().toISOString().split('T')[0],
      }),
    });
    const data = await res.json();
    if (!data.data?.id) throw new Error('Failed to assign structure');
    assignmentId = data.data.id;
  });

  // Test 6: Get Employee Assignment
  await test('Get Current Employee Assignment', async () => {
    const res = await fetch(`${API_BASE}/payroll/assignments/employee/${employeeId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!data.data?.id) throw new Error('No assignment found');
  });

  // Test 7: Get Assignment History
  await test('Get Employee Assignment History', async () => {
    const res = await fetch(`${API_BASE}/payroll/assignments/employee/${employeeId}/history`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!Array.isArray(data.data)) throw new Error('Invalid response');
  });

  // Test 8: Generate Salary Slip (KEY TEST - salary calculation algorithm)
  await test('Generate Salary Slip with Auto Calculation', async () => {
    const month = new Date().toISOString().slice(0, 7); // YYYY-MM
    const res = await fetch(`${API_BASE}/payroll/slips/generate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        employee_id: employeeId,
        month,
        pay_cycle_id: '00000000-0000-0000-0000-000000000000', // placeholder
      }),
    });
    const data = await res.json();
    if (!data.data?.id) {
      console.log('Error details:', data);
      throw new Error('Failed to generate salary slip');
    }
    slipId = data.data.id;
  });

  // Test 9: Get Salary Slip
  if (slipId) {
    await test('Get Salary Slip Details', async () => {
      const res = await fetch(`${API_BASE}/payroll/slips/${slipId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.data?.id) throw new Error('Slip not found');
      console.log(`   - Gross: ${data.data.gross_amount}, Deductions: ${data.data.total_deductions}, Net: ${data.data.net_amount}`);
    });
  }

  // Test 10: Get Slip Breakdown
  if (slipId) {
    await test('Get Salary Slip Breakdown (Components)', async () => {
      const res = await fetch(`${API_BASE}/payroll/slips/${slipId}/breakdown`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.data?.components) throw new Error('No components found');
      console.log(`   - Components: ${data.data.components.length}`);
    });
  }

  // Test 11: Approve Salary Slip
  if (slipId) {
    await test('Approve Salary Slip', async () => {
      const res = await fetch(`${API_BASE}/payroll/slips/${slipId}/approve`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (data.data?.status !== 'approved') throw new Error('Slip not approved');
    });
  }

  // Test 12: Mark Slip as Paid
  if (slipId) {
    await test('Mark Salary Slip as Paid', async () => {
      const res = await fetch(`${API_BASE}/payroll/slips/${slipId}/mark-paid`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (data.data?.status !== 'paid') throw new Error('Slip not marked as paid');
    });
  }

  // Test 13: Get Pending Approvals
  await test('Get Pending Approvals List', async () => {
    const res = await fetch(`${API_BASE}/payroll/slips/pending/approvals`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!Array.isArray(data.data)) throw new Error('Invalid response');
  });

  // Test 14: Get Approved Slips
  await test('Get Approved Slips List', async () => {
    const res = await fetch(`${API_BASE}/payroll/slips/approved/list`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!Array.isArray(data.data)) throw new Error('Invalid response');
  });

  // Test 15: Get Employee Slips
  await test('Get Employee Salary Slips (Year)', async () => {
    const res = await fetch(`${API_BASE}/payroll/employee/${employeeId}/slips`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!Array.isArray(data.data)) throw new Error('Invalid response');
  });

  console.log('\n' + '='.repeat(50));
  console.log(`📊 Test Results: ${testResults.passed} passed, ${testResults.failed} failed`);

  if (testResults.errors.length > 0) {
    console.log('\n❌ Failures:');
    testResults.errors.forEach((e) => {
      console.log(`   - ${e.test}: ${e.error}`);
    });
  }

  if (testResults.failed === 0) {
    console.log('\n✅ All tests passed!');
  }

  process.exit(testResults.failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Test suite error:', err);
  process.exit(1);
});
