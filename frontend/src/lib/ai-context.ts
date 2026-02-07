// Builds rich context about the user's factory for the AI system prompt.
// Combines game knowledge, current factory state, and simulation results.

import { ITEMS, RECIPES } from '@/data/recipes';
import { MACHINES } from '@/data/machines';
import { buildGameKnowledgePrompt } from '@/data/satisfactory-knowledge';
import type { MachineInstance, FactorySimulationResult } from '@/types/factory';
import type { ProjectData } from '@/lib/api';
import type { DisplaySimResult } from '@/store/projectStore';

/**
 * Build factory context from the NEW machine-based system.
 */
export function buildFactoryContext(
  factoryName: string,
  machines: MachineInstance[],
  simulation: FactorySimulationResult | null,
): string {
  if (machines.length === 0) {
    return `## Current Factory: "${factoryName}"\n\nNo machines placed yet. The factory is empty.`;
  }

  const machineLines = machines.map(m => {
    const info = MACHINES[m.machineType];
    const recipe = m.recipe ? RECIPES.find(r => r.id === m.recipe) : null;
    const sim = simulation?.nodes[m.id];
    const status = sim
      ? sim.inputSatisfaction < 0.99 ? 'STARVED' : 'OK'
      : 'unknown';
    return `- ${info?.label ?? m.machineType} #${m.id.slice(0, 4)} | Recipe: ${recipe?.label ?? 'Not set'} | OC: ${(m.overclock * 100).toFixed(0)}% | Output: ${sim?.actualOutput.toFixed(1) ?? '?'}/min (${status}) | Power: ${sim?.powerDraw.toFixed(1) ?? '?'} MW`;
  }).join('\n');

  const parts: string[] = [
    `## Current Factory: "${factoryName}"`,
    '',
    `### Machines (${machines.length} total)`,
    machineLines,
  ];

  if (simulation) {
    // Production summary
    const itemSummary = Object.entries(simulation.totalItems)
      .filter(([, v]) => Math.abs(v.net) > 0.01)
      .map(([item, v]) => {
        const label = ITEMS[item]?.label ?? item.replace(/_/g, ' ');
        return `- ${label}: ${v.net > 0 ? '+' : ''}${v.net.toFixed(1)}/min`;
      })
      .join('\n');

    if (itemSummary) {
      parts.push('', '### Production Summary (net)', itemSummary);
    }

    // External inputs
    if (simulation.externalInputs.length > 0) {
      parts.push(
        '',
        '### External Inputs Required',
        ...simulation.externalInputs.map(i => {
          const label = ITEMS[i.item]?.label ?? i.item.replace(/_/g, ' ');
          return `- ${label}: ${i.rate.toFixed(1)}/min`;
        }),
      );
    }

    // Final outputs
    if (simulation.finalOutputs.length > 0) {
      parts.push(
        '',
        '### Final Outputs',
        ...simulation.finalOutputs.map(o => {
          const label = ITEMS[o.item]?.label ?? o.item.replace(/_/g, ' ');
          return `- ${label}: ${o.rate.toFixed(1)}/min`;
        }),
      );
    }

    // Issues
    if (simulation.criticalIssues.length > 0 || simulation.warnings.length > 0) {
      parts.push('', '### Issues');
      for (const w of simulation.criticalIssues) {
        parts.push(`- CRITICAL: ${w.message}`);
      }
      for (const w of simulation.warnings) {
        parts.push(`- WARNING: ${w.message}`);
      }
    }

    // Power
    parts.push('', `### Power: ${simulation.totalPower.toFixed(1)} MW total`);
  }

  return parts.join('\n');
}

/**
 * Build factory context from the LEGACY item-based system.
 */
export function buildLegacyFactoryContext(
  project: ProjectData,
  simulationResult: DisplaySimResult | null,
): string {
  const automatedItems = Object.entries(project.items)
    .filter(([, i]) => i.automated)
    .map(([key, i]) => ({
      key,
      label: ITEMS[key]?.label ?? key,
      machines: i.machines,
      overclock: i.overclock,
    }));

  const itemList = automatedItems
    .map(i => `- ${i.label}: ${i.machines} machine(s) at ${Math.round(i.overclock * 100)}% overclock`)
    .join('\n');

  const bottleneckList = simulationResult?.bottlenecks.length
    ? simulationResult.bottlenecks.map(b => `- ${b.label}: shortfall ${b.shortfall.toFixed(1)}/min`).join('\n')
    : 'None detected';

  const rawMaterials = simulationResult?.rawMaterials
    ? Object.entries(simulationResult.rawMaterials)
        .map(([k, v]) => `- ${ITEMS[k]?.label ?? k}: ${v.toFixed(1)}/min`)
        .join('\n')
    : 'None';

  return `## Current Factory: "${project.name}"

### Automated Items (${automatedItems.length})
${itemList || 'No items automated yet.'}

### Current Bottlenecks
${bottleneckList}

### Raw Material Requirements
${rawMaterials}`;
}

/**
 * Build the complete system prompt for the AI assistant.
 */
export function buildFullSystemPrompt(factoryContext: string): string {
  const gameKnowledge = buildGameKnowledgePrompt();

  return `You are FICSIT Factory AI, an expert automation consultant for the game Satisfactory. You help players optimize their factory production lines, plan builds, and resolve bottlenecks.

${gameKnowledge}

${factoryContext}

## Your Role
1. Help users plan and optimize factory production lines
2. Suggest which items to automate next based on their current setup
3. Identify and explain bottlenecks with specific numbers
4. Recommend optimal machine counts and overclock settings
5. Explain production chains and dependencies
6. Help with factory planning for space elevator parts and end-game items

## Response Format
When suggesting optimizations, use this structure:

**Problem:** [specific bottleneck or issue]
**Solution:** [action to take]
**Impact:** [expected improvement in items/min]
**Implementation:** [step-by-step if complex]

When suggesting changes, use XML tags so the UI can offer quick-action buttons:

<suggestion type="add_machine" machine="assembler" recipe="motor" count="2">
Add 2 Assemblers for Motors to meet demand
</suggestion>

<suggestion type="change_overclock" machineId="abc123" overclock="1.5">
Increase Smelter overclock to 150% to match belt input
</suggestion>

Keep responses concise and practical. Use specific numbers when suggesting machine counts. Reference the user's current factory state when relevant.`;
}

/**
 * Parse AI response for structured suggestion tags.
 */
export interface AISuggestion {
  type: string;
  attributes: Record<string, string>;
  text: string;
}

export function parseAISuggestions(response: string): AISuggestion[] {
  const suggestions: AISuggestion[] = [];
  const regex = /<suggestion\s+([^>]*)>([\s\S]*?)<\/suggestion>/g;
  let match;

  while ((match = regex.exec(response)) !== null) {
    const attrStr = match[1];
    const text = match[2].trim();

    // Parse attributes
    const attributes: Record<string, string> = {};
    const attrRegex = /(\w+)="([^"]*)"/g;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(attrStr)) !== null) {
      attributes[attrMatch[1]] = attrMatch[2];
    }

    suggestions.push({
      type: attributes.type ?? 'unknown',
      attributes,
      text,
    });
  }

  return suggestions;
}

/**
 * Strip suggestion XML tags from response for clean display.
 */
export function stripSuggestionTags(response: string): string {
  return response.replace(/<suggestion\s+[^>]*>([\s\S]*?)<\/suggestion>/g, '$1');
}
