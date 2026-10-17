import { railStickOffset, stuckHeight } from './rail-stick';

describe('railStickOffset', () => {
  it('is the distance from the top of the rail to its anchor, minus the rail padding', () => {
    expect(railStickOffset({ anchorTop: 133, paddingTop: 12 })).toBe(121);
  });

  it('is 0 when the anchor is the first thing in the rail', () => {
    expect(railStickOffset({ anchorTop: 12, paddingTop: 12 })).toBe(0);
  });

  it('never goes negative when the anchor sits inside the rail padding', () => {
    expect(railStickOffset({ anchorTop: 4, paddingTop: 12 })).toBe(0);
  });
});

describe('stuckHeight', () => {
  it('is what remains of the rail once the offset has scrolled away', () => {
    expect(stuckHeight({ railHeight: 183, anchorTop: 133, paddingTop: 12 })).toBe(62);
  });

  it('is the whole rail when there is nothing to scroll away', () => {
    expect(stuckHeight({ railHeight: 183, anchorTop: 12, paddingTop: 12 })).toBe(183);
  });

  it('never goes negative when the rail is shorter than its offset', () => {
    expect(stuckHeight({ railHeight: 100, anchorTop: 133, paddingTop: 12 })).toBe(0);
  });
});
