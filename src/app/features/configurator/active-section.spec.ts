import {
  ACTIVE_FLOOR,
  ACTIVE_FLOOR_NARROW,
  activeSection,
  activeThreshold,
} from './active-section';

const ids = ['start', 'metadata', 'settings', 'categories', 'applications', 'bookmarks', 'export'];

/** Sections stacked with the 20 px gap of the content column, the first one at `firstTop`. */
function layout(firstTop: number, heights: readonly number[]) {
  let top = firstTop;
  return ids.map((id, index) => {
    const section = { id, top };
    top += heights[index % heights.length] + 20;
    return section;
  });
}

describe('activeThreshold', () => {
  it('is 140 px on a wide viewport and 200 px on a narrow one while the stack is short', () => {
    expect(activeThreshold(87, false)).toBe(ACTIVE_FLOOR);
    expect(activeThreshold(87, true)).toBe(ACTIVE_FLOOR_NARROW);
    expect([ACTIVE_FLOOR, ACTIVE_FLOOR_NARROW]).toEqual([140, 200]);
  });

  it('rises to the live stack height plus 24 px once that is larger', () => {
    expect(activeThreshold(130, false)).toBe(154);
    expect(activeThreshold(260, true)).toBe(284);
  });
});

describe('activeSection', () => {
  it('is the last section whose top edge is at or above the threshold', () => {
    const sections = layout(-900, [400]);

    // tops: -900, -480, -60, 360, ...
    expect(activeSection(sections, 140, false)).toBe('settings');
  });

  it('counts a top edge exactly at the threshold', () => {
    const sections = [
      { id: 'start', top: -300 },
      { id: 'metadata', top: 140 },
      { id: 'settings', top: 141 },
    ];

    expect(activeSection(sections, 140, false)).toBe('metadata');
  });

  it('is the first section while every section is still below the threshold', () => {
    expect(activeSection(layout(300, [400]), 140, false)).toBe('start');
  });

  it('is the last section at the bottom of the page even if its top is below the threshold', () => {
    const sections = layout(-1000, [300]);

    expect(activeSection(sections, 140, false)).not.toBe('export');
    expect(activeSection(sections, 140, true)).toBe('export');
  });

  it('is undefined without sections', () => {
    expect(activeSection([], 140, false)).toBeUndefined();
  });

  it('makes a section active when it is scrolled to a scroll margin equal to the stack height, for any stack', () => {
    // Property: the stack height is also the section's scroll-margin-top (spec "Responsive configurator").
    for (const narrow of [false, true]) {
      for (let stack = 60; stack <= 400; stack += 7) {
        const threshold = activeThreshold(stack, narrow);

        for (const heights of [[150], [400], [1200], [150, 1200, 400]]) {
          ids.forEach((id, target) => {
            const reference = layout(0, heights);
            const shift = stack - reference[target].top;
            const sections = reference.map((s) => ({ ...s, top: s.top + shift }));

            expect(activeSection(sections, threshold, false), `${id} at stack ${stack}`).toBe(id);
          });
        }
      }
    }
  });
});
