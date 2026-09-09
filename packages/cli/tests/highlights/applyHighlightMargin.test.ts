import { describe, test, expect } from '@jest/globals'
import { applyHighlightMargin } from '../../src/highlights/index.js'

describe('applyHighlightMargin', () => {
  test('expands start/end by the given margin', () => {
    const result = applyHighlightMargin([{ start: 10, end: 20, title: 'Momento' }], 2)
    expect(result).toEqual([{ start: 8, end: 22, title: 'Momento' }])
  })

  test('clamps start at 0', () => {
    const result = applyHighlightMargin([{ start: 1, end: 20, title: 'Momento' }], 5)
    expect(result[0].start).toBe(0)
    expect(result[0].end).toBe(25)
  })

  test('clamps end at the provided max duration', () => {
    const result = applyHighlightMargin([{ start: 10, end: 98, title: 'Momento' }], 5, 100)
    expect(result[0].start).toBe(5)
    expect(result[0].end).toBe(100)
  })

  test('returns the same array when margin is 0', () => {
    const highlights = [{ start: 10, end: 20, title: 'Momento' }]
    expect(applyHighlightMargin(highlights, 0)).toBe(highlights)
  })

  test('preserves other highlight fields (e.g. reason)', () => {
    const result = applyHighlightMargin([{ start: 10, end: 20, title: 'Momento', reason: 'engraçado' }], 1)
    expect(result[0].reason).toBe('engraçado')
  })
})
