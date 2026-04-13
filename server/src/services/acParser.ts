/**
 * ProductOS — Acceptance Criteria Parser
 *
 * Validates and normalises GIVEN/WHEN/THEN (Gherkin BDD) acceptance criteria.
 * If the AI output does not conform, this parser reformats it before
 * the content is sent to the client. Malformed ACs are NEVER surfaced.
 */

import { AcceptanceCriteria, GherkinScenario, GherkinStep } from '../../../shared/types';

const KEYWORD_PATTERN = /^(GIVEN|WHEN|THEN|AND|BUT)\s+(.+)$/i;
const SCENARIO_PATTERN = /^(?:Scenario|SCENARIO)\s*:\s*(.+)$/i;
const GROUP_PATTERN = /^(\d+)\s+(.+)$/;
const SUBGROUP_PATTERN = /^(\d+\.\d+)\s+(.+)$/;

export interface ParseResult {
  isValid: boolean;
  parsed: AcceptanceCriteria[];
  rawText: string;
  issues: string[];
}

/**
 * Parse and validate acceptance criteria text.
 * Returns structured AC data and a list of any issues found.
 */
export function parseAcceptanceCriteria(text: string): ParseResult {
  const issues: string[] = [];
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const groups: AcceptanceCriteria[] = [];
  let currentGroup: AcceptanceCriteria | null = null;
  let currentScenario: { id: string; name: string; steps: GherkinStep[] } | null = null;
  let scenarioCounter = 0;

  for (const line of lines) {
    // Match top-level group: "1  Loading state"
    const groupMatch = GROUP_PATTERN.exec(line);
    const subgroupMatch = SUBGROUP_PATTERN.exec(line);
    const scenarioMatch = SCENARIO_PATTERN.exec(line);
    const keywordMatch = KEYWORD_PATTERN.exec(line);

    if (subgroupMatch) {
      // Save previous scenario
      if (currentScenario && currentGroup) {
        currentGroup.scenarios.push(currentScenario);
      }
      // Auto-create default group if subgroup appears without a parent
      if (!currentGroup) {
        currentGroup = { groupNumber: 1, groupName: 'Acceptance Criteria', scenarios: [] };
      }
      scenarioCounter++;
      currentScenario = {
        id: subgroupMatch[1],
        name: subgroupMatch[2].trim(),
        steps: [],
      };
    } else if (groupMatch && !subgroupMatch) {
      // Save previous scenario and group
      if (currentScenario && currentGroup) {
        currentGroup.scenarios.push(currentScenario);
        currentScenario = null;
      }
      if (currentGroup) groups.push(currentGroup);

      currentGroup = {
        groupNumber: parseInt(groupMatch[1], 10),
        groupName: groupMatch[2].trim(),
        scenarios: [],
      };
    } else if (scenarioMatch) {
      if (currentScenario && currentGroup) {
        currentGroup.scenarios.push(currentScenario);
      }
      scenarioCounter++;
      currentScenario = {
        id: String(scenarioCounter),
        name: scenarioMatch[1].trim(),
        steps: [],
      };
    } else if (keywordMatch) {
      const keyword = keywordMatch[1].toUpperCase() as GherkinStep['keyword'];
      const stepText = keywordMatch[2].trim();

      if (!currentScenario) {
        // Create a default scenario if steps appear without a header
        scenarioCounter++;
        currentScenario = {
          id: String(scenarioCounter),
          name: 'Unnamed scenario',
          steps: [],
        };
        issues.push(`Steps found without a scenario header — grouped into "Unnamed scenario"`);
      }

      currentScenario.steps.push({ keyword, text: stepText });
    }
    // Bullet prefixes (* -) — strip and treat as continuation
    else if (line.startsWith('* ') || line.startsWith('- ')) {
      const inner = line.slice(2).trim();
      const innerMatch = KEYWORD_PATTERN.exec(inner);
      if (innerMatch && currentScenario) {
        currentScenario.steps.push({
          keyword: innerMatch[1].toUpperCase() as GherkinStep['keyword'],
          text: innerMatch[2].trim(),
        });
      }
    }
  }

  // Flush final scenario and group
  if (currentScenario && currentGroup) {
    currentGroup.scenarios.push(currentScenario);
  }
  if (currentGroup) groups.push(currentGroup);

  // Validation
  if (groups.length === 0) {
    issues.push('No GIVEN/WHEN/THEN scenarios found');
  }

  for (const group of groups) {
    for (const scenario of group.scenarios) {
      const hasGiven = scenario.steps.some((s) => s.keyword === 'GIVEN');
      const hasWhen = scenario.steps.some((s) => s.keyword === 'WHEN');
      const hasThen = scenario.steps.some((s) => s.keyword === 'THEN');

      if (!hasGiven) issues.push(`Scenario "${scenario.name}": missing GIVEN step`);
      if (!hasWhen) issues.push(`Scenario "${scenario.name}": missing WHEN step`);
      if (!hasThen) issues.push(`Scenario "${scenario.name}": missing THEN step`);
    }
  }

  return {
    isValid: issues.length === 0,
    parsed: groups,
    rawText: text,
    issues,
  };
}

