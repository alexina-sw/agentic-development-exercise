import {
  Alert,
  Anchor,
  AspectRatio,
  Badge,
  Button,
  Card,
  Container,
  Grid,
  Group,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { isDefinedError } from '@orpc/client';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router';

import { orpc, type ApiOutputs } from '../api/client';
import { MoviePoster } from '../components/MoviePoster';
import { formatCount, formatRating, formatRuntime } from '../format';

type Movie = ApiOutputs['movies']['get'];

/**
 * Back to the list as it was — same search, genre, sort and page — when we came
 * from it. Opened from a shared link, there is no previous list, so it is the
 * first page.
 */
function useBackToListHref(): string {
  const state: unknown = useLocation().state;

  if (
    typeof state === 'object' &&
    state !== null &&
    'listSearch' in state &&
    typeof state.listSearch === 'string' &&
    state.listSearch !== ''
  ) {
    return `/movies?${state.listSearch}`;
  }

  return '/movies';
}

/** `"/movies/abc"` is as unknown as `"/movies/999999"`, so neither reaches the API as a 400. */
function parseMovieId(raw: string | undefined): number | undefined {
  const id = Number(raw);

  return Number.isInteger(id) && id > 0 ? id : undefined;
}

function MovieNotFound({ backHref }: { backHref: string }) {
  return (
    <Stack gap="sm" align="flex-start">
      <Title order={1}>Film not found</Title>
      <Text c="dimmed">There is no film at this address. It may have been a mistyped link.</Text>
      <Anchor component={Link} to={backHref}>
        Back to the films
      </Anchor>
    </Stack>
  );
}

function MovieDetailSkeleton() {
  return (
    <Grid gap="xl">
      <Grid.Col span={{ base: 12, sm: 4 }}>
        <AspectRatio ratio={2 / 3}>
          <Skeleton radius="md" />
        </AspectRatio>
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 8 }}>
        <Stack gap="md">
          <Skeleton height={44} width="70%" />
          <Skeleton height={20} width="40%" />
          <Skeleton height={120} />
          <Skeleton height={80} />
        </Stack>
      </Grid.Col>
    </Grid>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack gap={4}>
      <Text size="sm" c="dimmed" tt="uppercase" fw={600}>
        {title}
      </Text>
      {children}
    </Stack>
  );
}

function PeopleSection({ title, people }: { title: string; people: string[] }) {
  if (people.length === 0) {
    return null;
  }

  return (
    <Section title={title}>
      <Text>{people.join(', ')}</Text>
    </Section>
  );
}

function Ratings({ movie }: { movie: Movie }) {
  if (movie.imdbRating === null && movie.metacritic === null) {
    return <Text c="dimmed">Not rated yet.</Text>;
  }

  return (
    <Group gap="xl">
      {movie.imdbRating === null ? null : (
        <Stack gap={0}>
          <Text fz={28} fw={700} lh={1.1}>
            {formatRating(movie.imdbRating)}
            <Text span c="dimmed" fz="sm" fw={400}>
              {' '}
              / 10
            </Text>
          </Text>
          <Text size="xs" c="dimmed">
            IMDb
            {movie.imdbVotes === null ? '' : ` · ${formatCount(movie.imdbVotes)} votes`}
          </Text>
        </Stack>
      )}
      {movie.metacritic === null ? null : (
        <Stack gap={0}>
          <Text fz={28} fw={700} lh={1.1}>
            {movie.metacritic}
          </Text>
          <Text size="xs" c="dimmed">
            Metacritic
          </Text>
        </Stack>
      )}
    </Group>
  );
}

function Awards({ movie }: { movie: Movie }) {
  if (movie.awardsText === null && movie.awardsWins === 0 && movie.awardsNominations === 0) {
    return <Text c="dimmed">No awards recorded.</Text>;
  }

  return (
    <Stack gap={4}>
      {movie.awardsText === null ? null : <Text>{movie.awardsText}</Text>}
      <Text size="sm" c="dimmed">
        {formatCount(movie.awardsWins)} {movie.awardsWins === 1 ? 'win' : 'wins'} ·{' '}
        {formatCount(movie.awardsNominations)}{' '}
        {movie.awardsNominations === 1 ? 'nomination' : 'nominations'}
      </Text>
    </Stack>
  );
}

