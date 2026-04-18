'use client';

import { Say } from '@saykit/react';
import { useEffect, useState } from 'react';

export default function ClientComponent() {
  const region = 'Client';

  // This is a hack to ensure the Say component is only rendered on the client for showcase reasons
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return mounted ? (
    <Say>
      Hello from the <strong>{region}</strong>
    </Say>
  ) : (
    <Say>Loading...</Say>
  );
}
