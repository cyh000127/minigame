import { describe, expect, it } from 'vitest';
import {
  createGameUrl,
  createLifecycleMessage,
  findGameBySlug,
  GAMES,
  hasDuplicateSlugs,
} from './launcher';

describe('launcher registry', () => {
  it('keeps game slugs unique', () => {
    expect(hasDuplicateSlugs()).toBe(false);
  });

  it('creates internal game URLs only', () => {
    for (const game of GAMES) {
      expect(createGameUrl(game.slug)).toBe(`/games/${game.slug}/index.html`);
      expect(createGameUrl(game.slug)).not.toContain('://');
    }
  });

  it('creates pages-compatible URLs when a base path exists', () => {
    expect(createGameUrl('laser-grid', '/minigame/')).toBe('/minigame/games/laser-grid/index.html');
  });

  it('finds known games and falls back to the first game', () => {
    expect(findGameBySlug('road-racer').title).toBe('Road Racer');
    expect(findGameBySlug('missing-game')).toBe(GAMES[0]);
  });

  it('creates lifecycle messages for future game adapters', () => {
    expect(createLifecycleMessage('pause', 'color-match')).toEqual({
      source: 'minigame-hub',
      command: 'pause',
      gameSlug: 'color-match',
    });
  });
});
