import {
  Alert,
  Badge,
  Button,
  Card,
  Code,
  Container,
  Group,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';

import { orpc, type ApiOutputs } from '../api/client';

const numberFormatter = new Intl.NumberFormat();

function StatCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <Card withBorder radius="md" padding="lg">
      <Stack gap={4}>
        <Text size="sm" c="dimmed" tt="uppercase" fw={600}>
          {label}
        </Text>
        <Text fz={40} fw={700} lh={1.1}>
          {numberFormatter.format(value)}
        </Text>
        <Text size="sm" c="dimmed">
          {hint}
        </Text>
      </Stack>
    </Card>
  );
}

/* Shown until the very first fetch settles. Skeletons rather than a spinner so
   the page does not change height when the numbers arrive. */
function StatsSkeleton() {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
      <Skeleton height={140} radius="md" />
      <Skeleton height={140} radius="md" />
    </SimpleGrid>
  );
}

function IngestPrompt() {
  return (
    <Alert color="yellow" variant="light" title="No movies yet">
      <Stack gap="sm" align="flex-start">
        <Text size="sm">
          The database is migrated but empty. Load the dataset — around 1,455 films from
          MongoDB&apos;s <Code>embedded_movies</Code> — with:
        </Text>
        <Code block>npm run ingest</Code>
        <Text size="sm">
          It downloads over HTTP, needs no API key, and is safe to re-run: movies are upserted on
          their IMDb id. Refresh this page when it finishes.
        </Text>
      </Stack>
    </Alert>
  );
}

/* One component per outcome keeps the page body a flat list of React Query
   states instead of a nested ternary. */
function CatalogueStats({ stats }: { stats: ApiOutputs['stats'] }) {
  if (!stats.isIngested) {
    return <IngestPrompt />;
  }

  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
      <StatCard
        label="Movies ingested"
        value={stats.movieCount}
        hint="Rows in the movies table, keyed by IMDb id."
      />
      <StatCard
        label="With plot embeddings"
        value={stats.moviesWithEmbedding}
        hint="Films carrying a 1536-dimension plot vector, used in exercise 3."
      />
    </SimpleGrid>
  );
}

export function HomePage() {
  const statsQuery = useQuery(orpc.stats.queryOptions());

  return (
    <Container size="md" py={64}>
      <Stack gap="xl">
        <Stack gap="xs">
          <Badge variant="light" size="sm" w="fit-content">
            Teaching repo
          </Badge>
          <Title order={1} fz={56} lh={1.05}>
            Movie Suggester
          </Title>
          <Text size="lg" c="dimmed" maw={620}>
            Browse a catalogue of films and get suggestions from their plots — built end to end in
            TypeScript, from one Drizzle table to the React page you are looking at.
          </Text>
        </Stack>

        {statsQuery.isPending ? <StatsSkeleton /> : null}

        {statsQuery.isError ? (
          <Alert color="red" variant="light" title="Could not reach the API">
            <Stack gap="xs" align="flex-start">
              <Text size="sm">{statsQuery.error.message}</Text>
              <Text size="sm">
                Start both processes from the repo root with <Code>npm run dev</Code>.
              </Text>
            </Stack>
          </Alert>
        ) : null}

        {statsQuery.isSuccess ? <CatalogueStats stats={statsQuery.data} /> : null}

        {statsQuery.isSuccess && statsQuery.data.isIngested ? (
          <Button component={Link} to="/movies" size="md" w="fit-content">
            Browse films
          </Button>
        ) : null}

        <Card withBorder radius="md" padding="lg">
          <Stack gap="xs">
            <Group gap="xs">
              <Title order={2} fz="h4">
                What&apos;s next
              </Title>
              <Badge variant="light" color="gray" size="sm">
                3 exercises
              </Badge>
            </Group>
            <Text size="sm" c="dimmed">
              This repo is a guided exercise in agentic development: three briefs build the app up
              from here, each with an example solution on its own branch.
            </Text>
            <Text size="sm">
              Open <Code>README.md</Code> to start: exercise 1 is the movie list and detail pages.
            </Text>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}
