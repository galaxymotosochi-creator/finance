import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function SettingsGeneral() {
  const [loading] = useState(false);

  return (
    <>
<div className="page-header"><div><h1>Общие настройки</h1><div className="sub">Настройки системы (в разработке)</div></div></div>
    </>
  );
}
