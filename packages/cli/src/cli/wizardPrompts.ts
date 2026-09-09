import inquirer from 'inquirer'
import { createRequire } from 'module'

// Inquirer's prompt classes and utilities are CommonJS and not part of its
// public API surface, but there's no supported way to add arrow-key based
// back/forward navigation to `list`/`checkbox`/`confirm`/`input` without
// subclassing them directly. This file is CLI-only and excluded from the
// CommonJS build (see tsconfig.cjs.json) — the interactive CLI only ever runs
// from the ESM build — so `import.meta.url` is safe to use here.
const nodeRequire = createRequire(import.meta.url)

const ListPrompt = nodeRequire('inquirer/lib/prompts/list')
const CheckboxPrompt = nodeRequire('inquirer/lib/prompts/checkbox')
const ConfirmPrompt = nodeRequire('inquirer/lib/prompts/confirm')
const InputPrompt = nodeRequire('inquirer/lib/prompts/input')
const observe = nodeRequire('inquirer/lib/utils/events')
const cliCursor = nodeRequire('cli-cursor')
const { takeUntil } = nodeRequire('rxjs/operators')

export const WIZARD_BACK = Symbol('wizard:back')
export const WIZARD_FORWARD = Symbol('wizard:forward')

export interface WizardNav {
  canGoBack?: boolean
  canGoForward?: boolean
}

function finish(promptInstance: any, sentinel: symbol): void {
  if (promptInstance.status === 'answered') return
  promptInstance.status = 'answered'
  try {
    promptInstance.screen.done()
  } catch {
    // best-effort cleanup, never let a rendering issue break navigation
  }
  cliCursor.show()
  promptInstance.done(sentinel)
}

/**
 * Wraps an inquirer prompt class so that — when the question sets
 * `wizardNav.canGoBack`/`canGoForward` — pressing `backKey` resolves the
 * prompt with WIZARD_BACK and pressing `forwardKey` resolves it with
 * WIZARD_FORWARD, on top of the prompt's normal behavior.
 */
function withWizardNav(PromptClass: any, backKey: string, forwardKey: string | null) {
  return class extends PromptClass {
    _run(cb: (value: any) => void) {
      super._run(cb)

      const nav: WizardNav = this.opt.wizardNav || {}
      if (!nav.canGoBack && !nav.canGoForward) {
        return this
      }

      const events = observe(this.rl)
      events.keypress.pipe(takeUntil(events.line)).forEach((event: any) => {
        const keyName = event.key?.name
        if (nav.canGoBack && keyName === backKey) {
          finish(this, WIZARD_BACK)
        } else if (nav.canGoForward && forwardKey && keyName === forwardKey) {
          finish(this, WIZARD_FORWARD)
        }
      })

      return this
    }
  }
}

let registered = false

/**
 * Registers `list-nav`/`checkbox-nav`/`confirm-nav`/`input-nav` prompt types.
 * Left arrow (or Escape, for text input — left/right already move the text
 * cursor there) goes back to the previous wizard step; right arrow re-applies
 * a previously given answer to advance forward again. Safe to call more than
 * once — only registers the first time.
 */
export function registerWizardPrompts(): void {
  if (registered) return
  registered = true

  inquirer.registerPrompt('list-nav', withWizardNav(ListPrompt, 'left', 'right') as any)
  inquirer.registerPrompt('checkbox-nav', withWizardNav(CheckboxPrompt, 'left', 'right') as any)
  inquirer.registerPrompt('confirm-nav', withWizardNav(ConfirmPrompt, 'left', 'right') as any)
  inquirer.registerPrompt('input-nav', withWizardNav(InputPrompt, 'escape', null) as any)
}
