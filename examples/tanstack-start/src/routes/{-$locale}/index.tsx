import { Say } from '@saykit/react';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

export const Route = createFileRoute('/{-$locale}/')({
  component: Home,
});

function Home() {
  const [count, setCount] = useState(0);

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '20px' }}>
      <p>
        <Say>Count: {count}</Say>
      </p>

      <button onClick={() => setCount(count + 1)}>
        <Say>Increment</Say>
      </button>

      <button onClick={() => setCount(0)} style={{ marginLeft: '10px' }}>
        <Say>Reset</Say>
      </button>
    </div>
  );
}
