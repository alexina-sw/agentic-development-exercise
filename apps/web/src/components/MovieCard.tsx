import { Badge, Card, Group, Stack, Text } from '@mantine/core';
import { Link } from 'react-router';

import type { ApiOutputs } from '../api/client';
import { formatRating, formatRuntime } from '../format';
import { MoviePoster } from './MoviePoster';

type MovieSummary = ApiOutputs['movies']['list']['items'][number];

interface MovieCardProps {
  movie: MovieSummary;
  /** The list's query string, so the detail page can link back to the same page of results. */
  listSearch: string;
}

export function MovieCard({ movie, listSearch }: MovieCardProps) {
  return (
    <Card
      component={Link}
      to={`/movies/${String(movie.id)}`}
      state={{ listSearch }}
      withBorder
      radius="md"
      padding={0}
    >
      <MoviePoster poster={movie.poster} title={movie.title} />

      <Stack gap={6} p="sm">
        <Text fw={600} lineClamp={2}>
          {movie.title}
        </Text>

        <Group gap="xs">
          {movie.imdbRating === null ? (
            <Badge variant="light" color="gray" size="sm">
              Unrated
            </Badge>
          ) : (
            <Badge variant="light" color="yellow" size="sm">
              IMDb {formatRating(movie.imdbRating)}
            </Badge>
          )}
          {movie.runtime === null ? null : (
            <Text size="xs" c="dimmed">
              {formatRuntime(movie.runtime)}
            </Text>
          )}
          {movie.rated === null ? null : (
            <Text size="xs" c="dimmed">
              {movie.rated}
            </Text>
          )}
        </Group>

        <Text size="xs" c="dimmed" lineClamp={1}>
          {movie.genres.join(' · ')}
        </Text>
      </Stack>
    </Card>
  );
}
