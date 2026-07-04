import { describe, test, expect } from '@jest/globals'
import type { AxiosInstance } from 'axios'
import { BaseAIProvider } from '../../src/ai/BaseAIProvider.js'

class TestProvider extends BaseAIProvider {
  protected get axiosInstance(): AxiosInstance {
    throw new Error('not implemented in test provider')
  }

  protected async invokeLLM(): Promise<void> {}

  protected extractTextFromResponse(): string {
    return ''
  }
}

describe('BaseAIProvider.parseJSONResult', () => {
  const provider = new TestProvider({ apiKey: 'test-key', model: 'test-model' })

  test('parses plain JSON', () => {
    expect(provider.parseJSONResult('[{"start":1,"end":2}]')).toEqual([{ start: 1, end: 2 }])
  })

  test('parses JSON wrapped in a markdown code fence', () => {
    const content = '```json\n[{"start":1,"end":2}]\n```'
    expect(provider.parseJSONResult(content)).toEqual([{ start: 1, end: 2 }])
  })

  test('parses JSON surrounded by explanatory text', () => {
    const content = 'Aqui está o resultado:\n[{"start":1,"end":2}]\nEspero que ajude!'
    expect(provider.parseJSONResult(content)).toEqual([{ start: 1, end: 2 }])
  })

  test('throws when content has no JSON', () => {
    expect(() => provider.parseJSONResult('não há json aqui')).toThrow()
  })
})
