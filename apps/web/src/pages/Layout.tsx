import { Anchor, Button, Container, Group, Skeleton, Text } from '@mantine/core';
import { Link, Outlet } from 'react-router';

import { useAuth } from '../auth/context';

/**
 * The bar across the top of every page, and the `<Outlet />` the routes render
 * into. A layout route rather than something each page remembers to include: a
 * page that forgets the header is a page with no way to sign out.
 */
export function Layout() {
  const { user, isLoading, signOut } = useAuth();

  return (
    <>
      <Container size="xl" py="sm">
        <Group justify="space-between">
          <Group gap="lg">
            <Anchor component={Link} to="/" fw={700} underline="never">
              Movie Suggester
            </Anchor>
            <Anchor component={Link} to="/movies" size="sm" c="dimmed" underline="hover">
              Browse
            </Anchor>
          </Group>

          <Group gap="sm">
            {/* Three states, not two: on a reload with a stored token we do not
                yet know who this is, and flashing "Sign in" at someone who is
                signed in is worse than a moment of nothing. */}
            {isLoading ? <Skeleton height={28} width={160} radius="sm" /> : null}

            {!isLoading && user === undefined ? (
              <>
                <Button component={Link} to="/sign-in" variant="subtle" size="xs">
                  Sign in
                </Button>
                <Button component={Link} to="/sign-up" size="xs">
                  Create an account
                </Button>
              </>
            ) : null}

            {user === undefined ? null : (
              <>
                <Text size="sm" c="dimmed">
                  {user.displayName}
                </Text>
                <Button variant="subtle" size="xs" onClick={signOut}>
                  Sign out
                </Button>
              </>
            )}
          </Group>
        </Group>
      </Container>

      <Outlet />
    </>
  );
}
