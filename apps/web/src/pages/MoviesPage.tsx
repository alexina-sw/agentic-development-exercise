import {
  Alert,
  AspectRatio,
  Button,
  Container,
  Group,
  Pagination,
  SegmentedControl,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { movieSortSchema, type MovieSort } from '@app/contract';

import { orpc } from '../api/client';
import { MovieCard } from '../components/MovieCard';
import { formatCount } from '../format';

const pageSize = 24;

const gridCols = { base: 1, xs: 2, sm: 3, md: 4 };

const sortOptions: { value: MovieSort; label: string }[] = [
  { value: 'title', label: 'Title' },
  { value: 'rating', label: 'Rating' },
];

/**
 * The URL is the only copy of the list's state, so page 7 of "Comedy by rating"
 * is a link. Anything a hand-edited URL gets wrong falls back to the default
 * rather than becoming a 400 from the API.
 */
function readListParams(searchParams: URLSearchParams) {
  const page = Number(searchParams.get('page'));

  return {
    q: searchParams.get('q') ?? '',
    genre: searchParams.get('genre') ?? '',
    sort: movieSortSchema.catch('title').parse(searchParams.get('sort')),
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

function MovieGridSkeleton() {
  return (
    <SimpleGrid cols={gridCols} spacing="md">
      {Array.from({ length: 8 }, (_, index) => (
        <Stack key={index} gap="xs">
          <AspectRatio ratio={2 / 3}>
            <Skeleton radius="md" />
          </AspectRatio>
          <Skeleton height={16} width="80%" />
          <Skeleton height={12} width="50%" />
        </Stack>
      ))}
    </SimpleGrid>
  );
}

export function MoviesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { q, genre, sort, page } = readListParams(searchParams);

  /* Each change writes the URL, and only the page control keeps the page:
     a new search or filter starts again from page 1. Empty values are removed
     so the default list lives at a clean `/movies`. */
  const updateParams = (changes: Record<string, string>) => {
    /* Read from the address bar, not from `searchParams` or setSearchParams'
       `prev`: both come from a render, and the debounced search fires up to
       300 ms later — after a sort click it would write the old sort back. */
    const next = new URLSearchParams(window.location.search);

    for (const [key, value] of Object.entries(changes)) {
      if (
        value === '' ||
        (key === 'page' && value === '1') ||
        (key === 'sort' && value === 'title')
      ) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }

    if (!('page' in changes)) {
      next.delete('page');
    }

    setSearchParams(next);
  };

  /* The box is typed into locally and reaches the URL once typing pauses, so
     every keystroke is neither a history entry nor a request. */
  const [search, setSearch] = useState(q);
  const pushSearch = useDebouncedCallback((value: string) => {
    updateParams({ q: value.trim() });
  }, 300);

  /* Back, forward and "Clear filters" change the URL underneath the box; this
     brings the box along, adjusting state during render rather than in an effect. */
  const [syncedQ, setSyncedQ] = useState(q);
  if (q !== syncedQ) {
    setSyncedQ(q);
    if (q !== search.trim()) {
      setSearch(q);
    }
  }

  const listQuery = useQuery(
    orpc.movies.list.queryOptions({
      input: {
        page,
        pageSize,
        sort,
        q: q === '' ? undefined : q,
        genre: genre === '' ? undefined : genre,
      },
      /* Keep showing the current page while the next one loads, instead of
         collapsing the grid to a skeleton on every click. */
      placeholderData: keepPreviousData,
    }),
  );

  const genresQuery = useQuery(orpc.movies.genres.queryOptions());

  const clearFilters = () => {
    pushSearch.cancel();
    setSearch('');
    updateParams({ q: '', genre: '' });
  };

  const hasFilters = q !== '' || genre !== '';

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <Group justify="space-between" align="flex-end">
          <Stack gap={4}>
            <Title order={1}>Browse films</Title>
            <Text c="dimmed" size="sm">
              {listQuery.isSuccess
                ? `${formatCount(listQuery.data.total)} ${listQuery.data.total === 1 ? 'film' : 'films'}`
                : '\u00a0'}
            </Text>
          </Stack>
        </Group>

        <Group align="flex-end" gap="md" wrap="wrap">
          <TextInput
            label="Search by title"
            placeholder="e.g. alien"
            value={search}
            onChange={(event) => {
              setSearch(event.currentTarget.value);
              pushSearch(event.currentTarget.value);
            }}
            w={{ base: '100%', sm: 280 }}
          />
          <Select
            label="Genre"
            placeholder={genresQuery.isError ? 'Genres unavailable' : 'All genres'}
            data={genresQuery.data ?? []}
            value={genre === '' ? null : genre}
            onChange={(value) => {
              updateParams({ genre: value ?? '' });
            }}
            disabled={genresQuery.isError}
            clearable
            searchable
            w={{ base: '100%', sm: 200 }}
          />
          <Stack gap={4}>
            <Text size="sm" fw={500}>
              Sort by
            </Text>
            <SegmentedControl
              data={sortOptions}
              value={sort}
              onChange={(value) => {
                updateParams({ sort: value });
              }}
            />
          </Stack>
          {hasFilters ? (
            <Button variant="subtle" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null}
        </Group>

        {listQuery.isPending ? <MovieGridSkeleton /> : null}

        {listQuery.isError && listQuery.data === undefined ? (
          <Alert color="red" variant="light" title="Could not load films">
            <Stack gap="xs" align="flex-start">
              <Text size="sm">{listQuery.error.message}</Text>
              <Button
                size="xs"
                variant="light"
                color="red"
                onClick={() => {
                  void listQuery.refetch();
                }}
              >
                Try again
              </Button>
            </Stack>
          </Alert>
        ) : null}

        {listQuery.data !== undefined && listQuery.data.items.length === 0 ? (
          <Alert color="gray" variant="light" title="No films match">
            <Stack gap="xs" align="flex-start">
              <Text size="sm">
                {listQuery.data.total > 0
                  ? `There are only ${String(listQuery.data.totalPages)} pages of results.`
                  : 'Nothing in the catalogue matches this search and genre.'}
              </Text>
              <Button
                size="xs"
                variant="light"
                onClick={
                  listQuery.data.total > 0
                    ? () => {
                        updateParams({ page: '1' });
                      }
                    : clearFilters
                }
              >
                {listQuery.data.total > 0 ? 'Go to page 1' : 'Clear filters'}
              </Button>
            </Stack>
          </Alert>
        ) : null}

        {listQuery.data !== undefined && listQuery.data.items.length > 0 ? (
          <Stack gap="lg" style={{ opacity: listQuery.isPlaceholderData ? 0.6 : 1 }}>
            <SimpleGrid cols={gridCols} spacing="md">
              {listQuery.data.items.map((movie) => (
                <MovieCard key={movie.id} movie={movie} listSearch={searchParams.toString()} />
              ))}
            </SimpleGrid>

            <Group justify="center">
              <Pagination
                total={listQuery.data.totalPages}
                value={page}
                onChange={(nextPage) => {
                  updateParams({ page: String(nextPage) });
                  window.scrollTo({ top: 0 });
                }}
              />
            </Group>
          </Stack>
        ) : null}
      </Stack>
    </Container>
  );
}
