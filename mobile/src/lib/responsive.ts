import { useWindowDimensions } from "react-native";

/**
 * Screen classes for the layout. A tablet is any device whose short side is at least 600 dp.
 * - `isWide`: tablet in landscape → navigation rail on the left, side panels next to the content.
 * - `isTablet` in portrait → bottom navigation like the phone, but content centered with a max width.
 * Card sizes are capped on purpose so flashcards don't become posters on a 13" screen.
 */
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isTablet = Math.min(width, height) >= 600;
  const isLandscape = width > height;
  const isWide = isTablet && isLandscape && width >= 900;
  return {
    width,
    height,
    isTablet,
    isLandscape,
    isWide,
    /** Max width of the main reading column. */
    contentMaxWidth: isTablet ? 720 : undefined,
    /** Max width of a flashcard / question card. */
    cardMaxWidth: isTablet ? 520 : undefined,
  };
}
