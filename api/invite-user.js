// API: Приглашение сотрудника через Supabase Admin
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEYS || process.env.SUPABASE_SERVICE_KEY || '';

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Supabase admin credentials not configured. Add SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEYS in Vercel env.' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { email, employeeId, employeeName } = req.body;

  if (!email || !employeeId) {
    return res.status(400).json({ error: 'Email and employeeId required' });
  }

  try {
    // Отправляем приглашение сотруднику
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: 'https://' + req.headers.host + '/#/login',
      data: { is_employee: true, employee_id: employeeId, employee_name: employeeName || '' }
    });

    if (error) throw error;

    // Обновляем запись сотрудника: проставляем email
    const { error: updateError } = await supabase
      .from('employees')
      .update({ email: email, status: 'invited' })
      .eq('id', employeeId);

    if (updateError) console.error('Failed to update employee:', updateError);

    return res.status(200).json({ message: 'Invitation sent', user: data.user });
  } catch (err) {
    console.error('Invite error:', err);
    return res.status(500).json({ error: err.message });
  }
}
