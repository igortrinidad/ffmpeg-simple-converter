import inquirer from 'inquirer'
import { WIZARD_BACK, WIZARD_FORWARD, registerWizardPrompts } from './wizardPrompts.js'

registerWizardPrompts()

export type WizardStepType = 'list' | 'checkbox' | 'confirm' | 'input'

export interface WizardChoice {
  name: string
  value: any
}

export interface WizardStep {
  id: string
  type: WizardStepType
  message: string
  choices?: WizardChoice[]
  default?: any
  validate?: (input: any) => boolean | string
}

type WizardAnswers = Record<string, any>

const NAV_HINTS: Record<WizardStepType, { back: string; forward: string }> = {
  list: { back: '← voltar', forward: '→ avançar' },
  checkbox: { back: '← voltar', forward: '→ avançar' },
  confirm: { back: '← voltar', forward: '→ avançar' },
  input: { back: 'ESC voltar', forward: '' }
}

function buildHint(step: WizardStep, canGoBack: boolean, canGoForward: boolean): string {
  const hints = NAV_HINTS[step.type]
  const parts: string[] = []
  if (canGoBack) parts.push(hints.back)
  if (canGoForward && hints.forward) parts.push(hints.forward)
  return parts.length ? ` (${parts.join(' | ')})` : ''
}

function sameAnswer(a: any, b: any): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Runs a sequence of inquirer prompts as a back/forward-navigable wizard.
 *
 * `computeSteps` is called fresh on every iteration with the answers confirmed
 * so far and must return the full step list *known at this point* — this is
 * what lets later steps depend on earlier answers (e.g. which workflow options
 * to show depends on the selected file's type). The already-answered prefix
 * of the returned list must stay stable as long as those answers don't change.
 *
 * Left arrow (Escape for text input) goes back one step. Right arrow re-applies
 * a previously given answer to advance forward again, as long as no earlier
 * answer changed in a way that invalidates it.
 */
export async function runWizard<T extends WizardAnswers>(
  computeSteps: (answers: Partial<T>) => WizardStep[]
): Promise<T> {
  const stack: Array<{ id: string; answer: any }> = []
  let redo: Array<{ id: string; answer: any }> = []

  const toAnswers = (): Partial<T> => {
    const result: WizardAnswers = {}
    for (const entry of stack) result[entry.id] = entry.answer
    return result as Partial<T>
  }

  while (true) {
    const answersSoFar = toAnswers()
    const steps = computeSteps(answersSoFar)

    if (stack.length >= steps.length) {
      return answersSoFar as T
    }

    const step = steps[stack.length]
    const redoEntry = redo.length > 0 && redo[redo.length - 1].id === step.id
      ? redo[redo.length - 1]
      : undefined

    const canGoBack = stack.length > 0
    const canGoForward = !!redoEntry

    const { value } = await inquirer.prompt([
      {
        type: `${step.type}-nav`,
        name: 'value',
        message: step.message + buildHint(step, canGoBack, canGoForward),
        choices: step.choices,
        default: redoEntry ? redoEntry.answer : step.default,
        validate: step.validate,
        wizardNav: { canGoBack, canGoForward }
      } as any
    ])

    if (value === WIZARD_BACK) {
      if (stack.length > 0) redo.push(stack.pop()!)
      continue
    }

    if (value === WIZARD_FORWARD && redoEntry) {
      stack.push(redoEntry)
      redo.pop()
      continue
    }

    if (redoEntry && sameAnswer(redoEntry.answer, value)) {
      redo.pop()
    } else {
      redo = []
    }

    stack.push({ id: step.id, answer: value })
  }
}
