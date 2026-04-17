import { Say } from '@saykit/react';

export default function ServerComponent() {
  const region = 'Server';

  return (
    <Say>
      Hello from the <strong>{region}</strong>
    </Say>
  );
}
