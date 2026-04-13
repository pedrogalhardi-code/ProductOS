import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface GherkinRendererProps {
  content: string;
}

interface GherkinScenario {
  id: string;
  name: string;
  steps: GherkinStep[];
}

interface GherkinStep {
  keyword: 'GIVEN' | 'WHEN' | 'THEN' | 'AND' | 'BUT';
  text: string;
}

interface GherkinGroup {
  number: number;
  name: string;
  scenarios: GherkinScenario[];
}

function parseGherkinContent(content: string): GherkinGroup[] {
  const lines = content.split('\n').filter((l) => l.trim());
  const groups: GherkinGroup[] = [];
  let currentGroup: GherkinGroup | null = null;
  let currentScenario: GherkinScenario | null = null;
  let scenarioCounter = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    const groupMatch = trimmed.match(/^(\d+)\s+(.+)$/);
    if (groupMatch && !trimmed.match(/^(\d+\.\d+)/)) {
      if (currentGroup) {
        groups.push(currentGroup);
      }
      currentGroup = {
        number: parseInt(groupMatch[1]),
        name: groupMatch[2],
        scenarios: [],
      };
      currentScenario = null;
      continue;
    }

    const scenarioMatch = trimmed.match(/^(\d+\.\d+)\s+(.+)$/);
    if (scenarioMatch && currentGroup) {
      currentScenario = {
        id: `scenario-${scenarioCounter++}`,
        name: scenarioMatch[2],
        steps: [],
      };
      currentGroup.scenarios.push(currentScenario);
      continue;
    }

    const stepMatch = trimmed.match(/^\*\s+(Given|When|Then|And|But)\s+(.+)$/i);
    if (stepMatch && currentScenario) {
      const keyword = stepMatch[1].toUpperCase() as
        | 'GIVEN'
        | 'WHEN'
        | 'THEN'
        | 'AND'
        | 'BUT';
      currentScenario.steps.push({
        keyword,
        text: stepMatch[2],
      });
    }
  }

  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups;
}

function KeywordPill({ keyword }: { keyword: string }) {
  const classes: Record<string, string> = {
    GIVEN: 'gherkin-given',
    WHEN: 'gherkin-when',
    THEN: 'gherkin-then',
    AND: 'gherkin-and',
    BUT: 'gherkin-and',
  };

  return <span className={classes[keyword]}>{keyword}</span>;
}

export default function GherkinRenderer({ content }: GherkinRendererProps) {
  const groups = useMemo(() => parseGherkinContent(content), [content]);
  const [expandedScenarios, setExpandedScenarios] = useState<
    Set<string>
  >(new Set(groups.flatMap((g) => g.scenarios.map((s) => s.id))));

  const toggleScenario = (scenarioId: string) => {
    const newSet = new Set(expandedScenarios);
    if (newSet.has(scenarioId)) {
      newSet.delete(scenarioId);
    } else {
      newSet.add(scenarioId);
    }
    setExpandedScenarios(newSet);
  };

  if (groups.length === 0) {
    return (
      <div className="text-gray-500 italic">
        No Gherkin scenarios found. Format your acceptance criteria as:
        <pre className="mt-2 bg-gray-100 p-3 rounded text-xs overflow-x-auto">
{`1  Group Name
1.1 Scenario Name
* Given some condition
* When action occurs
* Then result is expected
   * And additional check`}
        </pre>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.number} className="space-y-3">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 bg-telus-purple text-white text-xs font-bold rounded-full">
              {group.number}
            </span>
            {group.name}
          </h3>

          <div className="space-y-2 ml-8">
            {group.scenarios.map((scenario) => {
              const isExpanded = expandedScenarios.has(scenario.id);

              return (
                <div
                  key={scenario.id}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => toggleScenario(scenario.id)}
                    className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-600" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-600" />
                    )}
                    <span className="text-sm font-medium text-gray-900">
                      {scenario.name}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="px-4 py-3 space-y-2 bg-white">
                      {scenario.steps.map((step, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2 text-sm text-gray-700"
                        >
                          <KeywordPill keyword={step.keyword} />
                          <span>{step.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