/**
 * Convert unstructured prose acceptance criteria into valid GIVEN/WHEN/THEN format.
 * Used as a fallback when the AI returns malformed output.
 */
export function reformatAcceptanceCriteria(rawText: string): string {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const reformatted: string[] = [];
  let scenarioNumber = 1;
  let hasCurrentScenario = false;

  for (const line of lines) {
    // Already has BDD keyword — preserve and normalise case
    const keywordMatch = KEYWORD_PATTERN.exec(line.replace(/^\*\s*|-\s*/g, ''));
    if (keywordMatch) {
      const keyword = keywordMatch[1].toUpperCase();
      const text = keywordMatch[2].trim();
      reformatted.push(`${keyword} ${text}`);
      hasCurrentScenario = true;
      continue;
    }

    // Looks like a scenario header
    const scenarioMatch = SCENARIO_PATTERN.exec(line);
    if (scenarioMatch) {
      if (reformatted.length > 0) reformatted.push('');
      reformatted.push(`${scenarioNumber}.${scenarioNumber} ${scenarioMatch[1].trim()}`);
      scenarioNumber++;
      hasCurrentScenario = false;
      continue;
    }

    // Try to detect implicit structure from prose
    const lowerLine = line.toLowerCase();
    if (!hasCurrentScenario) {
      if (reformatted.length > 0) reformatted.push('');
      reformatted.push(`Scenario: ${line}`);
      hasCurrentScenario = false;
    } else if (
      lowerLine.startsWith('given') ||
      lowerLine.startsWith('assuming') ||
      lowerLine.startsWith('when the user')
    ) {
      reformatted.push(`GIVEN ${line.replace(/^given\s*/i, '')}`);
    } else if (
      lowerLine.startsWith('when') ||
      lowerLine.startsWith('the user clicks') ||
      lowerLine.startsWith('the user taps')
    ) {
      reformatted.push(`WHEN ${line.replace(/^when\s*/i, '')}`);
    } else if (
      lowerLine.startsWith('then') ||
      lowerLine.startsWith('the system') ||
      lowerLine.startsWith('it should') ||
      lowerLine.startsWith('the app')
    ) {
      reformatted.push(`THEN ${line.replace(/^then\s*/i, '')}`);
    } else {
      reformatted.push(`AND ${line}`);
    }
  }

  return reformatted.join('\n');
}

/**
 * Render parsed AcceptanceCriteria back to a human-readable string.
 * Used for Jira export and Confluence export.
 */
export function renderAcceptanceCriteria(groups: AcceptanceCriteria[]): string {
  const lines: string[] = [];

  for (const group of groups) {
    lines.push(`${group.groupNumber}  ${group.groupName}`);
    lines.push('');

    for (const scenario of group.scenarios) {
      lines.push(`${scenario.id} ${scenario.name}`);
      for (const step of scenario.steps) {
        lines.push(`* ${step.keyword} ${step.text}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n').trim();
}

/**
 * Quick check: does a text block contain at least one valid GIVEN/WHEN/THEN set?
 */
export function containsValidAC(text: string): boolean {
  const hasGiven = /\bGIVEN\b/i.test(text);
  const hasWhen = /\bWHEN\b/i.test(text);
  const hasThen = /\bTHEN\b/i.test(text);
  return hasGiven && hasWhen && hasThen;
}

/**
 * Extract all acceptance criteria blocks from a full document string.
 * Returns an array of raw AC blocks (one per user story).
 */
export function extractACBlocks(documentContent: string): string[] {
  // Split on "Acceptance Criteria:" and grab content until the next story title or end
  const parts = documentContent.split(/Acceptance Criteria:\s*\n/i);

  // First element is content before first AC block — skip it
  const blocks: string[] = [];
  for (let i = 1; i < parts.length; i++) {
    // Trim the block at the next story-title marker or heading
    const block = parts[i]
      .split(/\n\*\*Title:|\n#+\s/)[0]
      .trim();
    if (block) blocks.push(block);
  }

  return blocks;
}

/**
 * Validate an entire document's acceptance criteria compliance.
 * Returns per-story compliance status.
 */
export function validateDocumentAC(documentContent: string): {
  totalStories: number;
  compliantStories: number;
  issues: { storyIndex: number; issues: string[] }[];
} {
  const blocks = extractACBlocks(documentContent);
  const allIssues: { storyIndex: number; issues: string[] }[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const result = parseAcceptanceCriteria(blocks[i]);
    if (!result.isValid) {
      allIssues.push({ storyIndex: i + 1, issues: result.issues });
    }
  }

  return {
    totalStories: blocks.length,
    compliantStories: blocks.length - allIssues.length,
    issues: allIssues,
  };
}
