import { AspectRatio, Center, Image, Text } from '@mantine/core';

interface MoviePosterProps {
  /** `null` for the 89 films the dataset ships without a poster URL. */
  poster: string | null;
  title: string;
}

/* Film posters are 2:3. Sizing the box to that shape rather than to a fixed
   height means `fit="cover"` has nothing to crop at any card width. */
const posterRatio = 2 / 3;

/**
 * What a film looks like when there is no picture of it: a filled panel of
 * exactly the poster's size, so the grid keeps its rhythm. A broken image icon
 * is the version of this that happens by accident.
 *
 * It deliberately does not repeat the title — the title is already next to it,
 * and saying it twice reads as a bug rather than as a placeholder.
 */
function PosterPlaceholder() {
  return (
    <Center bg="var(--mantine-color-default-hover)" px="md">
      <Text size="xs" c="dimmed" tt="uppercase" fw={700} lts={1} ta="center">
        No poster
      </Text>
    </Center>
  );
}

export function MoviePoster({ poster, title }: MoviePosterProps) {
  return (
    <AspectRatio ratio={posterRatio}>
      {poster === null ? (
        <PosterPlaceholder />
      ) : (
        <Image src={poster} alt={`Poster for ${title}`} fit="cover" />
      )}
    </AspectRatio>
  );
}
