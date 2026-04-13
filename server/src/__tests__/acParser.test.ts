import {
  parseAcceptanceCriteria,
  reformatAcceptanceCriteria,
  containsValidAC,
  validateDocumentAC,
  renderAcceptanceCriteria,
} from '../services/acParser';

describe('acParser — containsValidAC', () => {
  it('returns true when all three keywords present', () => {
    const text = 'GIVEN a user is logged in\nWHEN they click submit\nTHEN the form is saved';
    expect(containsValidAC(text)).toBe(true);
  });

  it('returns false when THEN is missing', () => {
    const text = 'GIVEN a user\nWHEN they click';
    expect(containsValidAC(text)).toBe(false);
  });

  it('is case-insensitive', () => {
    const text = 'given a user\nwhen they act\nthen something happens';
    expect(containsValidAC(text)).toBe(true);
  });
});

describe('acParser — parseAcceptanceCriteria', () => {
  const validAC = `1  Success state
1.1 Happy path
* GIVEN the user is on the dashboard
* WHEN they click "New Document"
* THEN the document creation modal appears
  * AND the user can select a document type

1.2 Error state
* GIVEN the user is on the dashboard
* WHEN the API returns a 500 error
* THEN an error toast is displayed
  * AND a retry button is shown`;

  it('parses valid grouped AC correctly', () => {
    const result = parseAcceptanceCriteria(validAC);
    expect(result.isValid).toBe(true);
    expect(result.parsed).toHaveLength(1);
    expect(result.parsed[0].groupName).toBe('Success state');
    expect(result.parsed[0].scenarios).toHaveLength(2);
  });

  it('identifies missing WHEN step', () => {
    const missingWhen = `Scenario: Test
* GIVEN a precondition
* THEN an outcome`;
    const result = parseAcceptanceCriteria(missingWhen);
    expect(result.isValid).toBe(false);
    expect(result.issues.some((i) => i.includes('WHEN'))).toBe(true);
  });

  it('identifies missing GIVEN step', () => {
    const missingGiven = `Scenario: Test
* WHEN something happens
* THEN an outcome`;
    const result = parseAcceptanceCriteria(missingGiven);
    expect(result.isValid).toBe(false);
    expect(result.issues.some((i) => i.includes('GIVEN'))).toBe(true);
  });

  it('returns issues for empty input', () => {
    const result = parseAcceptanceCriteria('');
    expect(result.isValid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});

describe('acParser — reformatAcceptanceCriteria', () => {
  it('reformats prose with BDD keywords into structured format', () => {
    const prose = `Scenario: Happy path
GIVEN the user is authenticated
WHEN they submit the form
THEN the data is saved`;
    const result = reformatAcceptanceCriteria(prose);
    expect(result).toContain('GIVEN');
    expect(result).toContain('WHEN');
    expect(result).toContain('THEN');
  });

  it('handles input that lacks Scenario header', () => {
    const raw = `GIVEN a user exists
WHEN they log in
THEN they see the dashboard`;
    const result = reformatAcceptanceCriteria(raw);
    expect(result).toContain('GIVEN');
    expect(result).toContain('WHEN');
    expect(result).toContain('THEN');
  });
});

describe('acParser — renderAcceptanceCriteria', () => {
  it('renders parsed AC back to readable text', () => {
    const groups = [
      {
        groupNumber: 1,
        groupName: 'Loading state',
        scenarios: [
          {
            id: '1.1',
            name: 'Shimmer shown',
            steps: [
              { keyword: 'GIVEN' as const, text: 'the page is loading' },
              { keyword: 'WHEN' as const, text: 'the API call is in flight' },
              { keyword: 'THEN' as const, text: 'a shimmer skeleton is shown' },
            ],
          },
        ],
      },
    ];

    const rendered = renderAcceptanceCriteria(groups);
    expect(rendered).toContain('1  Loading state');
    expect(rendered).toContain('1.1 Shimmer shown');
    expect(rendered).toContain('GIVEN the page is loading');
    expect(rendered).toContain('WHEN the API call is in flight');
    expect(rendered).toContain('THEN a shimmer skeleton is shown');
  });
});

describe('acParser — validateDocumentAC', () => {
  it('validates a full document with multiple stories', () => {
    const doc = `**Title:** Story 1

Acceptance Criteria:
1.1 Happy path
* GIVEN the user is on the screen
* WHEN they tap the button
* THEN the action completes

**Title:** Story 2

Acceptance Criteria:
2.1 Error state
* GIVEN the API is down
* WHEN the user tries to load data
* THEN an error screen is shown`;

    const result = validateDocumentAC(doc);
    expect(result.totalStories).toBe(2);
    expect(result.compliantStories).toBe(2);
    expect(result.issues).toHaveLength(0);
  });
});