function MovieDetail({ movie }: { movie: Movie }) {
  const facts = [
    movie.type === 'series' ? 'Series' : null,
    movie.rated,
    movie.runtime === null ? null : formatRuntime(movie.runtime),
    movie.countries.join(', ') || null,
    movie.languages.join(', ') || null,
  ].filter((fact) => fact !== null);

  const plot = movie.fullplot ?? movie.plot;

  return (
    <Grid gap="xl">
      <Grid.Col span={{ base: 12, sm: 4 }}>
        <Card withBorder radius="md" padding={0}>
          <MoviePoster poster={movie.poster} title={movie.title} />
        </Card>
      </Grid.Col>

      <Grid.Col span={{ base: 12, sm: 8 }}>
        <Stack gap="lg">
          <Stack gap="xs">
            <Title order={1}>{movie.title}</Title>
            {facts.length === 0 ? null : <Text c="dimmed">{facts.join(' · ')}</Text>}
            {movie.genres.length === 0 ? null : (
              <Group gap="xs">
                {movie.genres.map((genre) => (
                  <Badge
                    key={genre}
                    component={Link}
                    to={`/movies?genre=${encodeURIComponent(genre)}`}
                    variant="light"
                    style={{ cursor: 'pointer' }}
                  >
                    {genre}
                  </Badge>
                ))}
              </Group>
            )}
          </Stack>

          <Section title="Plot">
            {plot === null ? (
              <Text c="dimmed">No plot summary available.</Text>
            ) : (
              <Text>{plot}</Text>
            )}
          </Section>

          <Section title="Ratings">
            <Ratings movie={movie} />
          </Section>

          <PeopleSection title="Cast" people={movie.castMembers} />
          <PeopleSection
            title={movie.directors.length === 1 ? 'Director' : 'Directors'}
            people={movie.directors}
          />
          <PeopleSection
            title={movie.writers.length === 1 ? 'Writer' : 'Writers'}
            people={movie.writers}
          />

          <Section title="Awards">
            <Awards movie={movie} />
          </Section>
        </Stack>
      </Grid.Col>
    </Grid>
  );
}

export function MovieDetailPage() {
  const { id: rawId } = useParams();
  const id = parseMovieId(rawId);
  const backHref = useBackToListHref();

  const movieQuery = useQuery({
    ...orpc.movies.get.queryOptions({ input: { id: id ?? 0 } }),
    enabled: id !== undefined,
    /* A 404 will be a 404 the second time too; only transient failures are
       worth another attempt. */
    retry: (failureCount, error) => !isDefinedError(error) && failureCount < 1,
  });

  const isNotFound =
    id === undefined || (isDefinedError(movieQuery.error) && movieQuery.error.code === 'NOT_FOUND');

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        {isNotFound ? (
          <MovieNotFound backHref={backHref} />
        ) : (
          <Anchor component={Link} to={backHref} size="sm">
            ← Back to the films
          </Anchor>
        )}

        {!isNotFound && movieQuery.isPending ? <MovieDetailSkeleton /> : null}

        {!isNotFound && movieQuery.isError ? (
          <Alert color="red" variant="light" title="Could not load this film">
            <Stack gap="xs" align="flex-start">
              <Text size="sm">{movieQuery.error.message}</Text>
              <Button
                size="xs"
                variant="light"
                color="red"
                onClick={() => {
                  void movieQuery.refetch();
                }}
              >
                Try again
              </Button>
            </Stack>
          </Alert>
        ) : null}

        {movieQuery.isSuccess ? <MovieDetail movie={movieQuery.data} /> : null}
      </Stack>
    </Container>
  );
}
