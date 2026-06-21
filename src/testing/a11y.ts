import * as axe from 'axe-core';
import {expect} from 'vitest';

const AXE_OPTIONS: axe.RunOptions = {
  rules: {
    'color-contrast': {
      enabled: false,
    },
  },
};

const formatViolations = (violations: axe.Result[]): string =>
  violations
    .map((violation: axe.Result) => {
      const impactedNodes = violation.nodes
        .map(
          (node: axe.NodeResult) =>
            `${node.target.join(' ')} → ${node.failureSummary ?? 'No failure summary provided.'}`,
        )
        .join('\n');

      return `${violation.id}: ${violation.help}\n${impactedNodes}`;
    })
    .join('\n\n');

export async function expectNoAxeViolations(container: Element): Promise<void> {
  const {violations} = await axe.run(container, AXE_OPTIONS);

  expect(violations, formatViolations(violations)).toHaveLength(0);
}
