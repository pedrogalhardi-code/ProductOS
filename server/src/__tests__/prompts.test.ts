import { getDocumentTypePrompt, GENERATION_SYSTEM_PROMPT, REVIEW_SYSTEM_PROMPT } from '../services/prompts';

describe('prompts — getDocumentTypePrompt', () => {
  it('returns PRD prompt for PRD type', () => {
    const prompt = getDocumentTypePrompt('PRD');
    expect(prompt).toContain('Product Requirements Document');
    expect(prompt).toContain('Executive Summary');
    expect(prompt).toContain('Acceptance Criteria');
  });

  it('returns USER_STORIES prompt', () => {
    const prompt = getDocumentTypePrompt('USER_STORIES');
    expect(prompt).toContain('user stories');
    expect(prompt).toContain('GIVEN/WHEN/THEN');
  });

  it('returns TECHNICAL_SPEC prompt', () => {
    const prompt = getDocumentTypePrompt('TECHNICAL_SPEC');
    expect(prompt).toContain('Technical Specification');
    expect(prompt).toContain('API Contracts');
  });

  it('returns PRODUCT_BRIEF prompt', () => {
    const prompt = getDocumentTypePrompt('PRODUCT_BRIEF');
    expect(prompt).toContain('Product Brief');
  });

  it('returns ROADMAP prompt', () => {
    const prompt = getDocumentTypePrompt('ROADMAP');
    expect(prompt).toContain('Now / Next / Later');
  });

  it('returns OKRS prompt', () => {
    const prompt = getDocumentTypePrompt('OKRS');
    expect(prompt).toContain('OKRs');
    expect(prompt).toContain('Key Results');
  });

  it('falls back to PRD for unknown type', () => {
    const prompt = getDocumentTypePrompt('UNKNOWN');
    expect(prompt).toContain('Product Requirements Document');
  });
});

describe('prompts — GENERATION_SYSTEM_PROMPT', () => {
  it('contains required template variables', () => {
    expect(GENERATION_SYSTEM_PROMPT).toContain('{clientContext}');
    expect(GENERATION_SYSTEM_PROMPT).toContain('{language}');
    expect(GENERATION_SYSTEM_PROMPT).toContain('{tone}');
  });

  it('mandates GIVEN/WHEN/THEN format', () => {
    expect(GENERATION_SYSTEM_PROMPT).toContain('GIVEN / WHEN / THEN');
  });

  it('requires analytics instrumentation', () => {
    expect(GENERATION_SYSTEM_PROMPT).toContain('analytics instrumentation');
    expect(GENERATION_SYSTEM_PROMPT).toContain('snake_case');
  });

  it('instructs model to lean on synced reference materials and limit discovery questions', () => {
    expect(GENERATION_SYSTEM_PROMPT).toContain('--- Reference materials (local folder or Google Drive) ---');
    expect(GENERATION_SYSTEM_PROMPT).toContain('**Information needed before continuing**');
  });
});

describe('prompts — REVIEW_SYSTEM_PROMPT', () => {
  it('contains clientContext variable', () => {
    expect(REVIEW_SYSTEM_PROMPT).toContain('{clientContext}');
  });

  it('includes all required review sections', () => {
    expect(REVIEW_SYSTEM_PROMPT).toContain('Strategic Gap Analysis');
    expect(REVIEW_SYSTEM_PROMPT).toContain('Assumption Audit');
    expect(REVIEW_SYSTEM_PROMPT).toContain('User Empathy Score');
    expect(REVIEW_SYSTEM_PROMPT).toContain('Analytics Readiness');
    expect(REVIEW_SYSTEM_PROMPT).toContain('Tough Questions');
    expect(REVIEW_SYSTEM_PROMPT).toContain('Overall Readiness Score');
  });
});
