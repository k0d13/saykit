import { SayProvider } from '@saykit/react/client';
import { createFileRoute, Outlet } from '@tanstack/react-router';
import say from '../../i18n';

export const Route = createFileRoute('/{-$locale}')({
  component: RouteLayout,
});

function RouteLayout() {
  const locale = say.match([Route.useParams().locale || 'en']);
  const messages = say.activate(locale).messages;

  return (
    <SayProvider locale={locale} messages={messages}>
      <Outlet />
    </SayProvider>
  );
}
